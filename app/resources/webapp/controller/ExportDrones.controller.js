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

		_getDialog: function () {
			if (!this._oDialog) {
				this._oDialog = Fragment.load({
					id: this.getView().getId(),
					name: "app.app.view.fragment.AddEditDroneDialog",
					controller: this,
				}).then((oDialog) => {
					this.getView().addDependent(oDialog);
					return oDialog;
				});
			}
			return this._oDialog;
		},

		onAdd: function () {
			this.getView().getModel("editMode").setProperty("/isEdit", false);
			this.getView().getModel("drone").setData({
				Status: "In Progress" // Default status
			});
			this._getDialog().then((oDialog) => oDialog.open());
		},

		onEdit: function (oEvent) {
			const oContext = oEvent.getSource().getBindingContext();
			this.getView().getModel("editMode").setProperty("/isEdit", true);
			this.getView()
				.getModel("drone")
				.setData(Object.assign({}, oContext.getObject()));
			this._sEditPath = oContext.getPath();
			this._getDialog().then((oDialog) => {
				oDialog.getBeginButton().setEnabled(true);
				oDialog.open();
			});
		},

		onDialogInputChange: function () {
			const oDroneData = this.getView().getModel("drone").getData();
			const bIsValid =
				oDroneData.Model &&
				oDroneData.SerialNumber &&
				oDroneData.Status &&
				oDroneData.Price > 0;
			this.byId("dialogSaveButton").setEnabled(!!bIsValid);
		},

		onSaveDialog: function () {
			const oModel = this.getView().getModel();
			const oRawData = this.getView().getModel("drone").getData();
			const bIsEdit = this.getView().getModel("editMode").getProperty("/isEdit");

			// Create a clean payload
			const oDroneData = {
				Model: oRawData.Model,
				SerialNumber: oRawData.SerialNumber,
				Status: oRawData.Status,
				Price: oRawData.Price,
				Customer: oRawData.Customer || "",
				Notes: oRawData.Notes || ""
			};

			// Add ID for new drones
			if (!bIsEdit) {
				oDroneData.ID = this.generateUUID();
			}

			const mParameters = {
				success: () => {
					MessageToast.show(bIsEdit ? "Drone updated." : "Drone created.");
					this.onCancelDialog();
				},
				error: (oError) => {
					const sMessage = oError?.responseText
						? JSON.parse(oError.responseText)?.error?.message?.value
						: "Unknown error";
					MessageBox.error("Error: " + sMessage);
				}
			};

			if (bIsEdit) {
				oModel.update(this._sEditPath, oDroneData, mParameters);
			} else {
				console.log("CREATE drone payload:", JSON.stringify(oDroneData, null, 2));
				oModel.create("/Drones", oDroneData, mParameters);
			}
		},

		onCancelDialog: function () {
			this._getDialog().then((oDialog) => oDialog.close());
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
					
					// Send complete drone data with updated status
					const oUpdatedDrone = {
						Model: oData.Model,
						SerialNumber: oData.SerialNumber,
						Status: "Exported", // This is the only field we're changing
						Price: oData.Price,
						Customer: oData.Customer || "",
						Notes: oData.Notes || ""
					};
					
					oModel.update(sPath, oUpdatedDrone, {
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