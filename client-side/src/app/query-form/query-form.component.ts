import { Component, OnInit, TemplateRef, ViewChild, ViewContainerRef } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { TranslateService } from '@ngx-translate/core';
import { IPepGenericListActions, IPepGenericListDataSource, PepGenericListService } from '@pepperi-addons/ngx-composite-lib/generic-list';
import { PepDialogActionButton, PepDialogData, PepDialogService } from '@pepperi-addons/ngx-lib/dialog';
import { PepSelectionData } from '@pepperi-addons/ngx-lib/list';
import { AddonService } from 'src/services/addon.service';
import { UtilitiesService } from 'src/services/utilities.service';
import { PepButton } from '@pepperi-addons/ngx-lib/button';
import { SeriesEditorComponent } from '../series-editor/series-editor.component';
import { DataQuery } from '../../../../server-side/models/data-query';
import { PepLoaderService } from '@pepperi-addons/ngx-lib';
import { GridDataViewField } from '@pepperi-addons/papi-sdk';
import { MatDialogRef } from '@angular/material/dialog';
import { IPepFormFieldClickEvent } from '@pepperi-addons/ngx-lib/form';
import { VariableEditorComponent } from '../variable-editor/variable-editor.component';



@Component({
  selector: 'query-form',
  templateUrl: './query-form.component.html',
  styleUrls: ['./query-form.component.scss']
})
export class QueryFormComponent implements OnInit {
  
  query: DataQuery;
  mode: string;
  temp: string;
  queryUUID: string;
  querySaved: boolean = false;
  resourceRelations: Array<any> = [];
  resourceOptions: Array<any> = [];
  queryLoaded: boolean = false;
  seriesDataSource: IPepGenericListDataSource = this.getSeriesDataSource();
  variablesDataSource: IPepGenericListDataSource = this.getVariablesDataSource();
  deleteError = 'Cannot delete Series';
  previewDataSource: IPepGenericListDataSource;
  PreviewListFields: GridDataViewField[];
  dialogRef: MatDialogRef<any>;

  constructor(
    public addonService: AddonService,
    public translate: TranslateService,
    public genericListService: PepGenericListService,
    public activateRoute: ActivatedRoute,
    private router: Router,
    public dialogService: PepDialogService,
    private utilitiesService: UtilitiesService,
    public loaderService: PepLoaderService) { }

   async ngOnInit() {
        this.queryUUID = this.activateRoute.snapshot.params.query_uuid;
        this.addonService.addonUUID = this.activateRoute.snapshot.params['addon_uuid'];
        this.resourceRelations = await this.addonService.getResourceTypesFromRelation();
        this.resourceOptions = this.resourceRelations.map((resource) => {
          return { key: resource.Name, value: resource.Name }
        }); //[{key:"all_activities",value:"all_activities"},{key:"transaction_lines",value:"transaction_lines"}];
        this.mode = this.router['form_mode']
        this.query = this.emptyQuery() as DataQuery;
        this.query.Key = this.queryUUID;
        if (this.mode == 'Edit') {
            this.query = (await this.addonService.getDataQueryByKey(this.queryUUID))[0]
            this.querySaved = true;
        }
        this.queryLoaded = true;
        this.seriesDataSource = this.getSeriesDataSource();
        this.variablesDataSource = this.getVariablesDataSource();
        this.previewDataSource = this.getPreviewDataSource();


   }

  async saveClicked() {
    try {
        if(this.query.Name && this.query.Resource){
            await this.addonService.upsertDataQuery(this.query);
            this.querySaved = true;
        }
    }
    catch (error) {
        const errors = this.utilitiesService.getErrors(error.message);
        const dataMsg = new PepDialogData({
            title: this.translate.instant('Query_UpdateFailed_Title'),
            actionsType: 'close',
            content: this.translate.instant('Query_UpdateFailed_Content', {error: errors.map(error=> `<li>${error}</li>`)})
        });
        this.dialogService.openDefaultDialog(dataMsg);
    }
  } 

