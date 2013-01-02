/*
    Javascript for The Bike Map.

    Requires:
        - jQuery 1.8.1
        - Google Maps Javascript API V3, with geometry library
*/

var BikeMap = Object();

BikeMap.MAP_OBJECT = null;
BikeMap.CITY_DATA = null;

BikeMap.ALL_PATH_LINES = [];
BikeMap.MAJOR_PATH_LINES = [];
BikeMap.MAJOR_PATH_LINES_ZOOMED_IN = [];
BikeMap.SEARCH_PATH_LINES = [];
BikeMap.DOWNHILL_ARROWS = [];

BikeMap.MAP_STYLE = [
    {
        featureType: "all",
        stylers: [
        ]
    },
    {
        featureType: "road.arterial",
        elementType: "geometry",
        stylers: [
            { hue: "#FFFFFF" },
            { saturation: 50 },
            { lightness: 100 }
        ]
    },
    {
        featureType: "road.highway",
        elementType: "all",
        stylers: [
            { visibility: "off" },
        ]
    },
    {
        featureType: "road.arterial",
        elementType: "labels.text.stroke",
        stylers: [
            { visibility: "off" },
        ]
    },
];

$(window).resize(function() {$('#map_canvas').height($(window).height() - 80);});

BikeMap.drawMap = function(data_file, center_lat, center_lng) {

    var mapOptions = {
        center: new google.maps.LatLng(center_lat, center_lng),
        zoom: 13,
        mapTypeControl: true,
        mapTypeControlOptions: {
            mapTypeIds: [google.maps.MapTypeId.ROADMAP, google.maps.MapTypeId.HYBRID],
            position: google.maps.ControlPosition.RIGHT_BOTTOM,
        },
        mapTypeId: google.maps.MapTypeId.ROADMAP,
        styles: BikeMap.MAP_STYLE,
    };

    // Set Map height
    $('#map_canvas').height($(window).height() - 80);

    BikeMap.MAP_OBJECT = new google.maps.Map(document.getElementById("map_canvas"), mapOptions);

    $.getJSON(data_file, function(area_data) {
        BikeMap.CITY_DATA = area_data;
        // For each path/street...
        for (var street in area_data['paths']) {

            BikeMap.drawPolylinesForIntersections(area_data['paths'][street], false);

        }


        // Also initialize the typeahead directions boxes
        $('#search-start').typeahead({
            source: Object.keys(BikeMap.CITY_DATA['intersections']),
            minLength: 3,
            // Matching - case insensitive, word by word. (i.e. 'mcall brod' will match "McAllister St and Broderick St")
            matcher: function(item) {
                var words = this.query.split(' ');
                for (var i=0; i<words.length; i++) {
                    var word = words[i].toLowerCase();
                    if (item.toLowerCase().indexOf(word) == -1) {
                        return false;
                    }
                }
                return true;
            },
        });
        $('#search-dest').typeahead({
            source: Object.keys(BikeMap.CITY_DATA['intersections']),
            minLength: 3,
            matcher: function(item) {
                var words = this.query.split(' ');
                for (var i=0; i<words.length; i++) {
                    var word = words[i].toLowerCase();
                    if (item.toLowerCase().indexOf(word) == -1) {
                        return false;
                    }
                }
                return true;
            },
        });

    });

    /* Set up map event listeners
    */
    google.maps.event.addListener(BikeMap.MAP_OBJECT, 'zoom_changed', function() {

        var zoom_level = BikeMap.MAP_OBJECT.getZoom();

        if (zoom_level >= 15) {
            BikeMap.showPolylines(BikeMap.MAJOR_PATH_LINES_ZOOMED_IN);
            BikeMap.clearPolylines(BikeMap.MAJOR_PATH_LINES);
        }
        else {
            BikeMap.clearPolylines(BikeMap.MAJOR_PATH_LINES_ZOOMED_IN);
            BikeMap.showPolylines(BikeMap.MAJOR_PATH_LINES);
        }

    });

}


