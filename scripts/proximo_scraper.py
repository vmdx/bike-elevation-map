"""
NOTE: This script is not used by the bike-elevation map for anything.
      It is kept around for historical purposes - previously, we attempted
      to get all intersections in a city by asking Nextbus for all its bus stop
      data.

Gets all intersections served by transit lines in SF.

Sorts them into street buckets (all intersections for Geary Blvd, Divisadero, etc),
then, sorts each bucket so that the intersections come in a continuous path.

i.e. Geary + 1st, then Geary + 2nd, then Geary + 3rd, etc.
NOT: Geary + 43rd, then Geary + 2nd, then Geary + 33rd, etc.

"""

import json
import operator

import requests

if __name__ == '__main__':
    r = requests.get('http://proximobus.appspot.com/agencies/sf-muni/routes.json')
    route_info = json.loads(r.content)
    routes = []
    for route in route_info['items']:
        routes.append(route['id'])

    print routes

    intersections = []
    found_intersections = set([])
    for route in routes:
    #for route in ['38', '24']:
        print '--- starting route %s' % route
        r = requests.get('http://proximobus.appspot.com/agencies/sf-muni/routes/%s/stops.json' % route)
        stops = json.loads(r.content)
        for stop in stops['items']:

            # Fix the display name.
            #   * strip any trailing spaces
            #   * verify ' & ' in the string
            #   * split in half, change ' & ' to ' and ' for google geocoding
            #   * make sure no duplicates on flip: [u'Noe St and 30th St', u'30th St and Noe St']
            # FIXME: http://docs.python.org/library/stdtypes.html#str.title
            # St Joseph'S Ave latitude south -> north,
            # O'Farrell St longitude west -> east
            new_intersection_name = stop['display_name'].strip()
            parts = new_intersection_name.split(' & ')
            if len(parts) != 2:
                print 'bad intersection: %s' % new_intersection_name
                continue

            # Strip any trailing periods (i.e. McAllister St.)
            parts[0] = parts[0].strip().rstrip('.')
            parts[1] = parts[1].strip().rstrip('.')
            # Convert '&' to 'and' for Google geocoding to work
            new_intersection_name = parts[0] + ' and ' + parts[1]
            alt_intersection_name = parts[1] + ' and ' + parts[0]
            stop['display_name'] = new_intersection_name

            if new_intersection_name not in found_intersections and \
               alt_intersection_name not in found_intersections:
                intersections.append(stop)
                found_intersections.add(stop['display_name'])
            else:
                pass
                #print 'cached: %s' % stop['display_name']


    # Here, we need to compute the minimum and maximum lats / longitudes of all intersections
    # of a street.

    # We use these to compute a reasonable starting point:
    #   - use choice = latitude
    #       if abs(max_lat - min_lat) > abs(max_lng - min_lng),
    #       else choice = lng
    #   - pick point with the minimum choice

    # To order the intersections, sort by the choice.
    # (alternatively [much more work] compute euclidean distance for each point and sort)

    result = {}
    for intersection in intersections:
        intersection_name = intersection['display_name']
        parts = intersection_name.split(' and ')

        for index in (0, 1):
            if parts[index] not in result:
                result[parts[index]] = [intersection]
            else:
                result[parts[index]].append(intersection)

    # NOW DO THE SORT PER STREET
    sorted_results = {}
    for street in result:
        min_lat = min(result[street], key=operator.itemgetter('latitude'))['latitude']
        min_lng = min(result[street], key=operator.itemgetter('longitude'))['longitude']
        max_lat = max(result[street], key=operator.itemgetter('latitude'))['latitude']
        max_lng = max(result[street], key=operator.itemgetter('longitude'))['longitude']
        if abs(max_lng - min_lng) > abs(max_lat - min_lat):
            choice = 'longitude'
        else:
            choice = 'latitude'

        sorted_street = sorted(result[street], key=operator.itemgetter(choice))
        sorted_street_names_only = map(lambda x: str(x['display_name']), sorted_street)

        print street, choice,
        if choice == 'latitude':
            print 'south -> north'
        if choice == 'longitude':
            print 'west -> east'
        sorted_results[street] = sorted_street_names_only


    print 'writing to file...'
    with open('intersections_result.txt', 'w') as result_file:
        for street in sorted_results:
            result_file.write('"%s": %s,\n' % (street, str(sorted_results[street]).replace("'", '"')))

    print 'done!'

