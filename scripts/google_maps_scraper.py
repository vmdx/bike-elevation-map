import argparse
import datetime
import json
import logging
import os.path
import sys
import time

import pickle

import imp

import requests

############
# timer util
############
def timeit(func):
    def timed(*args, **kwargs):
        start = time.time()
        result = func(*args, **kwargs)
        end = time.time()

        print '%r %2.2f sec' % \
              (func.__name__, end-start)
        return result
    return timed

############
# data definition getters and intersection generation
############
@timeit
def compute_all_intersections(source_file, cache=None):
    """
    Given a source file to draw paths from, return a set of all intersections
    among those paths.
    """
    all_intersections = set([])

    assert os.path.exists(source_file)
    data_module = imp.load_source('local_data', source_file)

    for region in data_module.regions:
        while len(region) > 0:
            bucket = region.pop(0)
            for street in bucket:
                for other_bucket in region:
                    for other_street in other_bucket:
                        all_intersections.add('%s and %s' % (street, other_street))

    return all_intersections

def get_all_paths(source_file):
    """
    Given a source file to draw paths from, get all the paths.
    """
    all_paths = set([])

    assert os.path.exists(source_file)
    data_module = imp.load_source('local_data', source_file)

    for region in data_module.regions:
        while len(region) > 0:
            bucket = region.pop(0)
            for street in bucket:
                all_paths.add(street)

    return all_paths

def get_path_breaks(source_file, path):
    """
    Given a source file and a path, get the breaks on that path.
    """
    data_module = imp.load_source('local_data', source_file)
    return data_module.breaks.get(path, set([]))

def get_city(source_file):
    """
    Given a source file, get the city it refers to.
    """
    data_module = imp.load_source('local_data', source_file)
    return data_module.city


####################
# bad address cache functions
####################
BAD_CACHE_ATTRS = ['not_intersection', 'ambiguous']
BAD_CACHE_ATTR_DELIMITER = '--- '

def create_empty_bad_address_cache():
    return {attr: set([]) for attr in BAD_CACHE_ATTRS}

def load_bad_address_cache(fp):
    cache = create_empty_bad_address_cache()
    current_attr = None
    for line in fp:
        stripped_line = line.strip()
        if stripped_line == '':
            continue
        elif stripped_line.startswith(BAD_CACHE_ATTR_DELIMITER):
            current_attr = stripped_line[len(BAD_CACHE_ATTR_DELIMITER):]
        else:
            cache[current_attr].add(stripped_line)
    return cache

def write_bad_address_cache(fp, cache):
    for attr in BAD_CACHE_ATTRS:
        fp.write('%s%s\n' % (BAD_CACHE_ATTR_DELIMITER, attr))
        for bad_address in cache[attr]:
            fp.write(bad_address)
            fp.write('\n')


##################
# google api calls
##################
def get_direction_path(start, end):
    """

"Haight St and Divisadero St": {"lat": 37.7712742, "lng": -122.4370859
    37.7712742,-122.4370859   haight divis
    37.772204,-122.4372752  page divis

    http://maps.googleapis.com/maps/api/directions/json?origin=Page+St+and+Divisadero+St&destination=Haight+St+and+Divisadero+St&sensor=false

    """


def get_lat_lng_and_elevation(intersection, city):
    """
    Given an intersection string ("Divisadero St and McAllister St"),
    and a city string ("San Francisco, CA"), return the latitude,
    longitude, and elevation as a tuple, or raise an exception.
    """
    lat, lng = get_geocode(intersection, city)
    elevation = get_elevation(lat, lng)
    return lat, lng, elevation


