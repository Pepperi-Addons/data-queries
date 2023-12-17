import { Component, Inject, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { TranslateService } from '@ngx-translate/core';
import { IPepGenericListDataSource, PepGenericListService } from '@pepperi-addons/ngx-composite-lib/generic-list';
import { PepDialogService } from '@pepperi-addons/ngx-lib/dialog';
import { AddonService } from 'src/services/addon.service';
import { PepLoaderService } from '@pepperi-addons/ngx-lib';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { config } from '../addon.config';
import { GridDataViewField } from '@pepperi-addons/papi-sdk';
import { UtilitiesService } from 'src/services/utilities.service';


@Component({
  selector: 'data-export-form',
  templateUrl: './data-export-form.component.html',
  styleUrls: ['./data-export-form.component.scss']
})
export class DataExportFormComponent implements OnInit {
  
  dataView = null;
  dataSource = null;
  mode: string = 'Add';
  fields: any;
  resourceOptions: any = [];
  query;
  selectedSeries;
  seriesOptions = [];
  categoryOptions = [];
  dynamicSerieOptions = [];
  resourceFields;
  resourceData;
  groupByFieldType = "";
  breakByFieldType = "";
  queryKey;
  objectsFromExecute = [];
  resultsListFields = [];
  listData;
  isLoaded = false;
  variablesTextboxes = [];
  dateFilterField = null;
  userID = null;
  selectedUser = null;
  dataFromExecute;

  constructor(
    public addonService: AddonService,
    public translate: TranslateService,
    public genericListService: PepGenericListService,
    public activateRoute: ActivatedRoute,
    public dialogService: PepDialogService,
    public loaderService: PepLoaderService,
    private dialogRef: MatDialogRef<DataExportFormComponent>,
	private utilitiesService: UtilitiesService,
    private router: Router,
    @Inject(MAT_DIALOG_DATA) public incoming: any) {
      this.selectedUser = incoming?.userName;
      this.userID = incoming?.userID;
      this.dataFromExecute = incoming?.dataFromExecute;
      this.query = incoming?.query;
    }

   async ngOnInit() {
    this.loaderService.show();
    this.addonService.addonUUID = config.AddonUUID;
    this.queryKey = this.query.Key;
    this.createVariablesTextboxes();
    this.resourceData = (await this.addonService.getResourceDataByName(this.query.Resource))[0];
    this.resourceFields = await this.addonService.getDataIndexFields(this.resourceData);
    this.seriesOptions = this.query.Series.map((s) => {
      return { Key: s.Key, Value: s.Name }
    });
    this.selectedSeries = this.query.Series[0];
    let todayDateTime = new Date();
    let monthAgoDateTime = new Date();
    monthAgoDateTime.setMonth(todayDateTime.getMonth()-1);
    this.fields = {
        seriesKey: this.selectedSeries.Key,
        groupByField: null,
        breakByField: null,
        user: this.selectedUser,
        fromDate: monthAgoDateTime.toJSON(),
        toDate: todayDateTime.toJSON(),
        description: this.translate.instant('DATA_EXPORT_DESCRIPTION')
    }
    await this.setCategoriesAndDynamicSerieOptions();
    this.dataView = this.getDataView();
    this.dataSource = this.getDataSource();
    this.listData = this.getListDataSource();
    this.isLoaded = true;
    this.loaderService.hide();
   }

   getDataSource(){
        return this.fields;
   }

   getDataView() {
       return {
         Type: "Form",
         Hidden: false,
         Columns: [],
         Context: {
           Object: {
             Resource: "transactions",
             InternalID: 0,
             Name: "Object Name",
           },
           Name: "Context Name",
           ScreenSize: "Tablet",
           Profile: {
             InternalID: 0,
             Name: "Profile Name",
           },
         },
         Fields: [
            {
              FieldID: 'description',
              Type: "RichTextHTML",
              Title: "",
              Mandatory: false,
              ReadOnly: false,
              Layout: {
                Origin: {
                  X: 0,
                  Y: 0,
                },
                Size: {
                  Width: 2,
                  Height: 0,
                },
              },
              Style: {
                Alignment: {
                  Horizontal: "Stretch",
                  Vertical: "Stretch",
                },
              },
              AdditionalProps: {
                renderTitle: false,
                renderEnlargeButton: false
              }
            },
            {
              FieldID: "",
              Type: "Separator",
              Title: "Filter rules",
              Mandatory: false,
              ReadOnly: false,
              Layout: {
                Origin: {
                  X: 0,
                  Y: 1,
                },
                Size: {
                  Width: 2,
                  Height: 0,
                },
              },
              Style: {
                Alignment: {
                  Horizontal: "Stretch",
                  Vertical: "Stretch",
                },
              },
            },
           {
             FieldID: "seriesKey",
             Type: "ComboBox",
             Title: "Series",
             Mandatory: false,
             ReadOnly: this.query.Series?.length == 1,
             Layout: {
               Origin: {
                 X: 0,
                 Y: 2,
               },
               Size: {
                 Width: 1,
                 Height: 0,
               },
             },
             Style: {
               Alignment: {
                 Horizontal: "Stretch",
                 Vertical: "Stretch",
               },
             },
             OptionalValues: this.seriesOptions
           },
           {
            FieldID: "user",
            Type: "TextBox",
            Title: "User",
            Mandatory: false,
            ReadOnly: true,
            Layout: {
              Origin: {
                X: 1,
                Y: 2,
              },
              Size: {
                Width: 1,
                Height: 0,
              },
            },
            Style: {
              Alignment: {
                Horizontal: "Stretch",
                Vertical: "Stretch",
              },
            }
          },
           {
            FieldID: "groupByField",
            Type: this.categoryOptions?.length > 0 ? "ComboBox" : "TextBox",
            Title: this.isDisabled(this.selectedSeries.GroupBy[0].FieldID, this.groupByFieldType) ?
            "Categories filter" : this.addonService.removecsSuffix(this.selectedSeries.GroupBy[0].FieldID),
            Mandatory: false,
            ReadOnly: this.isDisabled(this.selectedSeries.GroupBy[0].FieldID, this.groupByFieldType),
            Layout: {
              Origin: {
                X: 0,
                Y: 3,
              },
              Size: {
                Width: 1,
                Height: 0,
              },
            },
            Style: {
              Alignment: {
                Horizontal: "Stretch",
                Vertical: "Stretch",
              },
            },
            OptionalValues: this.categoryOptions
          },
          {
            FieldID: "breakByField",
            Type: this.dynamicSerieOptions?.length > 0 ? "ComboBox" : "TextBox",
            Title: this.isDisabled(this.selectedSeries.BreakBy.FieldID, this.breakByFieldType) ? 
            "Dynamic series filter" : this.addonService.removecsSuffix(this.selectedSeries.BreakBy.FieldID),
            Mandatory: false,
            ReadOnly: this.isDisabled(this.selectedSeries.BreakBy.FieldID, this.breakByFieldType),
            Layout: {
              Origin: {
                X: 1,
                Y: 3,
              },
              Size: {
                Width: 1,
                Height: 0,
              },
            },
            Style: {
              Alignment: {
                Horizontal: "Stretch",
                Vertical: "Stretch",
              },
            },
            OptionalValues: this.dynamicSerieOptions
          },
          {
            FieldID: "fromDate",
            Type: "DateAndTime",
            Title: "From date (optional)",
            Mandatory: false,
            ReadOnly: this.dateFilterField==null,
            Layout: {
              Origin: {
                X: 0,
                Y: 4,
              },
              Size: {
                Width: 1,
                Height: 0,
              },
            },
            Style: {
              Alignment: {
                Horizontal: "Stretch",
                Vertical: "Stretch",
              },
            }
          },
          {
            FieldID: "toDate",
            Type: "DateAndTime",
            Title: "To date (optional)",
            Mandatory: false,
            ReadOnly: this.dateFilterField==null,
            Layout: {
              Origin: {
                X: 1,
                Y: 4,
              },
              Size: {
                Width: 1,
                Height: 0,
              },
            },
            Style: {
              Alignment: {
                Horizontal: "Stretch",
                Vertical: "Stretch",
              },
            }
          }
         ].concat(this.variablesTextboxes),
         Rows: [],
       };
   }

   async onRunClicked() {
    this.loaderService.show();
    const filterObject = this.buildFilterObject(); // this object will be sent to execute
    //we don't want to show those fields to the user, so we remove them from the requested fields
    const fieldsToHide = ['InternalID','UUID','Account.InternalID','Agent.InternalID','Account.UUID','Transaction.InternalID',
    'Transaction.Agent.InternalID','Transaction.Account.InternalID','Transaction.Agent.UUID', 'Transaction.Account.UUID'];
    const fieldsNames = this.resourceFields.map(f => f.FieldID).filter(f => !fieldsToHide.includes(f));
    let variableValues = {};
    if(this.variablesTextboxes.length > 0) {
      for(let fieldName in this.fields) {
        // if given variable values, save them without the 'inputVariable_' prefix
        if(fieldName.startsWith('inputVariable_'))
          variableValues[fieldName.slice(14)] = this.fields[fieldName];
      }
    }
    const body = {
      Filter: filterObject,
      Series: this.selectedSeries.Name,
      Page: 1,
      Fields: fieldsNames,
      VariableValues: variableValues,
      UserID: this.userID
    }
    this.objectsFromExecute = (await this.addonService.executeQueryForAdmin(this.queryKey, body)).Objects;
    this.listData  = this.getListDataSource();
    this.loaderService.hide();
   }

   buildFilterObject() {
    let filterNodes = [];
    // add the category filter only if the user selected a value.
    // if the value is an empty string, make sure it is a valid option and not the default 'none'.
    if(this.fields.groupByField || (this.fields.groupByField=='' && this.categoryOptions?.find(op => op.Key==''))) {
      filterNodes.push({
        Values: [
          this.fields.groupByField
        ],
        Operation: "IsEqual",
        ApiName: this.addonService.removecsSuffix(this.selectedSeries.GroupBy[0].FieldID),
        FieldType: this.groupByFieldType
      })
    }
    // add the dynamic-series filter only if the user selected a value.
    // if the value is an empty string, make sure it is a valid option and not the default 'none'.
    if(this.fields.breakByField || (this.fields.breakByField=='' && this.dynamicSerieOptions?.find(op => op.Key==''))) {
      filterNodes.push({
        Values: [
          this.fields.breakByField
        ],
        Operation: "IsEqual",
        ApiName: this.addonService.removecsSuffix(this.selectedSeries.BreakBy.FieldID),
        FieldType: this.breakByFieldType
      })
    }
    if(this.fields.fromDate != '' && this.fields.toDate != '') {
      filterNodes.push({
        Values: [
          this.fields.fromDate,
          this.fields.toDate
        ],
        Operation: "Between",
        ApiName: this.dateFilterField,
        FieldType: "Date"
      })
    }

    // now build the filter object
    let filterObject = filterNodes[0];

    for(let i=1; i < filterNodes.length; i++) {
      filterObject = {
        Operation: "AND",
        LeftNode: filterObject,
        RightNode: filterNodes[i]
      }
    }

    return filterObject;
   }

  async valueChange(e) {
    this.loaderService.show();
    if(e.ApiName == "seriesKey") {
      if(e.Value != '') {
        this.selectedSeries = this.query.Series.filter(s => s.Key==e.Value)[0];
        await this.setCategoriesAndDynamicSerieOptions();
      }
      this.fields.user = null;
      this.fields.groupByField = null;
      this.fields.breakByField = null;
      this.dataView = this.getDataView();
    }
    this.loaderService.hide();
  }

  async setCategoriesAndDynamicSerieOptions() {
    // The date-filter field is based on the groupBy/breakBy fields.
    this.dateFilterField = null;
    const body = {
      Series: this.selectedSeries.Name,
      Page: 1,
      UserID: this.userID
    };
    const dataSetFromExecute = (await this.addonService.executeQueryForAdmin(this.queryKey, body)).DataSet;
    this.categoryOptions = await this.buildOptionalValuesOptions(this.selectedSeries.GroupBy[0].FieldID, true, dataSetFromExecute);
    this.dynamicSerieOptions = await this.buildOptionalValuesOptions(this.selectedSeries.BreakBy.FieldID, false, dataSetFromExecute);
    if(this.dateFilterField==null) {
      this.fields.fromDate = '';
      this.fields.toDate = '';
    }
  }

  async buildOptionalValuesOptions(fieldID, isGroupBy, dataSetFromExecute) {
    if(fieldID == "") return [];
    if(this.isDateField(fieldID)) this.dateFilterField = fieldID;
    fieldID = this.addonService.removecsSuffix(fieldID);
    const fieldData = this.resourceFields.filter(f => f.FieldID == fieldID)[0];
    let optionalValues = [];
    if(isGroupBy) {
      this.groupByFieldType = fieldData.Type;
      const alias = this.selectedSeries.GroupBy[0].Alias;
      optionalValues = dataSetFromExecute.map(data => data[alias]);
    }
    else {
      this.breakByFieldType = fieldData.Type;
      let valuesSet = new Set();
      dataSetFromExecute.forEach(row => {
        Object.keys(row).forEach(key => {valuesSet.add(key)});
      });
      optionalValues = Array.from(valuesSet);
      // if the serie has groupBy, the dataSet will contain its name as the first key, so we remove it.
      if(this.selectedSeries.GroupBy[0].FieldID != "") {
        optionalValues = optionalValues.filter(v => v != this.selectedSeries.GroupBy[0].Alias);
      }
    }
	optionalValues = optionalValues.map((v) => {
		return { Key: v, Value: v }
	});
	
	const sorted = this.utilitiesService.caseInsensitiveSortByField(optionalValues, 'Key');
	return sorted;
  }

  isDisabled(fieldID, type) {
    return (fieldID=="" || type=="Date" || type=="DateTime");
  }

  formInvalid() {
    return (this.fields?.seriesKey=='');
  }

  getListDataSource() {
    return {
        init: async(params:any) => {
            let objects = this.objectsFromExecute;
            return Promise.resolve({
                dataView: {
                    Context: {
                        Name: '',
                        Profile: { InternalID: 0 },
                        ScreenSize: 'Landscape'
                    },
                    Type: 'Grid',
                    Title: '',
                    Fields: objects.length > 0 ? this.getObjectFields(objects[0]) : [],
                    Columns: Array(20).fill({ Width: 0 }),
                    FrozenColumnsCount: 0,
                    MinimumColumnWidth: 0
                },
                totalCount: objects?.length,
                items: objects
            });
        },
        inputs: () => {
            return Promise.resolve({
                pager: {
                    type: 'scroll'
                },
                selectionType: 'none',
                noDataFoundMsg: this.translate.instant('NoDataFound')
            }) 
        },
    } as IPepGenericListDataSource
  }

private getObjectFields(singleObject, type = 'TextBox'): GridDataViewField[] {
  let Objectfields = [];
  Object.keys(singleObject).forEach(fieldName => {
    Objectfields.push({
      FieldID: fieldName,
      Type: this.isDateField(fieldName) ? 'DateAndTime' : type,
      Title: fieldName,
      Mandatory: false,
      ReadOnly: true
    })
  });
  return Objectfields;
}

  createVariablesTextboxes() {
    let initialY = 5; // the last Y of the basic form is 4
    let column = 0;
    this.query.Variables.forEach(v => {
      this.variablesTextboxes.push({
        FieldID: `inputVariable_${v.Name}`,
        Type: "TextBox",
        Title: v.Name,
        Mandatory: false,
        ReadOnly: false,
        Layout: {
          Origin: {
            X: column,
            Y: initialY,
          },
          Size: {
            Width: 1,
            Height: 0,
          },
        },
        Style: {
          Alignment: {
            Horizontal: "Stretch",
            Vertical: "Stretch",
          },
        }
      })
      if(column==1) initialY+=1;
      column = (column+1)%2;
    })
  }

  isDateField(fieldName) {
    const fieldType = this.resourceFields.find(f => f.FieldID==fieldName)?.Type;
    return fieldType=='Date' || fieldType=='DateTime';
  }

  goBackToForm() {
    this.router.navigate(['..'], {
        relativeTo: this.activateRoute,
        queryParamsHandling: 'preserve'
    })
  }

  closeDialog(data: any = null): void {
     this.dialogRef.close({data});
  }
}
