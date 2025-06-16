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
			this.getView().setModel(new JSONModel({ selectedItems: [] }), "dronesTable");
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
			this.getView().getModel("editMode").setProperty("/isEdit", false);
			this.getView().getModel("drone").setData({
				Status: "In Progress",
				AssemblyDate: new Date()
			});
			this._getDialog().then(oDialog => oDialog.open());
		},

		onEdit: function (oEvent) {
			const oContext = oEvent.getSource().getBindingContext();
			this.getView().getModel("editMode").setProperty("/isEdit", true);
			const oData = Object.assign({}, oContext.getObject());
			if (oData.AssemblyDate) oData.AssemblyDate = new Date(oData.AssemblyDate);
			if (oData.ExportDate) oData.ExportDate = new Date(oData.ExportDate);
			this.getView().getModel("drone").setData(oData);
			this._sEditPath = oContext.getPath();
			this._getDialog().then(oDialog => {
				oDialog.getBeginButton().setEnabled(true);
				oDialog.open();
			});
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
			const oCurrentDate = new Date();
			let iProcessed = 0;

			aSelectedItems.forEach(oItem => {
				const sPath = oItem.getBindingContext().getPath();
				const oData = oItem.getBindingContext().getObject();
				
				if (oData.Status === "Ready") {
					oModel.update(sPath, {
						Status: "Exported",
						ExportDate: oCurrentDate
					}, {
						success: () => {
							iProcessed++;
							if (iProcessed === aSelectedItems.length) {
								MessageToast.show(`${iProcessed} drone(s) marked as exported.`);
								oTable.removeSelections();
							}
						}
					});
				}
			});
		},

		onExportToCSV: function () {
			const oTable = this.byId("dronesTable");
			const oBinding = oTable.getBinding("items");
			const aItems = oBinding.getContexts().map(oContext => oContext.getObject());
			
			if (aItems.length === 0) {
				return MessageToast.show("No data to export.");
			}
			
			const aHeaders = ["Model", "SerialNumber", "Status", "AssemblyDate", "ExportDate", "Price", "Customer", "Notes"];
			let sCsvContent = "data:text/csv;charset=utf-8," + aHeaders.join(",") + "\n";
			
			aItems.forEach(oItem => {
				sCsvContent += aHeaders.map(h => `"${oItem[h] || ""}"`).join(",") + "\n";
			});
			
			const oLink = document.createElement("a");
			oLink.setAttribute("href", encodeURI(sCsvContent));
			oLink.setAttribute("download", "ExportedDrones.csv");
			oLink.click();
		},

		_getDialog: function () {
			if (!this._oDialog) {
				this._oDialog = Fragment.load({
					id: this.getView().getId(),
					name: "app.app.view.fragment.AddEditDroneDialog",
					controller: this
				}).then(oDialog => {
					this.getView().addDependent(oDialog);
					return oDialog;
				});
			}
			return this._oDialog;
		},

		onDialogInputChange: function () {
			const oDroneData = this.getView().getModel("drone").getData();
			const bIsValid = oDroneData.Model && oDroneData.SerialNumber && 
							oDroneData.Status && oDroneData.Price > 0;
			this.byId("dialogSaveButton").setEnabled(!!bIsValid);
		},

		onSaveDialog: function () {
			const oModel = this.getView().getModel();
			const oRawData = this.getView().getModel("drone").getData();
			const bIsEdit = this.getView().getModel("editMode").getProperty("/isEdit");

			const oNewDrone = {
				Model: oRawData.Model,
				SerialNumber: oRawData.SerialNumber,
				Status: oRawData.Status,
				AssemblyDate: oRawData.AssemblyDate,
				ExportDate: oRawData.ExportDate,
				Price: oRawData.Price,
				Customer: oRawData.Customer || "",
				Notes: oRawData.Notes || ""
			};

			const mParameters = {
				success: () => {
					MessageToast.show(bIsEdit ? "Drone updated." : "Drone created.");
					this.onCancelDialog();
				},
				error: (oError) => {
					const sMessage = oError?.responseText ? 
						JSON.parse(oError.responseText)?.error?.message?.value : "Unknown error";
					MessageBox.error("Error: " + sMessage);
				}
			};

			if (bIsEdit) {
				oModel.update(this._sEditPath, oNewDrone, mParameters);
			} else {
				oModel.create("/Drones", oNewDrone, mParameters);
			}
		},

		onCancelDialog: function () {
			this._getDialog().then(oDialog => oDialog.close());
		}
	});
});