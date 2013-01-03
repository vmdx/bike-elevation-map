# The Bike Map

[The Bike Map](thebikemap.com) displays hill steepness, uphill/downhill directions, and
bike routes/paths on top of a Google Map. It also runs an A\* search algorithm to suggest
a path for bikers between points.

## Architecture

TBM is hosted as pure HTML, CSS, and Javascript by my box running nginx. The data needed to
render each map is computed beforehand, by the `google_maps_scraper.py` script in the
`scripts/` folder.

This script takes 3 arguments:

    1. The data file for a city. See the [San Francisco example](https://github.com/vmdx/bike-elevation-map-data/blob/master/united-states/california/san-francisco/sf.py).
    2. A destination .json file. This can be non-existent at time of call, but must be specified.
    3. A bad address cache to store invalid addresses in. This can be non-existent at time of call, but must be specified. See the [San Francisco example](https://github.com/vmdx/bike-elevation-map-data/blob/master/united-states/california/san-francisco/sf-bad-address-cache.txt) - but you should not attempt to create one of these yourself! The script will do it for you.

I generally end up envoking the script like this:

    python scripts/google_maps_scraper.py ../bike-elevation-map-data/united-states/california/san-francisco/sf.py web/data/sf.json ../bike-elevation-map-data/united-states/california/san-francisco/sf-bad-address-cache.txt

More explanation on what the script does later. For now, it generates a JSON file that `web/bikemap.js`
will use to fill out a Google Map with overlays for hill slope / bike paths, etc.

## License (MIT)
Copyright (c) 2013 Charlie Hsu

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
