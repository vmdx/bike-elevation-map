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
BikeMap.SEARCH_PATH_LINES = [];

BikeMap.MAP_STYLE = [
    {
        featureType: "all",
        stylers: [
            { saturation: -40 }
        ]
    },
    {
        featureType: "road.arterial",
        elementType: "geometry",
        stylers: [
            { hue: "#00ffee" },
            { saturation: 50 }
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

            BikeMap.drawPolylinesForIntersections(area_data['paths'][street], BikeMap.ALL_PATH_LINES);

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

}


BikeMap.drawPolylinesForIntersections = function(intersections, dest_array) {

    for (var i in intersections) {
        // Lists that come out of JSON seem to have string numbered indices... yuck.
        i = parseInt(i);

        //var current_intersection = BikeMap.CITY_DATA['paths'][street][index];
        //var next_intersection = BikeMap.CITY_DATA['paths'][street][index+1];
        var current_intersection = intersections[i];
        var next_intersection = intersections[i+1];
        var current_coords = BikeMap.CITY_DATA['intersections'][current_intersection];
        var next_coords = BikeMap.CITY_DATA['intersections'][next_intersection];
        /*
            If any of the following are true, we skip drawing the
            path from this intersection to the next.
                - there is no lat/lng/elevation info for this, or the next,
                intersection
                - this intersection is a "BREAK"
                - the next intersection is a "BREAK"
        */
        if (current_coords == undefined ||
            next_coords == undefined ||
            current_intersection == 'BREAK' ||
            next_intersection == 'BREAK')
        {
            continue;
        }

        // Set the path of the line to draw - either from Google Directions API,
        // or as a straight line. Also get the distance between these two points.
        var link_name = current_intersection + ' | ' + next_intersection;
        if (BikeMap.CITY_DATA['directions'][link_name] != undefined) {
            var lineCoordinates = google.maps.geometry.encoding.decodePath(BikeMap.CITY_DATA['directions'][link_name]['path']);
            var run_distance = BikeMap.CITY_DATA['directions'][link_name]['length'];
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

        var lineSymbol = {
          path: arrowPoint
          // https://developers.google.com/maps/documentation/javascript/reference#Symbol
        };

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


        // Draw two lines - the colored line, and the downhill/uphill arrow line
        dest_array.push(
            new google.maps.Polyline({
                path: lineCoordinates,
                strokeColor: color,
                strokeOpacity: 0.5,
                strokeWeight: 8,
                map: BikeMap.MAP_OBJECT
            })
        );

        dest_array.push(
            new google.maps.Polyline({
                path: lineCoordinates,
                icons: [{
                    icon: lineSymbol,
                    offset: '0',
                    repeat: '20px'
                }],
                strokeOpacity: 0.5,
                strokeWeight: 1,
                map: BikeMap.MAP_OBJECT
            })
        );
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
    {'name': 'California'},
    {'name': 'San Francisco, CA', 'link': '/sf.html'},
    {'name': 'Berkeley, CA', 'link': '/berkeley.html'}
];

BikeMap.Navigation.renderDropdown = function() {
    var current_city = $.trim($('#city-tag').text());
    console.log(current_city);
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

    $("input[name='path-control-radio']").change(function() {
        console.log("changed");
        if ($("input[name='path-control-radio']:checked").val() == 'clear') {
            BikeMap.clearPolylines(BikeMap.ALL_PATH_LINES);
            BikeMap.clearPolylines(BikeMap.SEARCH_PATH_LINES);
        }
        else if ($("input[name='path-control-radio']:checked").val() == 'all') {
            BikeMap.showPolylines(BikeMap.ALL_PATH_LINES);
        }
    });
}

BikeMap.Search = Object();

BikeMap.Search.AStarSearchWrapper = function() {

    BikeMap.clearPolylines(BikeMap.ALL_PATH_LINES);
    BikeMap.clearPolylines(BikeMap.SEARCH_PATH_LINES);

    var start = $('#search-start').val();
    var goal = $('#search-dest').val();
    // TODO: Do some validation, here.
    var path = BikeMap.Search.AStarSearch(start, goal);
    BikeMap.drawPolylinesForIntersections(path, BikeMap.SEARCH_PATH_LINES);

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
            console.log(f_scores);
            console.log(g_scores);
            return BikeMap.Search.AStarReconstructPath(came_from, goal);
        }

        delete open_set[current];
        closed_set[current] = true;

        var neighbors = BikeMap.Search.GetNeighbors(current);
        console.log(neighbors);
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
        console.log('weird intersection did not split: ' + intersection);
        return neighbors;
    }

    for (var i=0; i < paths.length; i++) {
        // Whew, what a mess. TODO: needs refactor
        var path = paths[i];
        var intersection_index = BikeMap.CITY_DATA['paths'][path].indexOf(intersection);
        if (intersection_index == -1) {
            continue;
        }
        var next_intersection = BikeMap.CITY_DATA['paths'][path][intersection_index + 1];
        var prev_intersection = BikeMap.CITY_DATA['paths'][path][intersection_index - 1];
        // can't travel across breaks (later: major delineation?)
        if (next_intersection == 'BREAK') {
            //next_intersection = BikeMap.CITY_DATA['paths'][path][intersection_index + 2];
        }
        if (prev_intersection == 'BREAK') {
           // prev_intersection = BikeMap.CITY_DATA['paths'][path][intersection_index - 2];
        }
        if (next_intersection != undefined && next_intersection != 'BREAK' && neighbors.indexOf(next_intersection) == -1) {
            neighbors.push(next_intersection);
        }
        if (prev_intersection != undefined && prev_intersection != 'BREAK' && neighbors.indexOf(prev_intersection) == -1) {
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


    if (dest_elevation < start_elevation) {
        return 0;
    }

    /* TBD: Calculate grade, factor in a constant for slope that penalizes steep hills */
    var link_name = start + ' | ' + dest;
    if (BikeMap.CITY_DATA['directions'][link_name] != undefined) {
        var run_distance = BikeMap.CITY_DATA['directions'][link_name]['length'];
    }
    else {
        var start_latlng = new google.maps.LatLng(BikeMap.CITY_DATA['intersections'][start]['lat'], BikeMap.CITY_DATA['intersections'][start]['lng']);
        var dest_latlng = new google.maps.LatLng(BikeMap.CITY_DATA['intersections'][dest]['lat'], BikeMap.CITY_DATA['intersections'][dest]['lng']);

        var run_distance = google.maps.geometry.spherical.computeDistanceBetween(start_latlng, dest_latlng);
    }

    return dest_elevation - start_elevation + run_distance;

}

BikeMap.Search.AStarHeuristic = function(start, goal) {
    console.log(start);
    console.log(goal);
    var start_coords = BikeMap.CITY_DATA['intersections'][start];
    var goal_coords = BikeMap.CITY_DATA['intersections'][goal];

    var start_latlng = new google.maps.LatLng(start_coords['lat'], start_coords['lng']);
    var goal_latlng = new google.maps.LatLng(goal_coords['lat'], goal_coords['lng']);

    var run_distance = google.maps.geometry.spherical.computeDistanceBetween(start_latlng, goal_latlng);


    return goal_coords['elevation'] - start_coords['elevation'] + run_distance;
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