def get_geocode(intersection, city):
    """
    Given an intersection string ("Divisadero St and McAllister St"),
    and a city string ("San Francisco, CA"), return the latitude
    and longitude as a tuple, or raise an exception.
    """
    city = city.replace(' ', '+')

    geocode_uri = 'http://maps.googleapis.com/maps/api/geocode/json?address=%s,+%s&sensor=false' % (intersection, city)

    data = make_json_request(geocode_uri)

    if len(data['results']) > 1:
        logging.warning('Got more than one result for geocode uri...: %s' % geocode_uri)
        raise AmbiguousAddressException(intersection, city)

    parts = intersection.split(' and ')

    if parts[0] not in data['results'][0]['formatted_address'] or \
       parts[1] not in data['results'][0]['formatted_address']:
        logging.error('This address was not an intersection!: %s' % geocode_uri)
        raise NotIntersectionAddressException(intersection, city)


    #if 'intersection' not in data['results'][0]['types']:
    #   logging.error('This address was not an intersection!: %s' % geocode_uri)
    #   raise NotIntersectionAddressException(intersection, city)

    latitude = data['results'][0]['geometry']['location']['lat']
    longitude = data['results'][0]['geometry']['location']['lng']

    return latitude, longitude


def get_elevation(lat, lng):
    """
    Given a latitude and a longitude, return the elevation at the point, in meters.
    """
    elevation_uri = 'http://maps.googleapis.com/maps/api/elevation/json?locations=%s,%s&sensor=false' % (lat, lng)
    data = make_json_request(elevation_uri)
    return data['results'][0]['elevation']


def make_json_request(uri):
    """
    Given an URL, return the content at the URL in JSON.

    Raises Exception if status code is not 200.
    """
    req = requests.get(uri)
    if req.status_code != 200:
        logging.error('failed request: %s' % uri)
        raise GoogleMapsApiException(uri, req.status_code)
    return json.loads(req.content)


#################
# exceptions
#################
class GoogleMapsApiException(Exception):
    def __init__(self, *args):
        self.args = args
    def __str__(self):
        return repr(self.args)

class NotIntersectionAddressException(GoogleMapsApiException):
    pass

class AmbiguousAddressException(GoogleMapsApiException):
    pass


##############
# main functions
##############
@timeit
def lookup_all_intersections(cache, intersections, bad_address_cache, city):
    """
    Fill the caches with stuff.
    """
    stats = {key: 0 for key in ['good', 'cached', 'skipped', 'bad', 'error']}

    i_cache = cache['intersections']
    p_cache = cache['paths']

    for intersection in intersections:
        if intersection in bad_address_cache['not_intersection'] or intersection in bad_address_cache['ambiguous']:
            logging.info(' [skipped] %s' % intersection)
            stats['skipped'] += 1
            continue

        if intersection in i_cache:
            logging.info(' [cached] %s' % intersection)
            stats['cached'] += 1
            continue

        try:
            latitude, longitude, elevation = get_lat_lng_and_elevation(intersection, city)
            stats['good'] += 1
        except NotIntersectionAddressException:
            bad_address_cache['not_intersection'].add(intersection)
            stats['bad'] += 1
            continue
        except AmbiguousAddressException:
            bad_address_cache['ambiguous'].add(intersection)
            stats['bad'] += 1
            continue
        except Exception as e:
            logging.error(e)
            stats['error'] += 1
            continue

        i_cache[intersection] = {'lat': latitude,
                                'lng': longitude,
                                'elevation': elevation,
                                'time': int(time.time())
                               }

        logging.info(' [fetched] %s  %s' % \
            (intersection, str(i_cache[intersection])))

        print ' [fetched] %s  %s' % (intersection, str(i_cache[intersection]))

        # If we in fact added this new intersection, add it to the paths list. We'll sort later.
        parts = intersection.split(' and ')
        for index in (0, 1):
            if parts[index] not in p_cache:
                p_cache[parts[index]] = [intersection]
            else:
                p_cache[parts[index]].append(intersection)

    return cache, bad_address_cache, stats

