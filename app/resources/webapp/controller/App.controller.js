sap.ui.define([
	"sap/ui/core/mvc/Controller"
], function (Controller) {
	"use strict";

	return Controller.extend("app.app.controller.App", {
		onInit: function() {
			console.log("App controller onInit called!");
		},
		
		onNavigateToImportParts: function() {
			console.log("Navigate to Import Parts clicked!");
			this.getOwnerComponent().getRouter().navTo("ImportParts");
		},
		
		onNavigateToExportDrones: function() {
			console.log("Navigate to Export Drones clicked!");
			this.getOwnerComponent().getRouter().navTo("ExportDrones");
		}
	});
});