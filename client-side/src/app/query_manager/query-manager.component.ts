import { Component, EventEmitter, Input, OnInit, Output, ViewChild, ViewContainerRef } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { TranslateService } from '@ngx-translate/core';
import { IPepGenericListActions, IPepGenericListDataSource, IPepGenericListInitData, IPepGenericListPager, PepGenericListService } from "@pepperi-addons/ngx-composite-lib/generic-list";
import { PepDialogData, PepDialogService } from '@pepperi-addons/ngx-lib/dialog';
import { PepSelectionData } from '@pepperi-addons/ngx-lib/list';
import { PepMenuItem } from '@pepperi-addons/ngx-lib/menu';
import { AddonService } from 'src/services/addon.service';
import { UtilitiesService } from 'src/services/utilities.service';
import { v4 as uuid } from 'uuid';
import { DIMXHostObject, PepDIMXHelperService } from '@pepperi-addons/ngx-composite-lib'
import { IPepFormFieldClickEvent } from '@pepperi-addons/ngx-lib/form';
import { PepAddonBlockLoaderService } from '@pepperi-addons/ngx-lib/remote-loader';

export type FormMode = 'Add' | 'Edit';
export const EMPTY_OBJECT_NAME = 'NewCollection';

import { config } from '../addon.config';
import { QueryPreFormComponent } from '../query-pre-form/query-pre-form.component';

@Component({
  selector: 'query-manager',
  templateUrl: './query-manager.component.html',
  styleUrls: ['./query-manager.component.scss']
})
export class QueryManagerComponent implements OnInit {
    @Input() hostObject: any;

    @Output() hostEvents: EventEmitter<any> = new EventEmitter<any>();

    @ViewChild('addonLoaderContainer', { read: ViewContainerRef }) addonLoaderContainer: ViewContainerRef;

    dataSource: IPepGenericListDataSource = this.getDataSource();
  
    menuItems:PepMenuItem[] = []

    recycleBin: boolean = false;
    recycleBinTitle = '';

    deleteError = 'Cannot delete Query';

    constructor(
        public addonService: AddonService,
        public translate: TranslateService,
        public genericListService: PepGenericListService,
        public activateRoute: ActivatedRoute,
        private router: Router,
        public dialogService: PepDialogService,
        public utilitiesService: UtilitiesService,
        private viewContainer: ViewContainerRef,
        private dimxService: PepDIMXHelperService,
        private addonBlockLoaderService: PepAddonBlockLoaderService
    ) { }


  ngOnInit(): void {
    this.recycleBin = this.activateRoute.snapshot.queryParams.recycle_bin == 'true' || false;
    this.utilitiesService.addonUUID = config.AddonUUID;
    this.menuItems = this.getMenuItems();
    this.addonService.addonUUID = config.AddonUUID;
    this.dataSource = this.getDataSource();
    const dimxHostObject: DIMXHostObject = {
        DIMXAddonUUID: this.utilitiesService.addonUUID,
        DIMXResource: 'DataQueries'
    }
    this.dimxService.register(this.viewContainer, dimxHostObject, (dimxEvent) => {
        this.dataSource = this.getDataSource();
    })
  }

  uuidGenerator(){
      return uuid();
  }

  getMenuItems() {
        return [{
            key:'Import',
            text: this.translate.instant('Import'),
            hidden: this.recycleBin
        },
        {
            key: 'RecycleBin',
            text: this.translate.instant('Recycle Bin'),
            hidden: this.recycleBin
        },
        {
            key: 'BackToList',
            text: this.translate.instant('Back to list'),
            hidden: !this.recycleBin
        }]
    }