@timeit
def sort_path_cache(cache, input_data):
    """
    Do cool stuff

    # Now, sort the path cache, so that all paths' intersections go from west -> east or south -> south.
    # TODO: Persist, somehow, exceptions (i.e. 2nd Ave -> Fulton to Lincoln are actually two paths)

    # Here, we need to compute the minimum and maximum lats / longitudes of all intersections
    # of a street.

    # We use these to compute a reasonable starting point:
    #   - use choice = latitude
    #       if abs(max_lat - min_lat) > abs(max_lng - min_lng),
    #       else choice = lng
    #   - pick point with the minimum choice

    # To order the intersections, sort by the choice.
    # (alternatively [much more work] compute euclidean distance for each point and sort)
    # NOW DO THE SORT PER STREET

    """
    i_cache = cache['intersections']
    p_cache = cache['paths']

    for path in p_cache:

        #print path,

        # kill all the breaks in the cache - we will recompute these every time.
        p_cache[path] = filter(lambda k: k != 'BREAK', p_cache[path])

        # compute the min and max lats
        min_lat = i_cache[min(p_cache[path], key=lambda k: i_cache[k]['lat'])]['lat']
        max_lat = i_cache[max(p_cache[path], key=lambda k: i_cache[k]['lat'])]['lat']
        min_lng = i_cache[min(p_cache[path], key=lambda k: i_cache[k]['lng'])]['lng']
        max_lng = i_cache[max(p_cache[path], key=lambda k: i_cache[k]['lng'])]['lng']

        #print min_lat, min_lng, max_lat, max_lng

        if abs(max_lng - min_lng) > abs(max_lat - min_lat):
            choice = 'lng'
        else:
            choice = 'lat'

        # use sorted() for creating new object, sort() for inplace.
        sorted_path = sorted(p_cache[path], key=lambda k: i_cache[k][choice])

        #if choice == 'lat':
            #print 'south -> north'
        #if choice == 'lng':
            #print 'west -> east'

        # Add the breaks!
        breaks = get_path_breaks(input_data, path)
        path_with_breaks = []
        for intersection in sorted_path:
            path_with_breaks.append(intersection)
            parts = intersection.split(' and ')
            if parts[0] in breaks or parts[1] in breaks:
                path_with_breaks.append('BREAK')

        #print path_with_breaks

        p_cache[path] = path_with_breaks

    return cache

#################
# main script executable
#################

parser = argparse.ArgumentParser()

parser.add_argument('-f', '--force', action='store_true', help='force an overwrite of any existing scraped keys')
parser.add_argument('-v', '--verbose', action='store_true', help='display all informational logging')
parser.add_argument('-d', '--debug', action='store_true', help='display all debug logging')
parser.add_argument('input_data', help="input data file (i.e. data/sf_test.py)")
parser.add_argument('output_file', help="output file location")
parser.add_argument('bad_cache', help="cache for bad addresses")


if __name__ == "__main__":
    now = time.time()
    args = parser.parse_args()
    print args


    if args.verbose:
        logging.getLogger().setLevel(logging.INFO)
    if args.debug:
        logging.getLogger().setLevel(logging.DEBUG)

    logging.getLogger('requests.packages.urllib3.connectionpool').setLevel(logging.WARNING)

    # Set the cache from an existing output file
    if args.force or not os.path.exists(args.output_file):
        cache = {'paths': {}, 'intersections': {}}
    else:
        with open(args.output_file) as filecache:
            cache = json.load(filecache)

    # Get the bad address cache, if it exists
    if args.bad_cache and os.path.exists(args.bad_cache):
        with open(args.bad_cache) as bcache_fp:
            bad_address_cache = load_bad_address_cache(bcache_fp)
    else:
        bad_address_cache = create_empty_bad_address_cache()


    # Get the intersection data
    intersections = compute_all_intersections(args.input_data)

    city = get_city(args.input_data)

    cache, bad_address_cache, stats = lookup_all_intersections(cache, intersections, bad_address_cache, city)

    cache = sort_path_cache(cache, args.input_data)

    cache['buildtime'] = datetime.datetime.fromtimestamp(now).strftime('%Y-%m-%d-%H%M')

    with open(args.output_file, 'w') as result_file:
        json.dump(cache, result_file)

    with open(args.bad_cache, 'w') as bcache_fp:
        write_bad_address_cache(bcache_fp, bad_address_cache)

    print "total intersections:", len(intersections)
    print "good intersections looked up:", stats['good']
    print "bad intersections looked up and to be skipped next time:", stats['bad']
    print "cached intersections:", stats['cached']
    print "bad skipped intersections:", stats['skipped']
    print "error on lookup:", stats['error']

    logging.info('Done!')
