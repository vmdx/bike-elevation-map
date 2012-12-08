# City Definition Data

Each city file is defined in a Python module. Each module
attempts to encompass the minimum amount of information needed
to efficiently compute the graph of a city's bike paths.

## Neccessary variables

Each city module must have the following variables:

* `city` - A string that holds the city name.

    city = 'San Francisco, CA'


* `regions` - A list of regions within the city. Each 'region' is
itself a list. The entries in each region are lists of non-intersecting
streets. This nested structure allows us to more efficiently compute
intersections for a whole city (by region, then by further delineation
of non intersecting streets within a region).

    regions = [
        # NOPA
        [
            [
                'Geary Blvd', 'Ellis St', 'Eddy St', "St Joseph's Ave",
                'Golden Gate Ave', 'McAllister St', 'Fulton St', ...
            ],
            [
                'Van Ness Ave', 'Franklin St', 'Gough St',
                'Octavia Blvd', 'Octavia St', 'Laguna St', 'Buchanan St',
                'Webster St', 'Fillmore St', 'Steiner St', 'Pierce St', 'Scott St',
                'Divisadero St', "Broderick St", 'Baker St',
                 'Lyon St', 'Central Ave', 'Masonic Ave', ...
            ],
        ],
        # Richmond/Sunset
        [
            [
                'Lake St', 'California St', 'Clement St', 'Geary Blvd',
                'Anza St', 'Balboa St', 'Cabrillo St', 'Fulton St',
                'Lincoln Way', 'Frederick St', 'Hugo St',
                'Irving St', 'Judah St',
                'Kirkham St', 'Lawton St', 'Moraga St',
                'Noriega St', 'Ortega St', 'Pacheco St' ...
            ],
            [
                # The Aves ( no 13th )
                '2nd Ave', '3rd Ave', '4th Ave', '5th Ave',
                '6th Ave', '7th Ave', '8th Ave', '9th Ave',
                '10th Ave', '11th Ave', '12th Ave', '14th Ave'...
            ],
        ],
        ...
    ]


* `breaks` - A dict containing the breaks along paths in the city. A
'break' is when there is no singular, well-defined path between two
points along the same road. For example, there is no well defined
path on 2nd Ave between and Lincoln Way/Fulton St, because of Golden
Gate Park. Thus, we do not draw a line between these two points, and
we need to define which points get that behavior.

Breaks are street names mapped to sets of streets which they break on.
The mandatory convention is to list the western or southern side of the
break - so for our example above, we list Lincoln Way as the break,
since Lincoln Way is south of Fulton St. This is because of how we
sort intersections (latitude goes south to north / longitude goes
west to east).

    breaks = {
        # Alamo Square
        'Grove St': set(['Scott St']),

        # Panhandle, Anza Vista
        'Lyon St': set(['Turk Blvd', 'Oak St']),

        ...
    }

* `curved_roads` - A dict mapping streets to parts of that street that
contain curved roads. By default, to avoid excessive querying of the
Google Directions API, we assume straight roads and simply draw
straight lines between intersections. But, curved roads require us
to ping the Google Directions API for the true path.

    curved_roads = {
        'Lawton St': [('16th Ave', 'Funston Ave')],
        '15th Ave': [('Noriega St', 'Lawton St')]
        ...
    }

* `major_bike_paths` - TBD.

* `custom_paths` - A dict defining custom paths in the city. Sometimes,
intersections generated from streets aren't enough. Here, we can define
a name for a custom path, and map it to a list of intersections that
will comprise the path (think the Panhandle bike path). These will
automatically become major bike paths.

    custom_paths = {
        'The Panhandle / SF Bike Route 30': [
            'Baker St and Fell St',
            'San Francisco Bicycle Route 30 and Masonic Ave',
            'San Francisco Bicycle Route 30 and Stanyan St',
        ]
        ...
    }
    