BikeMap.drawPolylinesForIntersections = function(intersections, search_bool) {

    for (var i in intersections) {
        // Lists that come out of JSON seem to have string numbered indices... yuck.
        i = parseInt(i);

        /*
            If any of the following are true, we skip drawing the
            path from this intersection to the next.
                - there is no lat/lng/elevation info for this, or the next,
                intersection
                - this intersection is a "BREAK"
                - the next intersection is a "BREAK"
        */
        var current_intersection = intersections[i];
        var next_intersection = intersections[i+1];
        if (current_intersection == '--BREAK' ||
            next_intersection == '--BREAK')
        {
            continue;
        }
        var current_coords = BikeMap.CITY_DATA['intersections'][current_intersection];
        var next_coords = BikeMap.CITY_DATA['intersections'][next_intersection];
        if (current_coords == undefined ||
            next_coords == undefined)
        {
            continue;
        }

        // Set the path type based on route directives.
        var link_index = current_intersection + ' | ' + next_intersection;
        var flip_link = next_intersection + ' | ' + current_intersection;
        // If both are undefined, we assume standard.
        var path_type = BikeMap.CITY_DATA['route_directives'][link_index] || BikeMap.CITY_DATA['route_directives'][flip_link] || 'standard';

        // Set the path of the line to draw - either from Google Directions API,
        // or as a straight line. Also get the distance between these two points.
        var link_name = current_intersection + ' | ' + next_intersection;
        var flip_link = next_intersection + ' | ' + current_intersection;
        if (BikeMap.CITY_DATA['directions'][link_name] != undefined) {
            var lineCoordinates = google.maps.geometry.encoding.decodePath(BikeMap.CITY_DATA['directions'][link_name]['path']);
            var run_distance = BikeMap.CITY_DATA['directions'][link_name]['length'];
        }
        else if (BikeMap.CITY_DATA['directions'][flip_link] != undefined) {
            var lineCoordinates = google.maps.geometry.encoding.decodePath(BikeMap.CITY_DATA['directions'][flip_link]['path']);
            var run_distance = BikeMap.CITY_DATA['directions'][flip_link]['length'];
        }
        else {
            var lineCoordinates = [
                new google.maps.LatLng(current_coords['lat'], current_coords['lng']),
                new google.maps.LatLng(next_coords['lat'], next_coords['lng']),
            ];
            var run_distance = google.maps.geometry.spherical.computeDistanceBetween(lineCoordinates[0], lineCoordinates[1]);
        }

        // Check if the path is uphill or downhill, and define an arrow symbol accordingly
        /* ARROWS POINT DOWNHILL */
        var arrowPoint = google.maps.SymbolPath.FORWARD_OPEN_ARROW;
        var arrowLocation = '100%';

        if (current_coords['elevation'] < next_coords['elevation']) { // uphill
            arrowPoint = google.maps.SymbolPath.BACKWARD_OPEN_ARROW;
            arrowLocation = '0%';
        }

        // Calculate the slope and define the color of the line
        var elevation_diff = Math.abs(current_coords['elevation'] - next_coords['elevation']);

        var grade = elevation_diff / run_distance * 100;
        var grade_div_5 = Math.floor(grade / 5);
        var grade_mod_5_div_5 = grade % 5 / 5;

        /*
            0-5 % grade: green to yellow
            5-10 % grade: yellow to orange
            10-15 % : orange to red
            15+% red

            example grades:
                McAllister (Divis to Brod) - 6.2%
                Broderick (Fulton to McAllister) - 8.5%
                Baker (Fulton to McAllister) - 4.7%
        */

        var color = "#FF0000"; // default red
        var green = {r:0, g: 255, b: 0};
        var yellow = {r:255, g:255, b:0};
        var orange = {r:255, g:171, b:0};
        var red = {r: 255, g: 0, b: 0};

        switch(grade_div_5) {
        case 0:
            color = BikeMap.makeGradientColor(green, yellow, grade_mod_5_div_5);
            break;
        case 1:
            color = BikeMap.makeGradientColor(yellow, orange, grade_mod_5_div_5);
            break;
        case 2:
            color = BikeMap.makeGradientColor(orange, red, grade_mod_5_div_5);
            break;
        }


        var opacity = 0.3;
        var weight = 5;

        /* Symbols for use in line drawing */

        if (search_bool) {
            var dashedLineSymbol = {
              path: 'M 0,-1 0,1',
              strokeOpacity: 1,
              strokeColor: 'black',
              scale: 2
            };

            BikeMap.SEARCH_PATH_LINES.push(
                new google.maps.Polyline({
                    path: lineCoordinates,
                    icons: [{
                        icon: dashedLineSymbol,
                        offset: 0,
                        repeat: '10px'
                    }],
                    strokeOpacity: 0.0,
                    strokeWeight: weight,
                    map: BikeMap.MAP_OBJECT
                })
            );

        }
        else {
            if (path_type == 'route' || path_type == 'path') {
                // Make borders on paths
                var borderColor = 'blue';
                if (path_type == 'route') {
                    borderColor = 'violet';
                }
                var borderBottomSymbol = {
                  path: 'M 2.5,-1 2.5,1',
                  strokeOpacity: 1,
                  strokeColor: borderColor,
                  scale: 2
                };
                var borderTopSymbol = {
                  path: 'M -2.5,-1 -2.5,1',
                  strokeOpacity: 1,
                  strokeColor: borderColor,
                  scale: 2

                };
                var dashedLineSymbol = {
                  path: 'M 0,-1 0,1',
                  strokeOpacity: 1,
                  strokeColor: borderColor,
                  scale: 2
                };


                BikeMap.MAJOR_PATH_LINES_ZOOMED_IN.push(
                    new google.maps.Polyline({
                        path: lineCoordinates,
                        icons: [{
                            icon: borderTopSymbol,
                            offset: 0,
                            repeat: '2px'
                        }, {
                            icon: borderBottomSymbol,
                            offset: 0,
                            repeat: '2px'
                        }],
                        strokeOpacity: 0.0,
                        strokeWeight: weight,
                        map: null
                    })
                );

                BikeMap.MAJOR_PATH_LINES.push(
                    new google.maps.Polyline({
                        path: lineCoordinates,
                        icons: [{
                            icon: dashedLineSymbol,
                            offset: 0,
                            repeat: '2px'
                        }],
                        zIndex: 100,
                        strokeOpacity: 0.0,
                        strokeWeight: weight,
                        map: BikeMap.MAP_OBJECT
                    })
                );

            }


            // Draw two lines - the colored line, and the downhill/uphill arrow line
            BikeMap.ALL_PATH_LINES.push(
                new google.maps.Polyline({
                    path: lineCoordinates,
                    strokeColor: color,
                    strokeOpacity: opacity,
                    strokeWeight: weight,
                    map: BikeMap.MAP_OBJECT
                })
            );

            var lineSymbol = {
              path: arrowPoint,
              strokeOpacity: 1.0,
              strokeWeight: 1,
              strokeColor: 'black',
              //fillColor: 'black',
              //fillOpacity: 0.8,
              // https://developers.google.com/maps/documentation/javascript/reference#Symbol
            };

            BikeMap.DOWNHILL_ARROWS.push(
                new google.maps.Polyline({
                    path: lineCoordinates,
                    icons: [{
                        icon: lineSymbol,
                        offset: '50%',
                        repeat: '75px'
                    }],
                    strokeOpacity: 0.0,
                    strokeWeight: 1,
                    map: null
                })
            );
        }
    }

}

