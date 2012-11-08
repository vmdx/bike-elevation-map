"""
Breaks are defined as intersections where there should be
no path connecting that intersection with the next one.

Breaks always go from west -> east, or south -> north.

For example: there is a break on 2nd Ave at Lincoln Way, since
you can't get to 2nd Ave @ Fulton (the next intersection)
without taking a turn. Lincoln is the south intersection, hence,
south -> north.

XXX: TODO: consider use of a defaultdict here.
"""

city = 'San Francisco, CA'

paths = [
    # SF main west->east streets
    {
        # Haight/NOPA
        'Geary Blvd': {'breaks': set([])},
        "O'Farrell St": {'breaks': set([])},
        "Turk St": {'breaks': set([])},
        "Turk Blvd": {'breaks': set([])},
        'Ellis St': {'breaks': set([])},
        'Eddy St': {'breaks': set([])},
        'Turk St': {'breaks': set([])},
        'Golden Gate Ave': {'breaks': set([])},
        'McAllister St': {'breaks': set([])},
        'Fulton St': {'breaks': set([])},
        'Grove St': {'breaks': set([])},
        'Hayes St': {'breaks': set([])},
        'Fell St': {'breaks': set([])},
        'Oak St': {'breaks': set([])},
        'Page St': {'breaks': set([])},
        'Haight St': {'breaks': set([])},
        'Waller St': {'breaks': set(['Central Ave'])},
    },
    # SF main south->north streets
    {
        'Pierce St': {'breaks': set(['Hayes St'])},
        'Scott St': {'breaks': set([])},
        # Div -> Masonic
        'Divisadero St': {'breaks': set([])},
        "Broderick St": {'breaks': set([])},
        'Baker St': {'breaks': set([])},
        'Lyon St': {'breaks': set(['Turk Blvd', 'Oak St'])},
        'Central Ave': {'breaks': set(['Oak St'])},
        'Masonic Ave': {'breaks': set([])},
    }
]