  getDataSource() {
    const noDataMessageKey = this.recycleBin ? 'RecycleBin_NoDataFound' : 'Query_Manager_NoDataFound'
    return {
        init: async(params:any) => {
            let queries = await this.addonService.getAllQueries();
            if(this.recycleBin) {
                queries = await this.utilitiesService.getRecycledQueries();
            }
            if(params.searchString){
                queries = await this.utilitiesService.getQueriesByName(params.searchString);
            }
            queries = this.utilitiesService.caseInsensitiveSortByName(queries);

            return Promise.resolve({
                dataView: {
                    Context: {
                        Name: '',
                        Profile: { InternalID: 0 },
                        ScreenSize: 'Landscape'
                    },
                    Type: 'Grid',
                    Title: 'Query Manager',
                    Fields: [
                        {
                            FieldID: 'Name',
                            Type: this.recycleBin ? 'TextBox' : 'Link',
                            Title: this.translate.instant('Name'),
                            Mandatory: false,
                            ReadOnly: true
                        },
                        {
                            FieldID: 'Resource',
                            Type: 'TextBox',
                            Title: this.translate.instant('Resource'),
                            Mandatory: false,
                            ReadOnly: true
                        },
                    ],
                    Columns: [
                        {
                            Width: 50
                        },
                        {
                            Width: 50
                        }
                    ],
      
                    FrozenColumnsCount: 0,
                    MinimumColumnWidth: 0
                },
                totalCount: queries.length,
                items: queries
            });
        },
        inputs: () => {
            return Promise.resolve({
                pager: {
                    type: 'scroll'
                },
                selectionType: 'single',
                noDataFoundMsg: this.translate.instant(noDataMessageKey)
            });
        },
    } as IPepGenericListDataSource
}

actions: IPepGenericListActions = {
    get: async (data: PepSelectionData) => {
        const actions = [];
        if (data && data.rows.length == 1) {
            if(this.recycleBin) {
                actions.push({
                    title: this.translate.instant('Restore'),
                    handler: async (objs) => {
                        await this.addonService.upsertDataQuery({
                            Key: objs.rows[0],
                            Hidden: false,
                        });
                        this.dataSource = this.getDataSource();
                    }
                })
            }
            else {
                actions.push({
                    title: this.translate.instant('Edit'),
                    handler: async (objs) => {
                        this.navigateToQueryForm('Edit', objs.rows[0]);
                    }
                });
                actions.push({
                    title: this.translate.instant('Delete'),
                    handler: async (objs) => {
                        this.showDeleteDialog(objs.rows[0]);
                    }
                })
                actions.push({
                    title: this.translate.instant('Export'),
                    handler: async (objs) => {
                        this.exportQueryScheme(objs.rows[0]);
                    }
                })
                actions.push({
                    title: this.translate.instant('Duplicate'),
                    handler: async (objs) => {
                        this.duplicateQuery(objs.rows[0]);
                    }
                })
                actions.push({
                    title: this.translate.instant('Show history'),
                    handler: async (objs) => {
                        this.openDataLogDialog(objs.rows[0]);
                    }
                })
            }
        }
        return actions;
    }
}

menuItemClick(event: any) {
    switch (event.source.key) {
        case 'RecycleBin':
        case 'BackToList': {
            this.recycleBin = !this.recycleBin;
            this.recycleBinTitle = this.recycleBin ? 'Recycle Bin' : '';
            setTimeout(() => {
                this.router.navigate([], {
                    queryParams: {
                        recycle_bin: this.recycleBin
                    },
                    queryParamsHandling: 'merge',
                    relativeTo: this.activateRoute,
                    replaceUrl: true
                })
            }, 0);
            this.dataSource = this.getDataSource();
            this.menuItems = this.getMenuItems();
            break;
        }
        case 'Import':{
            this.dimxService.import({
                OverwriteObject: false,
                Delimiter: ",",
                OwnerID: this.utilitiesService.addonUUID
            });
            this.dataSource = this.getDataSource();
            break;
        }
    }
}

//when creating new query, unique uuid is generated
navigateToQueryForm(mode: FormMode, uuid: string) {
    this.router['form_mode'] = mode;
    this.router.navigate([uuid], {
        relativeTo: this.activateRoute,
        queryParamsHandling: 'preserve',
        state: {form_mode: 'Edit'}
    })
}

showDeleteDialog(uuid: any) {
    const dataMsg = new PepDialogData({
        title: this.translate.instant('Query_DeleteDialogTitle'),
        actionsType: 'cancel-delete',
        content: this.translate.instant('Query_DeleteDialogContent')
    });
    this.dialogService.openDefaultDialog(dataMsg).afterClosed()
        .subscribe(async (isDeletePressed) => {
            if (isDeletePressed) {
                try {
                    await this.addonService.upsertDataQuery({
                        Key: uuid,
                        Hidden: true,
                    });
                    this.dataSource = this.getDataSource();
                }
                catch (error) {
                    if (error.message.indexOf(this.deleteError) > 0)
                    {
                        const dataMsg = new PepDialogData({
                            title: this.translate.instant('Query_DeleteDialogTitle'),
                            actionsType: 'close',
                            content: this.translate.instant('Query_DeleteDialogError')
                        });
                        this.dialogService.openDefaultDialog(dataMsg);
                    }
                }
            }
    });      
}

onDIMXProcessDone(event){
    this.dataSource = this.getDataSource();
}

exportQueryScheme(queryKey) {
    this.dimxService?.export({
        DIMXExportFormat: "csv",
        DIMXExportIncludeDeleted: false,
        DIMXExportFileName: queryKey,
        DIMXExportWhere: `Key LIKE '${queryKey}'`,
        DIMXExportFields: 'Key,Name,Resource,Series,Variables',
        DIMXExportDelimiter: ","
    });
}

openDataLogDialog(queryKey) {
    const dataLogHostObject = {
        AddonUUID: this.utilitiesService.addonUUID,
        ObjectKey: queryKey,
        Resource: "DataQueries"
    }
    const dialogRef = this.addonBlockLoaderService.loadAddonBlockInDialog({
        container: this.viewContainer,
        name: 'Audit_Data_Log',
        hostObject: dataLogHostObject,
        hostEventsCallback: (event) => { 
            this.hostEvents.emit(event);
            if (dialogRef) {
                dialogRef.close(null);
            }
        }
    });
}

onCustomizeFieldClick(fieldClickEvent: IPepFormFieldClickEvent) {
    this.navigateToQueryForm('Edit', fieldClickEvent.id);
}

async openPreFormDialog() {
    this.dialogService.openDialog(QueryPreFormComponent).afterClosed().subscribe(async res => {
        if(res?.moveToQueryForm) {
            const query = {
                Key: this.uuidGenerator(),
                Name: res.name,
                Resource: res.resource,
                Series: [],
                Variables: [],
                Style: 'Decimal',
                Currency: (await this.addonService.get('/distributor')).Currency.Name
            }
            await this.addonService.upsertDataQuery(query);
            this.navigateToQueryForm('Edit', query.Key);
        }
    });
}

async duplicateQuery(key) {
    let originalQuery = (await this.addonService.getDataQueryByKey(key))[0];
    originalQuery.Key = this.uuidGenerator();
    originalQuery.Name = `${originalQuery.Name}-copy`;
    await this.addonService.upsertDataQuery(originalQuery);
    this.dataSource = this.getDataSource();
}


}