BikeMap.clearPolylines = function(array) {
    for (var i in array) {
        array[i].setMap(null);
    }
}

BikeMap.showPolylines = function(array) {
    for (var i in array) {
        array[i].setMap(BikeMap.MAP_OBJECT);
    }
}


/* http://stackoverflow.com/questions/8732401/how-to-figure-out-all-colors-in-a-gradient */
BikeMap.makeGradientColor = function (color1, color2, percent) {
    var newColor = {};

    function makeChannel(a, b) {
        return(a + Math.round((b-a)*(percent)));
    }

    function makeColorPiece(num) {
        num = Math.min(num, 255);   // not more than 255
        num = Math.max(num, 0);     // not less than 0
        var str = num.toString(16);
        if (str.length < 2) {
            str = "0" + str;
        }
        return(str);
    }

    newColor.r = makeChannel(color1.r, color2.r);
    newColor.g = makeChannel(color1.g, color2.g);
    newColor.b = makeChannel(color1.b, color2.b);
    newColor.cssColor = "#" +
                        makeColorPiece(newColor.r) +
                        makeColorPiece(newColor.g) +
                        makeColorPiece(newColor.b);
    return newColor.cssColor;
}

BikeMap.Navigation = Object();
BikeMap.Navigation.Map = [
    {'name': '* Home Page', 'link': '/'},
    {'name': '-----'},
    {'name': 'San Francisco, CA', 'link': '/sf.html'},
    {'name': 'Berkeley, CA', 'link': '/berkeley.html'}
];

