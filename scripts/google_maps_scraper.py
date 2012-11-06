import argparse
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

        print '%r (%r, %r) %2.2f sec' % \
              (func.__name__, args, kwargs, end-start)
        return result
    return timed

############
# intersection generation
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

    while len(data_module.paths) > 0:
        bucket = data_module.paths.pop(0)
        for street in bucket:
            for other_bucket in data_module.paths:
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

    while len(data_module.paths) > 0:
        bucket = data_module.paths.pop(0)
        for street in bucket:
            all_paths.add(street)

    return all_paths

def get_path_attr(source_file, path, attr):
    """
    Given a source file and a path, get the specified attr.
    """
    data_module = imp.load_source('local_data', source_file)
    for bucket in data_module.paths:
        if path in bucket:
            return bucket[path][attr]
    raise KeyError



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

#################
# main script executable
#################

parser = argparse.ArgumentParser()

parser.add_argument('-f', '--force', action='store_true', help='force an overwrite of any existing scraped keys')
parser.add_argument('-v', '--verbose', action='store_true', help='display all informational logging')
parser.add_argument('-d', '--debug', action='store_true', help='display all debug logging')
parser.add_argument('output_file', help="output file location")
parser.add_argument('pickle_cache', help="pickle cache for bad addresses")


if __name__ == "__main__":
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
    if args.pickle_cache and os.path.exists(args.pickle_cache):
        with open(args.pickle_cache) as pcache:
            bad_address_cache = pickle.load(pcache)
    else:
        bad_address_cache = {'not_intersection': set([]), 'ambiguous': set([])}


    # Get the intersection data
    intersections = compute_all_intersections('data/sf_test.py')

    cached, good, bad, skipped, error = (0, 0, 0, 0, 0)

    i_cache = cache['intersections']
    p_cache = cache['paths']
    for intersection in intersections:
        if intersection in bad_address_cache['not_intersection'] or intersection in bad_address_cache['ambiguous']:
            logging.info(' [skipped] %s' % intersection)
            skipped += 1
            continue

        if intersection in i_cache:
            logging.info(' [cached] %s' % intersection)
            cached += 1
            continue

        try:
            latitude, longitude, elevation = get_lat_lng_and_elevation(intersection, "San Francisco, CA")
            good += 1
        except NotIntersectionAddressException:
            bad_address_cache['not_intersection'].add(intersection)
            bad += 1
            continue
        except AmbiguousAddressException:
            bad_address_cache['ambiguous'].add(intersection)
            bad += 1
            continue
        except Exception as e:
            logging.error(e)
            error += 1
            continue

        i_cache[intersection] = {'lat': latitude,
                                'lng': longitude,
                                'elevation': elevation,
                                'time': int(time.time())
                               }

        logging.info(' [fetched] %s  %s' % \
            (intersection, str(i_cache[intersection])))

        # If we in fact added this new intersection, add it to the paths list. We'll sort later.
        parts = intersection.split(' and ')
        for index in (0, 1):
            if parts[index] not in p_cache:
                p_cache[parts[index]] = [intersection]
            else:
                p_cache[parts[index]].append(intersection)

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
    for path in p_cache:

        """
        # XXX: How to sort a list via info in another dict?
l = ['charlie', 'liz', 'snorri']
d = {'charlie': {'lat': 30, 'lng': 40, 'elevation': 70}, 'liz': {'lat': 14, 'lng': 30, 'elevation': 60}, 'snorri': {'lat': 100, 'lng': 20, 'elevation': 10}}

>>> min(l, key=lambda k: d[k]['elevation'])
'snorri'
>>> max(l, key=lambda k: d[k]['elevation'])
'charlie'
>>> sorted(l, key=lambda k: d[k]['elevation'])
['snorri', 'liz', 'charlie']

        """

        print path,

        # kill all the breaks in the cache - we will recompute these every time.
        p_cache[path] = filter(lambda k: k != 'BREAK', p_cache[path])

        # compute the min and max lats
        min_lat = i_cache[min(p_cache[path], key=lambda k: i_cache[k]['lat'])]['lat']
        max_lat = i_cache[max(p_cache[path], key=lambda k: i_cache[k]['lat'])]['lat']
        min_lng = i_cache[min(p_cache[path], key=lambda k: i_cache[k]['lng'])]['lng']
        max_lng = i_cache[max(p_cache[path], key=lambda k: i_cache[k]['lng'])]['lng']

        print min_lat, min_lng, max_lat, max_lng

        if abs(max_lng - min_lng) > abs(max_lat - min_lat):
            choice = 'lng'
        else:
            choice = 'lat'

        # use sorted() for creating new object, sort() for inplace.
        sorted_path = sorted(p_cache[path], key=lambda k: i_cache[k][choice])

        if choice == 'lat':
            print 'south -> north'
        if choice == 'lng':
            print 'west -> east'

        # Add the breaks!
        breaks = get_path_attr('data/sf_test.py', path, 'breaks')
        path_with_breaks = []
        for intersection in sorted_path:
            path_with_breaks.append(intersection)
            parts = intersection.split(' and ')
            if parts[0] in breaks or parts[1] in breaks:
                path_with_breaks.append('BREAK')

        print path_with_breaks

        p_cache[path] = path_with_breaks




    with open(args.output_file, 'w') as result_file:
        json.dump(cache, result_file)

    with open(args.pickle_cache, 'w') as pcache:
        pickle.dump(bad_address_cache, pcache)

    print "total intersections:", len(intersections)
    print "good intersections looked up:", good
    print "bad intersections looked up and to be skipped next time:", bad
    print "cached intersections:", cached
    print "bad skipped intersections:", skipped
    print "error on lookup:", error

    logging.info('Done!')
