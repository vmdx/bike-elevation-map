/*
    Javascript for The Bike Map.

    Requires:
        - jQuery 1.8.1
        - Google Maps Javascript API V3, with geometry library
*/

var BikeMap = Object();

BikeMap.MAP_OBJECT = null;
BikeMap.CITY_DATA = null;

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

    var map = new google.maps.Map(document.getElementById("map_canvas"), mapOptions);

    $.getJSON(data_file, function(area_data) {
        // For each path/street...
        for (var street in area_data['paths']) {

            // For each intersection on the path/street, draw the path on the
            // map from this intersection to the next intersection.
            for (var index in area_data['paths'][street]) {
                index = parseInt(index);

                var current_intersection = area_data['paths'][street][index];
                var next_intersection = area_data['paths'][street][index+1];
                var current_coords = area_data['intersections'][current_intersection];
                var next_coords = area_data['intersections'][next_intersection];
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
                    area_data['paths'][street][index] == 'BREAK' ||
                    area_data['paths'][street][index+1] == 'BREAK')
                {
                    continue;
                }

                // Set the path of the line to draw - either from Google Directions API,
                // or as a straight line. Also get the distance between these two points.
                var link_name = current_intersection + ' | ' + next_intersection;
                if (area_data['directions'][link_name] != undefined) {
                    var lineCoordinates = google.maps.geometry.encoding.decodePath(area_data['directions'][link_name]['path']);
                    var run_distance = area_data['directions'][link_name]['length'];
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
                var orange = {r:255, g:123, b:0};
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
                var line = new google.maps.Polyline({
                  path: lineCoordinates,
                  strokeColor: color,
                  strokeOpacity: 0.5,
                  strokeWeight: 8,
                  map: map
                });

                var arrows = new google.maps.Polyline({
                  path: lineCoordinates,
                  icons: [{
                    icon: lineSymbol,
                    offset: '0',
                    repeat: '20px'
                  }],
                  strokeOpacity: 0.5,
                  strokeWeight: 1,
                  map: map
                });
            }
        }
    });
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
    var current_city = $('#city-tag').text();
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
