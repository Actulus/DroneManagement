sap.ui.define(
	[
		"sap/ui/core/mvc/Controller",
		"sap/ui/model/Filter",
		"sap/ui/model/FilterOperator",
		"sap/ui/core/Fragment",
		"sap/ui/model/json/JSONModel",
		"sap/m/MessageBox",
		"sap/m/MessageToast",
	],
	function (
		Controller,
		Filter,
		FilterOperator,
		Fragment,
		JSONModel,
		MessageBox,
		MessageToast
	) {
		"use strict";

		return Controller.extend("app.app.controller.ImportParts", {
			onInit: function () {
				this.getView().setModel(
					new JSONModel({ isEdit: false }),
					"editMode"
				);
				this.getView().setModel(new JSONModel({}), "part");
			},

			onSearch: function (oEvent) {
				const sQuery = oEvent.getParameter("query");
				const oTable = this.byId("partsTable");
				const oBinding = oTable.getBinding("items");

				if (!sQuery) {
					oBinding.filter([]);
					return;
				}
				const aFilters = [
					new Filter("Name", FilterOperator.Contains, sQuery),
					new Filter("Category", FilterOperator.Contains, sQuery),
					new Filter("Manufacturer", FilterOperator.Contains, sQuery),
				];
				oBinding.filter(new Filter(aFilters, false));
			},

			_getDialog: function () {
				if (!this._oDialog) {
					this._oDialog = Fragment.load({
						id: this.getView().getId(),
						name: "app.app.view.fragment.AddEditPartDialog",
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
				this.getView().getModel("part").setData({});
				this._getDialog().then((oDialog) => oDialog.open());
			},

			onEdit: function (oEvent) {
				const oContext = oEvent.getSource().getBindingContext();
				this.getView().getModel("editMode").setProperty("/isEdit", true);
				this.getView()
					.getModel("part")
					.setData(Object.assign({}, oContext.getObject()));
				this._sEditPath = oContext.getPath();
				this._getDialog().then((oDialog) => {
					oDialog.getBeginButton().setEnabled(true);
					oDialog.open();
				});
			},

			onDelete: function (oEvent) {
				const sPath = oEvent.getSource().getBindingContext().getPath();
				const oModel = this.getView().getModel();
				MessageBox.confirm("Are you sure you want to delete this part?", {
					onClose: (sAction) => {
						if (sAction === MessageBox.Action.OK) {
							oModel.remove(sPath, {
								success: () => MessageToast.show("Part deleted."),
								error: (oError) =>
									MessageBox.error(JSON.stringify(oError)),
							});
						}
					},
				});
			},

			onDialogInputChange: function () {
				const oPartData = this.getView().getModel("part").getData();
				const bIsValid =
					oPartData.Name &&
					oPartData.Category &&
					oPartData.Manufacturer &&
					oPartData.Price > 0 &&
					oPartData.Stock >= 0;
				this.byId("dialogSaveButton").setEnabled(!!bIsValid);
			},

			onSaveDialog: function () {
			  const oModel = this.getView().getModel();
			  const oPartData = this.getView().getModel("part").getData();
			  const bIsEdit = this.getView().getModel("editMode").getProperty("/isEdit");
			
			  delete oPartData.__metadata;
			  delete oPartData.ID;
			
			  const mParameters = {
			    success: () => {
			      MessageToast.show(bIsEdit ? "Part updated." : "Part created.");
			      this.onCancelDialog();
			    },
			    error: (oError) => {
			      const sMessage = oError?.responseText
			        ? JSON.parse(oError.responseText)?.error?.message?.value
			        : "Unknown error";
			      MessageBox.error("Error: " + sMessage);
			    },
			  };
			
			  if (bIsEdit) {
			  	console.log(this._sEditPath);
			  	console.log(oPartData);
			  	console.log(mParameters);
			    oModel.update(this._sEditPath, oPartData, mParameters);
			  } else {
			  	console.log("CREATE payload:", JSON.stringify(oPartData, null, 2));
			    oModel.create("/DroneParts", oPartData, mParameters);
			  }
			},

			onCancelDialog: function () {
				this._getDialog().then((oDialog) => oDialog.close());
			},

			onFileChange: function (oEvent) {
				const oFile = oEvent.getParameter("files")[0];
				if (!oFile) return;
				const oReader = new FileReader();
				oReader.onload = (e) => this._processCSV(e.target.result);
				oReader.readAsText(oFile);
			},
			
			_processCSV: function (sCsvData) {
			    const oModel = this.getView().getModel();
			    const aLines = sCsvData.split(/\r\n|\n/);
			    let iSuccessCount = 0;
			
			    // Use batch processing
			    aLines.forEach((sLine, index) => {
			        // Skip empty lines and the header row
			        if (sLine.trim() === "" || index === 0) {
			            return;
			        }
			
			        const aValues = sLine.split(",");
			        if (aValues.length === 5) {
			            // Clean each value: trim whitespace and remove all quotes
			            const aCleanValues = aValues.map((value) =>
			                value.trim().replace(/"/g, "")
			            );
			
			            const oNewPart = {
			                Name: aCleanValues[0],
			                Category: aCleanValues[1],
			                Manufacturer: aCleanValues[2],
			                Price: parseFloat(aCleanValues[3]),
			                Stock: parseInt(aCleanValues[4], 10),
			            };
			
			            // Check for valid data before adding to batch
			            if (
			                oNewPart.Name &&
			                !isNaN(oNewPart.Price) &&
			                !isNaN(oNewPart.Stock)
			            ) {
			                oModel.createEntry("/DroneParts", { properties: oNewPart });
			                iSuccessCount++;
			            }
			        }
			    });
			
			    if (iSuccessCount > 0) {
			        oModel.submitChanges({
			            success: () => {
			                MessageToast.show(
			                    `${iSuccessCount} parts imported successfully.`
			                );
			                oModel.refresh();
			            },
			            error: (oError) => {
			                MessageBox.error(
			                    "Error during import: " + JSON.stringify(oError)
			                );
			                oModel.resetChanges(); // Clear pending changes on error
			            },
			        });
			    } else {
			        MessageBox.warning("No valid data found in the CSV file to import.");
			    }
			},

			onExportToCSV: function () {
				const oTable = this.byId("partsTable");
				const oBinding = oTable.getBinding("items");
				const aItems = oBinding
					.getContexts()
					.map((oContext) => oContext.getObject());
				if (aItems.length === 0) {
					return MessageToast.show("No data to export.");
				}
				const aHeaders = ["Name", "Category", "Manufacturer", "Price", "Stock"];
				let sCsvContent =
					"data:text/csv;charset=utf-8," + aHeaders.join(",") + "\n";
				aItems.forEach((oItem) => {
					sCsvContent += aHeaders.map((h) => `"${oItem[h]}"`).join(",") + "\n";
				});
				const oLink = document.createElement("a");
				oLink.setAttribute("href", encodeURI(sCsvContent));
				oLink.setAttribute("download", "DroneParts.csv");
				oLink.click();
			},
		});
	}
);