  goBack() {
    this.router.navigate(['..'], {
        relativeTo: this.activateRoute,
        queryParamsHandling: 'preserve'
    })
  }

  resourceChanged(e){

  }

  showSeriesEditorDialog(seriesKey) {
    const seriesCount = this.query.Series?.length ? this.query.Series?.length : 0
    const series = this.query.Series.filter(s => s.Key == seriesKey)[0]
    const callbackFunc = async (seriesToAddOrUpdate) => {
        this.addonService.addonUUID = this.activateRoute.snapshot.params['addon_uuid'];
        if (seriesToAddOrUpdate) {
            seriesToAddOrUpdate.Resource = this.query.Resource;
            this.updateQuerySeries(seriesToAddOrUpdate);
            this.query = await this.addonService.upsertDataQuery(this.query);
            this.seriesDataSource = this.getSeriesDataSource();
            this.previewDataSource = this.getPreviewDataSource();
        }
    }

    const actionButton: PepDialogActionButton = {
        title: "OK",
        className: "",
        callback: null,
    };
    const input = {
      currentSeries: series,
      parent: 'query',
      seriesName: series?.Name ? series.Name : `Series ${seriesCount + 1}`,
      resource: this.query?.Resource,
      resourceRelationData: this.resourceRelations.filter(r => r.Name == this.query?.Resource)[0],
      inputVariables: this.query?.Variables
    };
    this.openDialog(this.translate.instant('EditQuery'), SeriesEditorComponent, actionButton, input, callbackFunc);
  }

  protected updateQuerySeries(seriesToAddOrUpdate: any) {
    const idx = this.query?.Series?.findIndex(item => item.Key === seriesToAddOrUpdate.Key);
    if (idx > -1) {
        this.query.Series[idx] = seriesToAddOrUpdate;
    }
    else {
        if (!this.query?.Series) {
            this.query.Series = [];
        }
        this.query.Series.push(seriesToAddOrUpdate);
    }
    return this.query;
  }

  protected updateQueryVariables(varToAddOrUpdate: any) {
    const idx = this.query?.Variables?.findIndex(item => item.Key === varToAddOrUpdate.Key);
    if (idx > -1) {
        this.query.Variables[idx] = varToAddOrUpdate;
    }
    else {
        if (!this.query?.Variables) {
            this.query.Variables = [];
        }
        this.query.Variables.push(varToAddOrUpdate);
    }
    return this.query;
  }

  seriesActions: IPepGenericListActions = {
    get: async (data: PepSelectionData) => {
        const actions = [];
        if (data && data.rows.length == 1) {
            actions.push({
                title: this.translate.instant('Edit'),
                handler: async (objs) => {
                    this.showSeriesEditorDialog(objs.rows[0]);
                }
            });
            actions.push({
                title: this.translate.instant('Delete'),
                handler: async (objs) => {
                    this.showDeleteDialog(objs.rows[0],'Series');
                }
            })
        }
        return actions;
    }
  }

  getSeriesDataSource() {
    return {
        init: async(params:any) => {
            let series = this.query.Series?.map(s => {
                return {
                    Key: s.Key,
                    Name: s.Name,
                    Aggregator: s.AggregatedFields[0].Aggregator,
                    FieldName: s.AggregatedFields[0].FieldID
                }
            })
            return Promise.resolve({
                dataView: {
                    Context: {
                        Name: '',
                        Profile: { InternalID: 0 },
                        ScreenSize: 'Landscape'
                    },
                    Type: 'Grid',
                    Title: '',
                    Fields: [
                        {
                            FieldID: 'Name',
                            Type: 'Link',
                            Title: this.translate.instant('Name'),
                            Mandatory: false,
                            ReadOnly: true
                        },
                        {
                            FieldID: 'Aggregator',
                            Type: 'TextBox',
                            Title: this.translate.instant('Aggregator'),
                            Mandatory: false,
                            ReadOnly: true
                        },
                        {
                            FieldID: 'FieldName',
                            Type: 'TextBox',
                            Title: this.translate.instant('Field'),
                            Mandatory: false,
                            ReadOnly: true
                        },
                    ],
                    Columns: [
                        {
                            Width: 33
                        },
                        {
                            Width: 33
                        },
                        {
                            Width: 33
                        }
                    ],
                    FrozenColumnsCount: 0,
                    MinimumColumnWidth: 0
                },
                totalCount: series?.length,
                items: series
            });
        },
        inputs: () => {
            return Promise.resolve({
                pager: {
                    type: 'scroll'
                },
                selectionType: 'single',
                noDataFoundMsg: this.translate.instant('Series_NoDataFound')
            });
        },
    } as IPepGenericListDataSource
    }


