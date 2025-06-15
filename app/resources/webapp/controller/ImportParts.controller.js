sap.ui.define([
	"sap/ui/core/mvc/Controller",
	"sap/ui/model/Filter",
	"sap/ui/model/FilterOperator"
], function (Controller, Filter, FilterOperator) {
	"use strict";

	return Controller.extend("app.app.controller.ImportParts", {
		onSearch: function (oEvent) {
			const query = oEvent.getSource().getValue();
			const table = this.getView().byId("partsTable");
			const binding = table.getBinding("items");

			const filters = query ? [
				new Filter("Name", FilterOperator.Contains, query),
				new Filter("Category", FilterOperator.Contains, query),
				new Filter("Manufacturer", FilterOperator.Contains, query)
			] : [];

			binding.filter(new Filter(filters, false));
		},

		onGoToExport: function () {
			this.getOwnerComponent().getRouter().navTo("ExportDrones");
		}
	});
});