BikeMap.Navigation.renderDropdown = function() {
    var current_city = $.trim($('#city-tag').text());
    var dropdown = $('#nav-dropdown');
    for (var entry in BikeMap.Navigation.Map) {
        var option = $('<option/>', {text: BikeMap.Navigation.Map[entry]['name']});
        if (BikeMap.Navigation.Map[entry]['link'] == undefined) {
            option.attr('disabled', 'disabled');
        }
        else {
            option.val(BikeMap.Navigation.Map[entry]['link']);
        }
        if (current_city == BikeMap.Navigation.Map[entry]['name']) {
            option.attr('selected', 'selected');
        }
        dropdown.append(option);
    }

    dropdown.change(function () {
        var destination = $("#nav-dropdown option:selected").text();
        document.location.href = $("#nav-dropdown option:selected").val();
    });

    $('#expand-nav').mouseenter(function() {
        $('#city-tag').hide();
        $('#nav-dropdown').show();
    });

    $('#nav-dropdown').mouseleave(function() {
        $('#nav-dropdown').hide();
        $('#city-tag').show();
    });
}

BikeMap.Navigation.setupToggles = function() {
    var toggleConfig = {
        style: {
            // Accepted values ["primary", "danger", "info", "success", "warning"] or nothing
            enabled: "success",
            disabled: "danger"
        },
        height: 18,
        width: 85,
        font: {
            'line-height': '18px',
            'font-size': '14px',
        }
    };

    var pathsFunc = function ($el, status, e) {
        if (status == true) {
            BikeMap.showPolylines(BikeMap.ALL_PATH_LINES);
        }
        else {
            BikeMap.clearPolylines(BikeMap.ALL_PATH_LINES);
        }
    };

    var majorsFunc = function ($el, status, e) {
        if (status == true) {
            // Get map zoom level
            var zoom_level = BikeMap.MAP_OBJECT.getZoom();

            if (zoom_level >= 15) {
                BikeMap.showPolylines(BikeMap.MAJOR_PATH_LINES_ZOOMED_IN);
                BikeMap.clearPolylines(BikeMap.MAJOR_PATH_LINES);
            }
            else {
                BikeMap.clearPolylines(BikeMap.MAJOR_PATH_LINES_ZOOMED_IN);
                BikeMap.showPolylines(BikeMap.MAJOR_PATH_LINES);
            }
        }
        else {
            BikeMap.clearPolylines(BikeMap.MAJOR_PATH_LINES);
            BikeMap.clearPolylines(BikeMap.MAJOR_PATH_LINES_ZOOMED_IN);
        }
    };

    var hillsFunc = function ($el, status, e) {
        if (status == true) {
            BikeMap.showPolylines(BikeMap.DOWNHILL_ARROWS);
        }
        else {
            BikeMap.clearPolylines(BikeMap.DOWNHILL_ARROWS);
        }
    };

    toggleConfig['onChange'] = pathsFunc;
    $('#paths-toggle-button').toggleButtons(toggleConfig);
    toggleConfig['onChange'] = majorsFunc;
    $('#majors-toggle-button').toggleButtons(toggleConfig);
    toggleConfig['onChange'] = hillsFunc;
    $('#hills-toggle-button').toggleButtons(toggleConfig);
}

BikeMap.Search = Object();

BikeMap.Search.AStarSearchWrapper = function() {

    // Clear out any previous searches
    BikeMap.clearPolylines(BikeMap.SEARCH_PATH_LINES);
    // Remove references.
    BikeMap.SEARCH_PATH_LINES = [];

    var start = $('#search-start').val();
    var goal = $('#search-dest').val();
    // TODO: Do some validation, here.
    var path = BikeMap.Search.AStarSearch(start, goal);
    //console.log(path);
    BikeMap.drawPolylinesForIntersections(path, true);

}