    emptyQuery(){
        return {
            Name: '',
            Series: [],
            Variables: []
        }
    }

  showDeleteDialog(itemKey: any, property: 'Series'|'Variables') {
    // variable which is used by a defined series cannot be deleted
    if(property=='Variables' && this.variableInUse(itemKey)) {
        const actionButton: PepDialogActionButton = {
            title: "OK",
            className: "",
            callback: null
        };
        const dialogData = new PepDialogData({
            title: "Cannot delete variable",
            content: "There is a series which uses this variable.",
            actionButtons: [actionButton],
            actionsType: "custom",
            showClose: false
        });
        this.dialogService.openDefaultDialog(dialogData);
        return;          
    }
    const dataMsg = new PepDialogData({
        title: this.translate.instant(`${property}_DeleteDialogTitle`),
        actionsType: 'cancel-delete',
        content: this.translate.instant(`${property}_DeleteDialogContent`)
    });
    this.dialogService.openDefaultDialog(dataMsg).afterClosed()
        .subscribe(async (isDeletePressed) => {
            if (isDeletePressed) {
                try {
                    const idx = this.query[property].findIndex(item => item.Key === itemKey);
                    if (idx > -1) {
                        this.query[property].splice(idx, 1);
                    }
                    this.addonService.upsertDataQuery(this.query).then((res) => {
                    this.query = res;
                });
                this.seriesDataSource = this.getSeriesDataSource();
                this.variablesDataSource = this.getVariablesDataSource();
                this.previewDataSource = this.getPreviewDataSource();
                }
                catch (error) {
                    if (error.message.indexOf(this.deleteError) > 0)
                    {
                        const dataMsg = new PepDialogData({
                            title: this.translate.instant(`${property}_DeleteDialogTitle`),
                            actionsType: 'close',
                            content: this.translate.instant(`${property}_DeleteDialogError`)
                        });
                        this.dialogService.openDefaultDialog(dataMsg);
                    }
                }
            }
        });
    }

    variableInUse(varKey: string) : boolean {
        const varName = this.query.Variables.filter(v => v.Key === varKey)[0].Name
        for( const s of this.query.Series) {
            if(this.filterIsUsingGivenVar(s.Filter,varName)) return true
        }
        return false
    }

