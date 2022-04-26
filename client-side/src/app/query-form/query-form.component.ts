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
  resourceOptions: Array<PepButton> = [];
  queryLoaded: boolean = false;
  seriesDataSource: IPepGenericListDataSource = this.getSeriesDataSource();
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
        this.resourceOptions = [{key:"all_activities",value:"all_activities"},{key:"transaction_lines",value:"transaction_lines"}]; // need to take from relation
        this.mode = this.router['form_mode']
        this.query = this.emptyQuery() as DataQuery;
        this.query.Key = this.queryUUID;
        if (this.mode == 'Edit') {
            this.query = (await this.addonService.getDataQueryByKey(this.queryUUID))[0]
        }
        this.queryLoaded = true;
        this.seriesDataSource = this.getSeriesDataSource();
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
      seriesName: series?.Name ? series.Name : `Series ${seriesCount + 1}`
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

  seriesActions: IPepGenericListActions = {
    get: async (data: PepSelectionData) => {
        const actions = [];
        if (data && data.rows.length == 1) {
            actions.push({
                title: this.translate.instant('Edit'),
                handler: async (objs) => {
                    this.showSeriesEditorDialog(objs.rows[0]); // expecting the series key but getting some random uuid
                }
            });
            actions.push({
                title: this.translate.instant('Delete'),
                handler: async (objs) => {
                    this.showDeleteDialog(objs.rows[0]); // expecting the series key but getting some random uuid
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
                            Type: 'TextBox',
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
        Series: []
    }
}

  showDeleteDialog(serieKey: any) {
    const dataMsg = new PepDialogData({
        title: this.translate.instant('Serie_DeleteDialogTitle'),
        actionsType: 'cancel-delete',
        content: this.translate.instant('Serie_DeleteDialogContent')
    });
    this.dialogService.openDefaultDialog(dataMsg).afterClosed()
        .subscribe(async (isDeletePressed) => {
            if (isDeletePressed) {
                try {
                    const idx = this.query.Series.findIndex(item => item.Key === serieKey);
                    if (idx > -1) {
                        this.query.Series.splice(idx, 1);
                    }
                    this.addonService.upsertDataQuery(this.query).then((res) => {
                    this.query = res;
                    //this.executeQuery = true;
                    //this.updateHostObject();
                });
                this.seriesDataSource = this.getSeriesDataSource();
                this.previewDataSource = this.getPreviewDataSource();
                }
                catch (error) {
                    if (error.message.indexOf(this.deleteError) > 0)
                    {
                        const dataMsg = new PepDialogData({
                            title: this.translate.instant('Serie_DeleteDialogTitle'),
                            actionsType: 'close',
                            content: this.translate.instant('Serie_DeleteDialogError')
                        });
                        this.dialogService.openDefaultDialog(dataMsg);
                    }
                }
            }
    });      
}

// need to excecute the query
getPreviewDataSource() {
    return {
        init: async(params:any) => {
            this.loaderService.show();
            const data = this.querySaved ? await this.addonService.executeQuery(this.query?.Key) : null;
            let results = await this.previewDataHandler(data);
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
                    Columns: [
                        { Width: 0 },
                        { Width: 0 },
                        { Width: 0 },
                        { Width: 0 },
                        { Width: 0 },
                    ],
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

async previewDataHandler(data){
    if (!data) return [];
    let previewDataSet = []
      try {
        // flat the series & groups
        const series = data.DataQueries.map((data) => data.Series).reduce((x, value) => x.concat(value), []);
        const groups = data.DataQueries.map((data) => data.Groups).reduce((x, value) => x.concat(value), []);

        const distinctSeries = this.getDistinct(series);
        const distinctgroups = this.getDistinct(groups);

        data.DataSet.forEach(dataSet => {
            previewDataSet.push(dataSet);
        });
        previewDataSet = previewDataSet.slice();
        this.PreviewListFields = this.getPreviewListFields([...distinctgroups,...distinctSeries]);
      }
      catch (err) {
        console.log(err);
      }

    return previewDataSet;
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
        Type: 'TextBox',
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

}