BikeMap.Search.AStarSearch = function(start, goal) {
    var closed_set = {};
    var open_set = {};
    open_set[start] = true;
    var came_from = {};

    var g_scores = {};
    g_scores[start] = 0;
    var f_scores = {};
    f_scores[start] = BikeMap.Search.AStarHeuristic(start, goal);

    while (Object.keys(open_set).length > 0) {
        var current = BikeMap.Search.GetLowestFScoreNode(open_set, f_scores);
        if (current == goal) {
            return BikeMap.Search.AStarReconstructPath(came_from, goal);
        }

        delete open_set[current];
        closed_set[current] = true;

        var neighbors = BikeMap.Search.GetNeighbors(current);
        //console.log(neighbors);
        for (var i=0; i < neighbors.length; i++) {
            var neighbor = neighbors[i];
            if (neighbor in closed_set) {
                continue;
            }
            var tentative_g_score = g_scores[current] + BikeMap.Search.CostFunction(current, neighbor);
            if (!(neighbor in open_set) || tentative_g_score <= g_scores[neighbor]) {
                came_from[neighbor] = current;
                g_scores[neighbor] = tentative_g_score;
                f_scores[neighbor] = g_scores[neighbor] + BikeMap.Search.AStarHeuristic(neighbor, goal);
                if (!(neighbor in open_set)) {
                    open_set[neighbor] = true;
                }
            }
        }
    }

    return false; // FAILURE

}

BikeMap.Search.AStarReconstructPath = function(came_from, node) {
    if (node in came_from) {
        var path = BikeMap.Search.AStarReconstructPath(came_from, came_from[node]);
        return path.concat([node]);
    }
    else {
        return [node];
    }
}

BikeMap.Search.GetNeighbors = function(intersection) {
    var paths = intersection.split(' and ');
    var neighbors = [];
    if (paths.length != 2) {
        console.warn('weird intersection did not split: ' + intersection);
        return neighbors;
    }

    // Add all the custom paths to the check.
    paths = paths.concat(BikeMap.CITY_DATA['custom_path_names']);

    for (var i=0; i < paths.length; i++) {
        // Whew, what a mess. TODO: needs refactor
        var path = paths[i];
        if (BikeMap.CITY_DATA['paths'][path] == undefined) {
            continue;
        }

        var intersection_index = BikeMap.CITY_DATA['paths'][path].indexOf(intersection);
        if (intersection_index == -1) {
            continue;
        }
        var next_intersection = BikeMap.CITY_DATA['paths'][path][intersection_index + 1];
        var prev_intersection = BikeMap.CITY_DATA['paths'][path][intersection_index - 1];
        if (next_intersection != undefined && next_intersection != '--BREAK' && neighbors.indexOf(next_intersection) == -1) {
            neighbors.push(next_intersection);
        }
        if (prev_intersection != undefined && prev_intersection != '--BREAK' && neighbors.indexOf(prev_intersection) == -1) {
            neighbors.push(prev_intersection);
        }
    }

    return neighbors;
}

BikeMap.Search.GetLowestFScoreNode = function(open_set, f_scores) {
    var min = null;
    var min_node = null;
    for (var node in open_set) {
        if (min == null || f_scores[node] < min) {
            min = f_scores[node];
            min_node = node;
        }
    }
    return min_node;
}