    filterIsUsingGivenVar(jsonFilter: any, varName: string) : boolean {
        if (jsonFilter.Operation === 'AND' || jsonFilter.Operation === 'OR') {
            const f1 = this.filterIsUsingGivenVar(jsonFilter.LeftNode, varName);
            const f2 = this.filterIsUsingGivenVar(jsonFilter.RightNode, varName);
            return f1 || f2;
        } else {
            const values: string[] = jsonFilter.Values;
            return values.includes(varName)
        }
    }

// need to excecute the query
getPreviewDataSource() {
    return {
        init: async(params:any) => {
            this.loaderService.show();
            let varValues = {}
            for(const v of this.query.Variables) {
                varValues[v.Name] = v.PreviewValue
            }
            const body = {"VariableValues": varValues}
            const data = this.querySaved ? await this.addonService.executeQuery(this.query?.Key, body) : {DataSet: [], DataQueries: []};
            let results = await this.previewDataHandler(data);
            let size = data.DataSet.length;
            for(let s of data.DataQueries)
                size+=s.Series.length+s.Groups.length;

            this.loaderService.hide();
            return Promise.resolve({
                dataView: {
                    Context: {
                        Name: '',
                        Profile: { InternalID: 0 },
                        ScreenSize: 'Landscape'
                    },
                    Type: 'Grid',
                    Title: '',
                    Fields: this.PreviewListFields,
                    Columns: Array(size).fill({ Width: 0 }),
                    FrozenColumnsCount: 0,
                    MinimumColumnWidth: 0
                },
                totalCount: results?.length,
                items: results
            });
        },
        inputs: () => {
            return Promise.resolve({
                pager: {
                    type: 'scroll'
                },
                selectionType: 'none',
                noDataFoundMsg: this.translate.instant('Series_NoDataFound')
            }) 
        },
    } as IPepGenericListDataSource
}

async previewDataHandler(data) {
    try {
        if (!data) return [];
        data.DataSet.forEach(dataSet => {
            for (const i in dataSet)
                if (i == "") {
                    dataSet['None'] = dataSet[i]
                    delete dataSet[i]
                }
        })
        data.DataQueries.forEach(dq => {
            for (const i in dq.Series)
                if (dq.Series[i] == "") dq.Series[i] = 'None'
        })
        
        let previewDataSet = []
        // flat the series & groups
        const series = data.DataQueries.map((data) => data.Series).reduce((x, value) => x.concat(value), []);
        const groups = data.DataQueries.map((data) => data.Groups).reduce((x, value) => x.concat(value), []);

        const distinctSeries = this.getDistinct(series);
        const distinctgroups = this.getDistinct(groups);

        data.DataSet.forEach(dataSet => {
            for(let i in dataSet) {
                dataSet[i]+='';
            }
            previewDataSet.push(dataSet);
        });
        this.PreviewListFields = this.getPreviewListFields([...distinctgroups,...distinctSeries]);
        return previewDataSet;
    }
    catch (err) {
        console.log(err);
      }
  }

  getDistinct(arr) {
    return arr.filter(function (elem, index, self) {
      return index === self.indexOf(elem);
    });
  }

  private getPreviewListFields(fields): GridDataViewField[] {
    let previewFields = [];
    fields.forEach(field => {
        previewFields.push({
        FieldID: field,
        Type: 'NumberReal',
        Title: field,
        Mandatory: false,
        ReadOnly: true
      })
    });
    return previewFields;
  }

  openDialog(title, content, buttons, input, callbackFunc = null): void {
    const config = this.dialogService.getDialogConfig(
        {
            disableClose: true,
            panelClass: 'pepperi-standalone'
        },
        'inline'
    );
    const data = new PepDialogData({
        title: title,
        content: content,
        actionButtons: buttons,
        actionsType: "custom",
        showHeader: true,
        showFooter: true,
        showClose: true
    })
    config.data = data;

    this.dialogRef = this.dialogService.openDialog(content, input, config);
    this.dialogRef.afterClosed().subscribe(res => {
        callbackFunc(res);
    });
  }

    onSeriesNameClick(fieldClickEvent: IPepFormFieldClickEvent) {
        this.showSeriesEditorDialog(fieldClickEvent.id);
    }

    onVariableNameClick(fieldClickEvent: IPepFormFieldClickEvent) {
        this.showVariableEditorDialog(fieldClickEvent.id, 'Edit');
    }

    variableActions: IPepGenericListActions = {
        get: async (data: PepSelectionData) => {
            const actions = [];
            if (data && data.rows.length == 1) {
                actions.push({
                    title: this.translate.instant('Edit'),
                    handler: async (objs) => {
                        this.showVariableEditorDialog(objs.rows[0],'Edit');
                    }
                });
                actions.push({
                    title: this.translate.instant('Delete'),
                    handler: async (objs) => {
                        this.showDeleteDialog(objs.rows[0],'Variables');
                    }
                })
            }
            return actions;
        }
    }

