sap.ui.define([
	"sap/ui/core/mvc/Controller",
	"sap/ui/model/json/JSONModel"
], function (Controller, JSONModel) {
	"use strict";

	return Controller.extend("app.app.controller.App", {
		onInit: function () {
			// Set up navigation model
			this.getView().setModel(new JSONModel({
				selectedKey: "parts"
			}), "nav");
			
			// Listen to route changes to update selected key
			this.getRouter().attachRouteMatched(this.onRouteMatched, this);
		},
		
		onRouteMatched: function(oEvent) {
			const sRouteName = oEvent.getParameter("name");
			const sSelectedKey = sRouteName === "ExportDrones" ? "drones" : "parts";
			this.getView().getModel("nav").setProperty("/selectedKey", sSelectedKey);
		},
		
		onNavigateToImportParts: function() {
			this.getRouter().navTo("ImportParts");
		},
		
		onNavigateToExportDrones: function() {
			this.getRouter().navTo("ExportDrones");
		},
		
		getRouter: function() {
			return this.getOwnerComponent().getRouter();
		}
	});
});