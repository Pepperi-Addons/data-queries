import { Component, Inject, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { TranslateService } from '@ngx-translate/core';
import { IPepGenericListDataSource, PepGenericListService } from '@pepperi-addons/ngx-composite-lib/generic-list';
import { PepDialogService } from '@pepperi-addons/ngx-lib/dialog';
import { AddonService } from 'src/services/addon.service';
import { PepLoaderService } from '@pepperi-addons/ngx-lib';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { config } from '../addon.config';
import { GridDataViewField } from '@pepperi-addons/papi-sdk';


@Component({
  selector: 'data-export-form',
  templateUrl: './data-export-form.component.html',
  styleUrls: ['./data-export-form.component.scss']
})
export class DataExportFormComponent implements OnInit {
  
  dialogRef: MatDialogRef<any>;
  dataView = null;
  dataSource = null;
  mode: string = 'Add';
  fields: any;
  resourceOptions: any = [];
  query;
  selectedSeries;
  seriesOptions = [];
  usersOptions = [];
  users;
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

  constructor(
    public addonService: AddonService,
    public translate: TranslateService,
    public genericListService: PepGenericListService,
    public activateRoute: ActivatedRoute,
    public dialogService: PepDialogService,
    public loaderService: PepLoaderService
  ) {}

   async ngOnInit() {
    this.loaderService.show();
    this.addonService.addonUUID = config.AddonUUID;
    this.queryKey = this.activateRoute.snapshot.params.query_uuid;
    this.query = (await this.addonService.getDataQueryByKey(this.queryKey))[0];
    this.resourceData = (await this.addonService.getResourceDataByName(this.query.Resource))[0];
    this.resourceFields = await this.addonService.getDataIndexFields(this.resourceData);
    this.seriesOptions = this.query.Series.map((s) => {
      return { Key: s.Key, Value: s.Name }
    });
    this.selectedSeries = this.query.Series[0];
    this.fields = {
        seriesKey: this.selectedSeries.Key,
        groupByField: null,
        breakByField: null,
        user: null,
        fromDate: null,
        toDate: null,
        description: this.translate.instant('DATA_EXPORT_DESCRIPTION')
    }
    this.setUserOptions();
    this.setCategoriesAndDynamicSerieOptions();
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
             FieldID: "seriesKey",
             Type: "ComboBox",
             Title: "Series",
             Mandatory: false,
             ReadOnly: this.query.Series?.length == 1,
             Layout: {
               Origin: {
                 X: 0,
                 Y: 1,
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
            Type: "ComboBox",
            Title: "User",
            Hidden: true,
            Mandatory: false,
            ReadOnly: !this.users,
            Layout: {
              Origin: {
                X: 1,
                Y: 1,
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
            OptionalValues: this.usersOptions
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
            OptionalValues: this.dynamicSerieOptions
          },
          {
            FieldID: "fromDate",
            Type: "DateAndTime",
            Title: "From date (optional)",
            Hidden: true,
            Mandatory: false,
            ReadOnly: false,
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
            }
          },
          {
            FieldID: "toDate",
            Type: "DateAndTime",
            Title: "To date (optional)",
            Hidden: true,
            Mandatory: false,
            ReadOnly: false,
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
            }
          }
         ],
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
    const body = {
      Filter: filterObject,
      Series: this.selectedSeries.Name,
      Page: 1,
      Fields: fieldsNames
    }
    this.objectsFromExecute = (await this.addonService.executeQuery(this.queryKey, body)).Objects;
    this.listData  = this.getListDataSource();
    this.loaderService.hide();
   }

   buildFilterObject() {
    let filterNodes = [];
    if(this.fields.groupByField) {
      filterNodes.push({
        Values: [
          this.fields.groupByField
        ],
        Operation: "IsEqual",
        ApiName: this.addonService.removecsSuffix(this.selectedSeries.GroupBy[0].FieldID),
        FieldType: this.groupByFieldType
      })
    }
    if(this.fields.breakByField) {
      filterNodes.push({
        Values: [
          this.fields.breakByField
        ],
        Operation: "IsEqual",
        ApiName: this.addonService.removecsSuffix(this.selectedSeries.BreakBy.FieldID),
        FieldType: this.breakByFieldType
      })
    }
    if(this.fields.user) {
      const userData = this.users.filter(u => u.UUID==this.fields.user);
      const userFieldID = this.resourceData.UserFieldID;
      const userId = userFieldID == "InternalID" ? userData.InternalID : userData.UUID;
      filterNodes.push({
        Values: [userId],
        Operation: "IsEqual",
        ApiName: this.resourceData.IndexedUserFieldID,
        FieldType: 'String'
      })
    }
    if(this.fields.fromDate && this.fields.toDate) {
      filterNodes.push({
        Values: [
          this.fields.fromDate,
          this.fields.toDate
        ],
        Operation: "Between",
        ApiName: "ActionDateTime",
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
        await this.setUserOptions();
        this.setCategoriesAndDynamicSerieOptions();
      }
      this.fields.user = null;
      this.fields.groupByField = null;
      this.fields.breakByField = null;
      this.fields.fromDate = null;
      this.fields.toDate = null;
      this.dataView = this.getDataView();
    }
    this.loaderService.hide();
  }

  async setUserOptions() {
    if(this.selectedSeries.Scope.Account=="AllAccounts" && this.selectedSeries.Scope.User=="AllUsers") {
      this.users = null;
    } else if(!this.users) {
      this.users = await this.addonService.get('/users');
      this.usersOptions = this.users.map((user) => {
        return { Key: user.UUID, Value: user.FirstName };
      });
    }
  }

  setCategoriesAndDynamicSerieOptions() {
    this.categoryOptions = this.buildOptionalValuesOptions(this.selectedSeries.GroupBy[0].FieldID, true);
    this.dynamicSerieOptions = this.buildOptionalValuesOptions(this.selectedSeries.BreakBy.FieldID, false);
  }

  buildOptionalValuesOptions(fieldID, isGroupBy) {
    if(fieldID == "") return [];
    fieldID = this.addonService.removecsSuffix(fieldID);
    const fieldData = this.resourceFields.filter(f => f.FieldID == fieldID)[0];
    if(isGroupBy) {
      this.groupByFieldType = fieldData.Type;
    }
    else {
      this.breakByFieldType = fieldData.Type;
    }
    const optionalValues = fieldData.OptionalValues;
    if(optionalValues) {
      return optionalValues.map((v) => {
        return { Key: v, Value: v }
      });
    }
  }

  isDisabled(fieldID, type) {
    return (fieldID=="" || type.includes("Date"));
  }

  formInvalid() {
    return ((!this.fields?.groupByField && !this.isDisabled(this.selectedSeries?.GroupBy[0].FieldID, this.groupByFieldType)) ||
            (!this.fields?.breakByField && !this.isDisabled(this.selectedSeries?.BreakBy.FieldID, this.breakByFieldType)) || 
            this.fields?.seriesKey=='' || this.fields?.fromDate=='' || this.fields?.toDate=='')
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
  Object.keys(singleObject).forEach(field => {
    Objectfields.push({
      FieldID: field,
      Type: type,
      Title: field,
      Mandatory: false,
      ReadOnly: true
    })
  });
  return Objectfields;
}

}