    showVariableEditorDialog(variableKey, mode = 'Add') {
        const varsCount = this.query.Variables?.length ? this.query.Variables?.length : 0
        const currVariable = this.query.Variables.filter(v => v.Key == variableKey)[0]
        const callbackFunc = async (variableToAddOrUpdate) => {
            this.addonService.addonUUID = this.activateRoute.snapshot.params['addon_uuid'];
            if (variableToAddOrUpdate) {
                if(mode == 'Add' && this.query.Variables.filter(v => v.Name == variableToAddOrUpdate.Name).length > 0) {
                    const actionButton: PepDialogActionButton = {
                        title: "OK",
                        className: "",
                        callback: null
                    };
                    const dialogData = new PepDialogData({
                        title: "Cannot add variable",
                        content: "Variable name is already taken.",
                        actionButtons: [actionButton],
                        actionsType: "custom",
                        showClose: false
                    });
                    this.dialogService.openDefaultDialog(dialogData);
                    return;
                }
                this.updateQueryVariables(variableToAddOrUpdate);
                this.query = await this.addonService.upsertDataQuery(this.query);
                this.variablesDataSource = this.getVariablesDataSource();
                this.previewDataSource = this.getPreviewDataSource();
            }
        }
    
        const actionButton: PepDialogActionButton = {
            title: "OK",
            className: "",
            callback: null,
        };
        const input = {
          currentVariable: currVariable,
          parent: 'query',
          varName: currVariable?.Name ? currVariable.Name : `var${varsCount + 1}`
        };
        this.openDialog(this.translate.instant('Edit Variable'), VariableEditorComponent, actionButton, input, callbackFunc);
      }

      getVariablesDataSource() {
        return {
            init: async(params:any) => {
                const variables = this.query.Variables?.map(v => {
                    return {
                        Key: v.Key,
                        Name: v.Name,
                        Type: v.Type,
                        DefaultValue: v.DefaultValue,
                        PreviewValue: v.PreviewValue
                    }
                })
                return Promise.resolve({
                    dataView: {
                        Context: {
                            Name: '',
                            Profile: { InternalID: 0 },
                            ScreenSize: 'Landscape'
                        },
                        Type: 'Grid',
                        Title: '',
                        Fields: [
                            {
                                FieldID: 'Name',
                                Type: 'Link',
                                Title: this.translate.instant('Name'),
                                Mandatory: false,
                                ReadOnly: true
                            },
                            {
                                FieldID: 'Type',
                                Type: 'TextBox',
                                Title: this.translate.instant('Type'),
                                Mandatory: false,
                                ReadOnly: true
                            },
                            {
                                FieldID: 'DefaultValue',
                                Type: 'TextBox',
                                Title: this.translate.instant('Default Value'),
                                Mandatory: false,
                                ReadOnly: true
                            },
                            {
                                FieldID: 'PreviewValue',
                                Type: 'TextBox',
                                Title: this.translate.instant('Preview Value'),
                                Mandatory: false,
                                ReadOnly: true
                            }
                        ],
                        Columns: [
                            {
                                Width: 25
                            },
                            {
                                Width: 25
                            },
                            {
                                Width: 25
                            },
                            {
                                Width: 25
                            }
                        ],
                        FrozenColumnsCount: 0,
                        MinimumColumnWidth: 0
                    },
                    totalCount: variables?.length,
                    items: variables
                });
            },
            inputs: () => {
                return Promise.resolve({
                    pager: {
                        type: 'scroll'
                    },
                    selectionType: 'single',
                    noDataFoundMsg: this.translate.instant('Variables_NoDataFound')
                });
            },
        } as IPepGenericListDataSource
    }

}
