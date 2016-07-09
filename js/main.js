/* ViewModel Class
 * This class represents the viewmodel.  It controls the interactions
 * between the view(HTML) and the model(Data).
 */
var ViewModel = function() {
    var self = this;
    self.map = null; //Google map Map object
    self.latlong = null; //Google map LatLng object
    self.infowindow = new google.maps.InfoWindow(); //Google map info window object
    self.locations = ko.observableArray([]); //identifes a list of all locations
    self.filteredLocations = ko.observableArray([]); //identifies a list of filtered locations
    self.locationTypes = ko.observableArray([]); //identifies a list of available location types
    self.selectedLocationType = ko.observable(); //identifies the which location type has been selected
    self.showMap = ko.observable(true); //determines whether to show of hide the map
    self.showList = ko.observable(false); //determines whether to show or hide the list of locations
    self.selectedPlaceId = ko.observable(false); //identifies the place_id of the seclected location from the list view

    /* initializeMap function*/
    self.initializeMap = function() {
        self.latlong = new google.maps.LatLng(40.7619876, -73.9224464);

        var mapOptions = {
            center: self.latlong,
            zoom: 14, //Set the zoom for the initial load of the map
            panControl: true,
            panControlOptions: {
                position: google.maps.ControlPosition.RIGHT_BOTTOM
            },
            zoomControl: true,
            zoomControlOptions: {
                position: google.maps.ControlPosition.RIGHT_BOTTOM
            },
            scaleControl: true,
            streetViewControl: true,
            streetViewControlOptions: {
                position: google.maps.ControlPosition.RIGHT_BOTTOM
            }
        };
        self.map = new google.maps.Map(document.getElementById('map-canvas'), mapOptions);
        self.searchLocations();
        self.map.setCenter(self.latlong);
    };

    /* searchLocations function
     * This functions uses Google Places Service to locate businesses with the
     * following types: store,bar,food,restaurant,cafe,spa,pharmacy.
     * Goolgle's nearbySearch method will then call the locationCallback services once
     * the locations have been retrieved.
     */
    self.searchLocations = function() {
        var request = {
            location: self.latlong,
            radius: 900,
            types: ['store', 'bar', 'food', 'restaurant', 'cafe', 'spa', 'pharmacy']

        };

        var service = new google.maps.places.PlacesService(self.map);
        service.nearbySearch(request, self.locationCallback);
    };



    /* locationCallback function

     * This function receives an array of places search results and a stautus
     * If the stautus is ok, it will loop through all the place results, and first
     * create a marker, then create a location model using the marker and place result,
     * retrieve additional details from Yellow Pages API,set the data in the location model.
     * and adds the location to the locations observable array. It then filters out a unique
     * set of location types from each location's type array into a temporary working array.
     * It then adds an 'all' location type to represent all locations, copies the
     * values from the temporary array into a knockout observable array of location types, sorts the types
     * and notifies all listeners that the location types array has been updated.  Finally it sets the
     * selectedLocationType observable to 'all'.
     */
    self.locationCallback = function(results, status) {
        var marker;
        var location;
        var tempTypes = [];
        if (status == google.maps.places.PlacesServiceStatus.OK) {
            for (var i = 0; i < results.length; i++) {
                marker = self.createMarker(results[i]);
                location = new Location(results[i], marker);
                self.setYellowPageInfo(location);
                self.locations.push(location);
                tempTypes = tempTypes.concat(location.types.filter(function(item) {
                    return tempTypes.indexOf(item) < 0;
                }));
            }
            tempTypes.unshift("all");
            ko.utils.arrayPushAll(self.locationTypes(), tempTypes);
            self.locationTypes.sort();
            self.locationTypes.valueHasMutated();
            self.selectedLocationType("all");
        }
    };

    /* createMarker function

     * This function takes a Google PlaceResult object retrieved
     * from a Google Places Service search and creates a marker
     * obect.  It also creates a Google Map infowindow by calling the
     * getInfoWindowContent method to first retrieve the infowindow's
     * content and then using the infowindow in the marker's
     * click event.  It returns the a marker.
     */
    self.createMarker = function(placeResult) {
        var infoWindoContent = getInfoWindowContent(placeResult);
        var marker = new google.maps.Marker({
            map: self.map,
            position: placeResult.geometry.location,
            title: placeResult.name,
        });

        google.maps.event.addListener(marker, 'click', function() {
            self.selectedPlaceId(placeResult.place_id);
            self.map.panTo(marker.getPosition());
            self.infowindow.setContent(infoWindoContent);
            self.infowindow.open(self.map, marker);
        });

        return marker;
    };

    /* filterMarkers function
     * This function filters out the locations based on the
     * selectedLocationType.  It shows/hide a locations marker on
     * the map if the location's type matches the selectedLocationType
     * observable.  It also update the filterLocations observerable
     * array will a filtered list of locations whose location type
     * maltches the selectedLocationType.
     */
    self.filterMarkers = function() {
        var location;
        self.filteredLocations.removeAll();
        for (var i = 0; i < self.locations().length; i++) {
            location = self.locations()[i];
            if ((location.types.indexOf(self.selectedLocationType()) == -1) && (self.selectedLocationType() != "all")) {
                location.marker.setMap(null);
            } else {
                self.filteredLocations.push(location);
                if (location.marker.map === null) {
                    location.marker.setMap(self.map);
                }
            }
        }

    };

    /* selectDetail function
     * This function sets the selectedPlaceId observable to the
     * value of the placeId from the passed in location model.  It is
     * used to show/hide the display of of detail info for a location
     * in list view.
     */
    self.selectDetail = function(location) {
        if (location.place_id === self.selectedPlaceId()) {
            self.selectedPlaceId("");
        } else
            self.selectedPlaceId(location.place_id);
    };

    /* setYellowPageInfo function
     * This function takes a locations and makes an Ajax call to the
     * Yellow Pages API to retrieve additional details about the location.
     * With the additional details, it updates the location model and notifies
     * all listners that that locations observable array has been updated.  It also
     * includes a timeout function as a workaround to handle errors.  If the call to the
     * Yellow pages API fails to return, the request will timeout and log an error to the console.
     */
    self.setYellowPageInfo = function(location) {
        var requestTimeout = setTimeout(function() {
            console.log("Error getting Ajax request");
        }, 8000);

        $.ajax({
            dataType: "jsonp",
            url: "http://api2.yp.com/search-api/search/devapi/search?searchloc=astoria+NY&term=" + encodeURIComponent(location.name) + "&format=json&listingcount=1&key=c9fp548nz9",
            success: function(response) {
                var searchListing = response.searchResult.searchListings.searchListing[0];
                location.primaryCategory = searchListing.primaryCategory;
                location.address = location.vicinity;
                location.phone = searchListing.phone;
                location.moreInfoUrl = searchListing.moreInfoURL;
                location.openHours = searchListing.openHours;

                clearTimeout(requestTimeout);

                self.locations.valueHasMutated();
            }
        });
    };

    //make a call to create the map, retrieve locations and display on map.
    self.initializeMap();

    //adds a listener to the selectedLocationType observable that will execute
    //the filterMarkers function anytime the selectedLocationType changes.
    self.selectedLocationType.subscribe(function() {
        self.filterMarkers();
        self.map.setCenter(self.latlong);
    });

    //adds a listener to the locations observable array that will execute
    //the filterMarkers function anytime the locations array changes.
    self.locations.subscribe(function() {
        self.filterMarkers();
    });
};


/* Location Class
 * This class represents the Location data model.
 * It contains all data pertaining to a location.
 */
var Location = function(placeResult, marker) {
    this.place_id = placeResult.place_id;
    this.name = placeResult.name;
    this.vicinity = placeResult.vicinity;
    this.types = placeResult.types;
    this.marker = marker;
    this.phone = "";
    this.address = "";
    this.primaryCategory = "";
    this.moreInfoUrl = "";
    this.openHours = "";
};

/* getInfoWindowContent function
 * This function takes a placeResult object and creates content
 * to be displayed in the infowindow view.  It returns a content string.
 */
var getInfoWindowContent = function(placeResult) {
    var rating = (placeResult.rating !== null) ? placeResult.rating : "none";
    var content = "<div id=" + placeResult.id + "><h4>" + placeResult.name + "</h4><p>" + placeResult.vicinity + ",NY 11106 US</p><p>rating:  " + rating + "</p></div>";
    return content;
};


//activate the View Model
ko.applyBindings(new ViewModel());