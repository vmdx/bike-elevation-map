import argparse
import json
import logging
import pprint
import os.path
import sys
import time

import requests

parser = argparse.ArgumentParser()

parser.add_argument('-f', '--force', action='store_true', help='force an overwrite of any existing scraped keys')
parser.add_argument('-v', '--verbose', action='store_true', help='display all informational logging')
parser.add_argument('-d', '--debug', action='store_true', help='display all debug logging')
parser.add_argument('area', help="area in /data to load")

pprinter = pprint.PrettyPrinter(indent=2)

def make_json_request(uri):
    req = requests.get(uri)
    if req.status_code != 200:
        logging.error('failed request: %s' % uri)
        raise Exception
    return json.loads(req.content)


if __name__ == "__main__":
    args = parser.parse_args()
    #print args

    if args.verbose:
        logging.getLogger().setLevel(logging.INFO)
    if args.debug:
        logging.getLogger().setLevel(logging.DEBUG)

    logging.getLogger('requests.packages.urllib3.connectionpool').setLevel(logging.WARNING)

    if args.force or not os.path.exists('data/%s_data.json' % args.area):
        cache = {}
    else:
        with open('data/%s_data.json' % args.area) as filecache:
            cache = json.load(filecache)

    #logging.info(pprinter.pformat(cache))

    with open('data/%s.json' % args.area) as area_file:
        area_def = json.load(area_file)

    #logging.info(pprinter.pformat(area_def))

    intersections = set([])
    for street in area_def['streets']:
        for intersection in area_def['streets'][street]:
            intersections.add(intersection)

    for intersection in intersections:
        if intersection in cache:
            logging.info(' [cached] %s' % intersection)
            continue

        try:
            geocode_uri = 'http://maps.googleapis.com/maps/api/geocode/json?address=%s,+San+Francisco,+CA&sensor=false' % intersection.replace(' ', '+')
            data = make_json_request(geocode_uri)
            if len(data['results']) > 1:
                logging.warning('Got more than one result for geocode uri...: %s' % geocode_uri)
            if 'intersection' not in data['results'][0]['types']:
                logging.error('This address was not an intersection!: %s' % geocode_uri)
                continue
            latitude = data['results'][0]['geometry']['location']['lat']
            longitude = data['results'][0]['geometry']['location']['lng']

            elevation_uri = 'http://maps.googleapis.com/maps/api/elevation/json?locations=%s,%s&sensor=false' % (latitude, longitude)
            data = make_json_request(elevation_uri)
            elevation = data['results'][0]['elevation']
        except Exception:
            continue

        cache[intersection] = {'lat': latitude, \
                               'lng': longitude, \
                               'elevation': elevation, \
                               'time': int(time.time())}
        logging.info(' [fetched] %s  %s' % \
            (intersection, str(cache[intersection])))

    with open('data/%s_data.json' % args.area, 'w') as result_file:
        json.dump(cache, result_file)

    logging.info('Done!')