/*
the COST is elevation_diff between two points, 0
    if downhill, elevation_diff * some scaling factor (exponential)

NOTE: THIS WORKS BADLY BECAUSE GOING DOWNHILL AND AWAY FROM YOUR GOAL IS ZERO COST, WHICH IS
WRONG.
*/
BikeMap.Search.CostFunction = function(start, dest) {
    var start_elevation = BikeMap.CITY_DATA['intersections'][start]['elevation'];
    var dest_elevation = BikeMap.CITY_DATA['intersections'][dest]['elevation'];

    var elevation_diff = dest_elevation - start_elevation;
    var elevation_diff_zero_cost_downhill = Math.min(elevation_diff, 0);

    var link_name = start + ' | ' + dest;
    if (BikeMap.CITY_DATA['directions'][link_name] != undefined) {
        var run_distance = BikeMap.CITY_DATA['directions'][link_name]['length'];
    }
    else {
        var start_latlng = new google.maps.LatLng(BikeMap.CITY_DATA['intersections'][start]['lat'], BikeMap.CITY_DATA['intersections'][start]['lng']);
        var dest_latlng = new google.maps.LatLng(BikeMap.CITY_DATA['intersections'][dest]['lat'], BikeMap.CITY_DATA['intersections'][dest]['lng']);

        var run_distance = google.maps.geometry.spherical.computeDistanceBetween(start_latlng, dest_latlng);
    }

    /* To preserve heuristic optimism, add in scalar PENALTIES (> 1) for not using bike paths, big hills, etc. */
    var grade_penalty = 1.0;
    if (elevation_diff > 0) {
        var grade = elevation_diff / run_distance * 100;
        if (grade > 2) {
            grade_penalty = 1.10;
        }
        if (grade > 6) {
            grade_penalty = 2.0;
        }
        if (grade > 10) {
            grade_penalty = 3.0;
        }
    }


    // Check for bike path
    var link_index = start + ' | ' + dest;
    var flip_link = dest + ' | ' + start;
    // If both are undefined, we assume standard.
    var path_type = BikeMap.CITY_DATA['route_directives'][link_index] || BikeMap.CITY_DATA['route_directives'][flip_link] || 'standard';
    switch(path_type) {
        case 'path':
            var non_bike_path_penalty = 1.0;
            break;
        case 'route':
            var non_bike_path_penalty = 1.05;
            break;
        case 'standard':
            var non_bike_path_penalty = 1.15;
            break;
    }

    return non_bike_path_penalty * grade_penalty * Math.sqrt(Math.pow(run_distance, 2) + Math.pow(Math.min(0, elevation_diff_zero_cost_downhill), 2));
}

/* The heuristic is PYTHAGOREAN DISTANCE:
    flat distance ^ 2 + min(0, elevation diff) ^ 2 = heuristic ^ 2

   This MUST BE OPTIMISTIC to the cost function - never overestimating.
   Why 0 on elevation diff? Since downhill has a 0 cost.
   */
BikeMap.Search.AStarHeuristic = function(start, goal) {
    var start_coords = BikeMap.CITY_DATA['intersections'][start];
    var goal_coords = BikeMap.CITY_DATA['intersections'][goal];

    var start_latlng = new google.maps.LatLng(start_coords['lat'], start_coords['lng']);
    var goal_latlng = new google.maps.LatLng(goal_coords['lat'], goal_coords['lng']);

    var run_distance = google.maps.geometry.spherical.computeDistanceBetween(start_latlng, goal_latlng);

    var elevation_diff = goal_coords['elevation'] - start_coords['elevation'];

    return Math.sqrt(Math.pow(run_distance, 2) + Math.pow(Math.min(0, elevation_diff), 2));
}

/*
    Snippets of code that may be useful in the future

                // for each point, add a marker that shows up only on mouseover.
                var marker = new google.maps.Marker({
                    map: map,
                    position: new google.maps.LatLng(current_coords['lat'], current_coords['lng']),
                    title: area_data['paths'][street][index],
                    visible: true,
                    icon: {
                        path: google.maps.SymbolPath.CIRCLE,
                        scale: 1
                    }
                });
                google.maps.event.addListener(marker, 'mouseover', function(event) { this.setOptions({visible: true}); });
                google.maps.event.addListener(marker, 'mouseout', function(event) { this.setOptions({visible: false}); });

    //var styledMap = new google.maps.StyledMapType(onlyRoadLabelStyles, {name: "Styled Map"});
    //map.overlayMapTypes.insertAt(0, styledMap);

    // Overlay the road labels
    var onlyRoadLabelStyles = [
        {
            featureType: "all",
            elementType: "labels",
            stylers: [
                { visibility: "on" }
            ]
        },{
            featureType: "all",
            elementType: "geometry",
            stylers: [
                { visibility: "off" }
            ]
        }
    ];


                if (street == 'The Panhandle / SF Bike Route 30') {
                    console.log(elevation_diff, run_distance);
                    console.log(area_data['paths'][street][index]);
                    console.log(area_data['paths'][street][index+1]);
                    console.log(elevation_diff / run_distance * 100);
                    console.log('----')

                }
                //console.log(elevation_diff, run_distance);
                //console.log(area_data['paths'][street][index]);
                //console.log(area_data['paths'][street][index+1]);
                //console.log(elevation_diff / run_distance * 100);
                //console.log('----')


*/
