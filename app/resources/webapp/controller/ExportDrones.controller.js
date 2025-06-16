sap.ui.define([
	"sap/ui/core/mvc/Controller",
	"sap/ui/model/Filter",
	"sap/ui/model/FilterOperator",
	"sap/ui/core/Fragment",
	"sap/ui/model/json/JSONModel",
	"sap/m/MessageBox",
	"sap/m/MessageToast"
], function (Controller, Filter, FilterOperator, Fragment, JSONModel, MessageBox, MessageToast) {
	"use strict";

	return Controller.extend("app.app.controller.ExportDrones", {
		onInit: function () {
			this.getView().setModel(new JSONModel({ isEdit: false }), "editMode");
			this.getView().setModel(new JSONModel({}), "drone");
			this.getView().setModel(new JSONModel({ hasSelection: false }), "dronesTable");
			
			// Listen to table selection changes
			this.byId("dronesTable").attachSelectionChange(this.onTableSelectionChange, this);
		},

		onTableSelectionChange: function(oEvent) {
			const bHasSelection = oEvent.getSource().getSelectedItems().length > 0;
			this.getView().getModel("dronesTable").setProperty("/hasSelection", bHasSelection);
		},

		// Generate UUID v4
		generateUUID: function() {
			return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
				var r = Math.random() * 16 | 0,
					v = c == 'x' ? r : (r & 0x3 | 0x8);
				return v.toString(16);
			});
		},

		formatStatusState: function(sStatus) {
			switch (sStatus) {
				case "Ready": return "Success";
				case "Exported": return "Information";
				case "In Progress": return "Warning";
				default: return "None";
			}
		},

		onSearch: function (oEvent) {
			const sQuery = oEvent.getParameter("query");
			const oTable = this.byId("dronesTable");
			const oBinding = oTable.getBinding("items");

			if (!sQuery) {
				oBinding.filter([]);
				return;
			}
			const aFilters = [
				new Filter("Model", FilterOperator.Contains, sQuery),
				new Filter("SerialNumber", FilterOperator.Contains, sQuery),
				new Filter("Customer", FilterOperator.Contains, sQuery)
			];
			oBinding.filter(new Filter(aFilters, false));
		},

		onAdd: function () {
			// Implementation will come with the dialog
			MessageToast.show("Add functionality will be available soon!");
		},

		onEdit: function (oEvent) {
			// Implementation will come with the dialog
			MessageToast.show("Edit functionality will be available soon!");
		},

		onDelete: function (oEvent) {
			const sPath = oEvent.getSource().getBindingContext().getPath();
			const oModel = this.getView().getModel();
			MessageBox.confirm("Are you sure you want to delete this drone?", {
				onClose: (sAction) => {
					if (sAction === MessageBox.Action.OK) {
						oModel.remove(sPath, {
							success: () => MessageToast.show("Drone deleted."),
							error: (oError) => MessageBox.error(JSON.stringify(oError))
						});
					}
				}
			});
		},

		onMarkExported: function() {
			const oTable = this.byId("dronesTable");
			const aSelectedItems = oTable.getSelectedItems();
			
			if (aSelectedItems.length === 0) {
				MessageToast.show("Please select drones to mark as exported.");
				return;
			}

			const oModel = this.getView().getModel();
			let iProcessed = 0;
			let iTotal = 0;

			aSelectedItems.forEach(oItem => {
				const sPath = oItem.getBindingContext().getPath();
				const oData = oItem.getBindingContext().getObject();
				
				if (oData.Status === "Ready") {
					iTotal++;
					oModel.update(sPath, {
						Status: "Exported"
					}, {
						success: () => {
							iProcessed++;
							if (iProcessed === iTotal) {
								MessageToast.show(`${iProcessed} drone(s) marked as exported.`);
								oTable.removeSelections();
							}
						},
						error: (oError) => {
							MessageBox.error("Error marking drone as exported: " + JSON.stringify(oError));
						}
					});
				}
			});

			if (iTotal === 0) {
				MessageToast.show("Only drones with 'Ready' status can be marked as exported.");
			}
		},

		onExportToCSV: function () {
			const oTable = this.byId("dronesTable");
			const oBinding = oTable.getBinding("items");
			const aItems = oBinding.getContexts().map(oContext => oContext.getObject());
			
			if (aItems.length === 0) {
				return MessageToast.show("No data to export.");
			}
			
			const aHeaders = ["ID", "Model", "SerialNumber", "Status", "Price", "Customer", "Notes"];
			let sCsvContent = "data:text/csv;charset=utf-8," + aHeaders.join(",") + "\n";
			
			aItems.forEach(oItem => {
				sCsvContent += aHeaders.map(h => `"${oItem[h] || ""}"`).join(",") + "\n";
			});
			
			const oLink = document.createElement("a");
			oLink.setAttribute("href", encodeURI(sCsvContent));
			oLink.setAttribute("download", "ExportedDrones.csv");
			oLink.click();
		},
		
		onNavigateToImportParts: function() {
			this.getOwnerComponent().getRouter().navTo("ImportParts");
		}
	});
});