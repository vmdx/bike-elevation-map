"""
Breaks are defined as intersections where there should be
no path connecting that intersection with the next one.

Breaks always go from west -> east, or south -> north.

For example: there is a break on 2nd Ave at Lincoln Way, since
you can't get to 2nd Ave @ Fulton (the next intersection)
without taking a turn. Lincoln is the south intersection, hence,
south -> north.



Each region is a list of buckets.
Each bucket contains a set of paths.
For a region, the paths in one bucket are all parallel and never intersect.
"""

city = 'San Francisco, CA'

regions = [
    # NOPA
    [
        [
            'Geary Blvd', "O'Farrell St", "Turk St", "Turk Blvd",
            'Ellis St', 'Eddy St',
            'Golden Gate Ave', 'McAllister St', 'Fulton St',
            'Grove St', 'Hayes St', 'Fell St', 'Oak St',
            'Page St', 'Haight St', 'Waller St',
        ],
        [
            'Van Ness Ave', 'Franklin St', 'Gough St',
            'Octavia Blvd', 'Octavia St', 'Laguna St', 'Buchanan St',
            'Webster St', 'Fillmore St', 'Steiner St', 'Pierce St', 'Scott St',
            # Div -> Masonic
            'Divisadero St', "Broderick St", 'Baker St', 'Lyon St', 'Central Ave', 'Masonic Ave',
            # Masonic -> Stanyan
            'Ashbury St', 'Clayton St', 'Belvedere St', 'Parker Ave', 'Cole St', 'Shrader St', 'Stanyan St',
        ],
    ],
    # Richmond/Sunset
    [
        # west -> east streets
        [
            'Lake St', 'California St', 'Clement St', 'Geary Blvd',
            'Anza St', 'Balboa St', 'Cabrillo St', 'Fulton St',
            'Lincoln Way', 'Frederick St', 'Hugo St',
            'Irving St', 'Judah St',
            'Kirkham St', 'Lawton St', 'Moraga St',
            'Noriega St', 'Ortega St', 'Pacheco St',
            'Quintara St', 'Rivera St', 'Santiago St',
            'Taraval St', 'Ulloa St',
        ],

        # south -> north streets
        [
            # the aves ( no 13th )
            '2nd Ave', '3rd Ave', '4th Ave', '5th Ave', '6th Ave', '7th Ave', '8th Ave', '9th Ave', '10th Ave', '11th Ave', '12th Ave', '14th Ave', '15th Ave', '16th Ave', '17th Ave', '18th Ave', '19th Ave', '20th Ave', '21st Ave', '22nd Ave', '23rd Ave', '24th Ave', '25th Ave', '26th Ave', '27th Ave', '28th Ave', '29th Ave', '30th Ave', '31st Ave', '32nd Ave', '33rd Ave', '34th Ave', '35th Ave', '36th Ave', '37th Ave', '38th Ave', '39th Ave', '40th Ave', '41st Ave', '42nd Ave', '43rd Ave', '44th Ave', '45th Ave', '46th Ave', '47th Ave', '48th Ave',
            # other streets
            'Arguello Blvd', 'Sunset Blvd', 'Funston Ave', 'Park Presidio Blvd', 'Willard St',
        ],
    ],

    # Marina / Pac Hgts / Fillmore / Nob Hill / North Beach
    [
        # west -> east streets
        [
            'Post St', 'Sutter St', 'Bush St', 'Pine St',
            'California St', 'Sacramento St', 'Clay St',
            'Washington St', 'Jackson St', 'Pacific Ave',
            'Broadway St', 'Vallejo St', 'Green St',
            'Union St', 'Filbert St', 'Greenwich St',
            'Lombard St', 'Chestnut St', 'Francisco St',
            'Bay St', 'North Point St', 'Beach St',
        ],

        # south -> north streets
        [
            'Lyon St', 'Baker St', 'Broderick St', 'Divisadero St',
            'Scott St', 'Pierce St', 'Steiner St', 'Fillmore St',
            'Webster St', 'Buchanan St', 'Laguna St', 'Octavia Blvd', 'Octavia St',
            'Gough St', 'Franklin St', 'Van Ness Ave',
            'Polk St', 'Larkin St', 'Hyde St', 'Leavenworth St',
            'Jones St', 'Taylor St', 'Mason St',
            'Powell St', 'Stockton St', 'Grant Ave',
            'Montgomery St', 'Sansome St',
            'Battery St', 'Front St', 'Davis St', 'Drumm St',
        ],
        # weirdo diagonal streets
        [
            'Columbus Ave', 'The Embarcadero',
        ]
    ],

    # Holly Park Circle
    [
        [
            'Holly Park Cir'
        ],
        [
            'Highland Ave', 'Park St', 'Murray St',
            'Appleton Ave', 'Elsie St', 'Bocana St',
        ]
    ],

    # Laurel Heights
    [
        # west -> east streets
        [
            'Pacific Ave', 'Jackson St', 'Washington St',
            'Clay St', 'Sacramento St', 'California St',
            'Mayfair Dr', 'Euclid Ave', 'Geary Blvd',
            'Anza St', 'Terra Vista Ave', 'Edward St',
            'Anza Vista Ave', 'McAllister St', 'Golden Gate Ave',
        ],

        [
            'Arguello Blvd', 'Cherry St', 'Maple St', 'Spruce St',
            'Locust St', 'Laurel St', 'Walnut St', 'Presidio Ave',
            'Palm Ave', 'Jordan Ave', 'Commonwealth Ave', 'Parker Ave',
            'Collins St', 'Stanyan St',
            'Wood St', 'Beaumont Ave', 'Willard N',
            'Baker St', "St Joseph's Ave"
        ],

    ],

    # I need to bike home from Crocker Amazon, fuuu
    [
        # west->east streets
        [
            'Geneva Ave', 'Amazon Ave', 'Italy Ave', 'France Ave',
            'Russia Ave', 'Persia Ave', 'Brazil Ave', 'Excelsior Ave',
            'Avalon Ave', 'Silver Ave', 'Maynard St', 'Ney St',
            'Trumbull St', 'Alemany Blvd', 'Bosworth St', 'Crescent Ave',
            'Richland Ave', 'Park St', 'Highland Ave', 'Appleton Ave',
            'Randall St', '30th St', 'Day St',
            '29th St', '28th St', '27th St', '26th St', '25th St', '24th St',
            '23rd St', '22nd St', '21st St', '20th St', '19th St', '18th St',
            '17th St', '16th St',
        ],

        # mission st, lol
        [
            'Mission St', 'Dolores St'
        ],
    ],


]

