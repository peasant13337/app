//Backbone Variables
var addressView,
	mapView,
	searchForm;

var app = {"map":null, "geocoder":null, "currentSearchMarker":null, "editingId":null, "destroy":false};

$(document).ready(function() {

	var localBackbone = Backbone.noConflict();

	///Models///
	app.Address = localBackbone.Model.extend({
		defaults: {
			id: null,
			lat: null,
			lng: null,
			address: "",
			nickname: ""
		},
		marker: null
	});


	//Collections///
	app.AddressList = localBackbone.Collection.extend({
		model: app.Address,
	});


	///Views///
	app.MapView = localBackbone.View.extend({
		el:"#map-canvas",
		initialize: function() {
			markers = [];
			google.maps.event.addDomListener(window, 'load', this.render());
		},
		render: function() {
			createMap();
		},
		renderMapMarker: function(id) {
			var model = addressList.findWhere({"id": String(id)});
			try { model.marker.setMap(null) } catch(e) {}					//if the marker for the model needs to change
			model.marker = addMapMarker(model.get("lat"), model.get("lng"))
		}

	});

	app.AddressView = localBackbone.View.extend({
		events: {
			"click": "addressClick"
		},
		initialize: function() {
			this.render();
			this.model.on('change',this.render,this);
			this.model.on('destroy',this.render,this);
		},
		render: function() {
			if(app.destroy) { //view's model is destroyed
				app.destroy = false;
				console.log("fucking finally");
				console.log("model = ", this.model);
				$("#addresses #model-"+this.model.get("id")).remove(); //delete view from addresses
				this.model.marker.setMap(null); //delete marker from map
				app.map.setZoom(2); //reset zoom
				console.log("end this shit already");

			} else {
				console.log("in addressView render");
				var template = $("#addressTemplate").html();
				var addressElement = $(_.template(template, this.model.attributes));
				$("#addresses").append( addressElement ) //this.$el;
				this.setElement(addressElement);
				mapView.renderMapMarker(this.model.get("id"));
			}
		},
		addressClick: function(event, params) {
			console.log("addressClick params = ", params);
			this.stopEdit();
			app.editingId = this.model.get("id");
			app.map.setCenter(this.model.marker.position); 							//center map on marker
			app.map.setZoom(12);													//zoomon map on marker

			searchForm.$el.find("#searchAddress").val(this.model.get("address"));	//fill address
			searchForm.$el.find("#nickname").val(this.model.get("nickname"));		//fill nickname

			if(params)
				params["edit"] ? this.startEdit() : this.stopEdit();

		},
		startEdit: function() {
			this.$el.addClass("editActive");
			app.editingId = this.model.get("id"); 									//set id of model being edited
			searchForm.$el.find(".title.find").text("Editing"); 					//possibly change text to say editing
			searchForm.$el.find("#deleteAddress, #stopEdit, #updateAddress").show(); 		//show delete/stopedit button
			searchForm.$el.find("#startEdit, #saveAddress").hide();					//show stopEdit link
			
			app.map.setZoom(17);													//zoomon map on marker
			searchForm.$el.find("#searchAddress").val(this.model.get("address"));	//fill address
			searchForm.$el.find("#nickname").val(this.model.get("nickname"));		//fill nickname
			app.currentSearchMarker = null;												//null app.currentSearchMarker
		},
		stopEdit: function() {
			$(".address").removeClass("editActive");
			app.editingId = null 									//set id of model being edited
			searchForm.$el.find(".title.find").text("Search"); 		//possibly change text to say editing
			searchForm.$el.find("#deleteAddress, #stopEdit, #updateAddress").hide(); 		//show delete/stopedit button
			searchForm.$el.find("#startEdit, #saveAddress").show();					//show stopEdit link

			app.map.setZoom(2);										//zoomon map on marker
			searchForm.$el.find("#searchAddress").val("");			//fill address
			searchForm.$el.find("#nickname").val("");				//fill nickname
			app.currentSearchMarker = null;								//null app.currentSearchMarker

		}
	});

	app.searchFormView = localBackbone.View.extend({
		el: '#searchForm',
		events: {
			"click #searchBtn": "search",
			"click #saveAddress": "saveAddress",
			"click #updateAddress": "updateAddress",
			"click #deleteAddress": "deleteAddress",
			"click #startEdit": "startEdit",
			"click #stopEdit": "stopEdit"
		},
		startEdit: function(event) {
			if(app.editingId)
				$("#model-"+app.editingId).trigger("click",{"edit":true});			//triggers AddressView addressClick
			else
				alert("select an address of yours below to edit first");
		},
		stopEdit: function(event) {
			$("#model-"+app.editingId).trigger("click",{"edit":false});
		},
		search: function(event) {
			searchForAddress();
		},

		deleteAddress: function(event) {
			$.post("/deletedb/", { "id":app.editingId })
			.done(function(data) {
				console.log("in deletedb data = ", data);
				data = jQuery.parseJSON(data);
				if(data["result"] == "success") {
					var model = addressList.findWhere({"id": String(app.editingId)});
					//model.destroy({"silent": true});
					app.destroy = true;					//looking at this flag when view render called automatically
					model.trigger("destroy");

					addressList.remove(   addressList.findWhere({"id": String(app.editingId)})   );
				}
			});
		},

		updateAddress: function(event) {
			if(app.currentSearchMarker) {
				//post to /updatedb/ here

				var lat = app.currentSearchMarker.position.lat(),
					lng = app.currentSearchMarker.position.lng(),
					address = this.$el.find("#searchAddress").val(),
					nickname = this.$el.find("#nickname").val()

				$.post("/updatedb/", { "id":app.editingId, "lat":lat, "lng":lng, "address":address, "nickname":nickname })
				.done(function(data) {
					console.log("/insertdb/ Data Loaded: ", data);

					data = jQuery.parseJSON(data);

					if(data["result"] == "success") {
						var model = addressList.findWhere({"id": String(app.editingId)});
						
						$("#model-"+app.editingId).remove();

						model.marker = app.currentSearchMarker;
						mapView.renderMapMarker(app.editingId);
						model.set({
							"address": address,
							"nickname": nickname,
							"lat": lat,
							"lng": lng
						});

						console.log("after set");

						searchForm.stopEdit();

						console.log("finished update, id is still"+app.editingId);

						//console.log(add.models[0].set({'name': 'Statler', 'age': 100}));
					
					}

				});

			} else {
				alert("search for the address first so it can be verified");
			}
		},
		saveAddress: function(event) {
			if(app.currentSearchMarker) {

				var lat = app.currentSearchMarker.position.lat(),
					lng = app.currentSearchMarker.position.lng(),
					address = this.$el.find("#searchAddress").val(),
					nickname = this.$el.find("#nickname").val()


				$.post("/insertdb/", { "lat":lat, "lng":lng, "address":address, "nickname":nickname })
				.done(function(data) {
					console.log("/insertdb/ Data Loaded: ", data);
					data = jQuery.parseJSON(data);
					if(data["id"] == -1)
						return;
					
					var model = new app.Address({
						"id": data["id"],
						"lat": lat,
						"lng": lng,
						"address": address,
						"nickname": nickname
					})
					app.currentSearchMarker.setMap(null); //remove search marker if save successful
					addressList.add(model); //add new model to addressList
					var view = new app.AddressView({model: model}); //add address a/button link to mainContent
					app.currentSearchMarker = null;
					//add marker to map // taken care of in above call
					//center marker on map // taken care of in above call

				});
			}
		},
	});

	mapView = new app.MapView();
	addressList = new app.AddressList();
	searchForm = new app.searchFormView();

	function serverFetchAddresses() {
		//$.post('/selectdb/', function(data) {
		$.post("/selectdb/", {})
		.done(function(data) {
			data = jQuery.parseJSON(data)
			addressList.add(data.addresses);
			$.each(addressList.models,function(index, val){
				var view = new app.AddressView({model: val});
				console.log("see me for how to connect view and model", index);
				//addressList.add(new app.Address(val) );
			});
		});
	}

	serverFetchAddresses();


});//ready




