breaks = {

    ##################
    # west -> east streets
    # BREAKS ON WEST SIDE
    ##################
    'Golden Gate Ave': set(['Stanyan St']),
    'McAllister St': set(['Parker Ave']),
    'Grove St': set(['Scott St']),
    'Waller St': set(['Central Ave']),

    'Anza St': set(['32nd Ave']),

    'Pacheco St': set(['41st Ave']),
    'Quintara St': set(['39th Ave']),


    ##############################
    # south -> north streets
    # BREAKS ON SOUTH SIDE
    ##############################


    'Pierce St': set(['Hayes St']),
    'Lyon St': set(['Turk Blvd', 'Oak St']),
    'Central Ave': set(['Oak St']),
    'Ashbury St': set(['Oak St']),
    'Clayton St': set(['Oak St']),
    'Cole St': set(['Oak St']),
    'Shrader St': set(['Oak St']),


    # The Aves (and arguello/funston, lol)
    'Arguello Blvd': set(['Frederick St']),
    '2nd Ave': set(['Lincoln Way']),
    '3rd Ave': set(['Lincoln Way']),
    '4th Ave': set(['Lincoln Way']),
    '5th Ave': set(['Lincoln Way']),
    '6th Ave': set(['Lincoln Way']),
    '7th Ave': set(['Lincoln Way']),
    '8th Ave': set(['Lincoln Way']),
    '9th Ave': set(['Lincoln Way']),
    '10th Ave': set(['Lincoln Way']),
    '11th Ave': set(['Lincoln Way']),
    '12th Ave': set(['Lincoln Way']),
    'Funston Ave': set(['Lincoln Way']),
    '14th Ave': set(['Lincoln Way']),
    '15th Ave': set(['Lincoln Way', 'Lawton St']),
    '16th Ave': set(['Lincoln Way', 'Lawton St']),
    '17th Ave': set(['Lincoln Way']),
    '18th Ave': set(['Lincoln Way']),
    '19th Ave': set(['Lincoln Way']),
    '20th Ave': set(['Lincoln Way']),
    '21st Ave': set(['Lincoln Way']),
    '22nd Ave': set(['Lincoln Way']),
    '23rd Ave': set(['Lincoln Way']),
    '24th Ave': set(['Lincoln Way']),
    '25th Ave': set(['Lincoln Way']),
    '26th Ave': set(['Lincoln Way']),
    '27th Ave': set(['Lincoln Way']),
    '28th Ave': set(['Lincoln Way']),
    '29th Ave': set(['Lincoln Way']),
    '30th Ave': set(['Lincoln Way']),
    '31st Ave': set(['Lincoln Way', 'Balboa St']),
    '32nd Ave': set(['Lincoln Way']),
    '33rd Ave': set(['Lincoln Way']),
    '34th Ave': set(['Lincoln Way']),
    '35th Ave': set(['Lincoln Way']),
    '36th Ave': set(['Lincoln Way']),
    '37th Ave': set(['Lincoln Way']),
    '38th Ave': set(['Lincoln Way', 'Rivera St']),
    '39th Ave': set(['Lincoln Way', 'Quintara St']),
    '40th Ave': set(['Lincoln Way', 'Quintara St']),
    '41st Ave': set(['Lincoln Way']),
    '42nd Ave': set(['Lincoln Way']),
    '43rd Ave': set(['Lincoln Way']),
    '44th Ave': set(['Lincoln Way']),
    '45th Ave': set(['Lincoln Way']),
    '46th Ave': set(['Lincoln Way']),
    '47th Ave': set(['Lincoln Way']),
    '48th Ave': set(['Lincoln Way']),
}



# For curved roads, where we will need to call the google maps
# directions API, define which parts of which paths are curved.
# WEST -> EAST
# SOUTH -> NORTH
curved_roads = {
    'Lawton St': [('16th Ave', 'Funston Ave')],
    '15th Ave': [('Noriega St', 'Lawton St')]
}

# These will be copied straight into the paths json object.
# All addresses in the paths will be looked up and given NEXT
# attributes.
custom_paths = {
    'The Panhandle / SF Bike Route 30': [
        'Baker St and Fell St',
        'San Francisco Bicycle Route 30 and Masonic Ave',
        'San Francisco Bicycle Route 30 and Stanyan St',
    ]


}
