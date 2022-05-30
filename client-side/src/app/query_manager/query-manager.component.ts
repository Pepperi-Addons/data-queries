import { Component, EventEmitter, Input, OnInit, Output, ViewChild } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { TranslateService } from '@ngx-translate/core';
import { IPepGenericListActions, IPepGenericListDataSource, IPepGenericListInitData, IPepGenericListPager, PepGenericListService } from "@pepperi-addons/ngx-composite-lib/generic-list";
import { PepDialogData, PepDialogService } from '@pepperi-addons/ngx-lib/dialog';
import { PepSelectionData } from '@pepperi-addons/ngx-lib/list';
import { PepMenuItem } from '@pepperi-addons/ngx-lib/menu';
import { AddonService } from 'src/services/addon.service';
import { UtilitiesService } from 'src/services/utilities.service';
import { v4 as uuid } from 'uuid';
import { DIMXComponent } from '@pepperi-addons/ngx-composite-lib/dimx-export';
import { IPepFormFieldClickEvent } from '@pepperi-addons/ngx-lib/form';

export type FormMode = 'Add' | 'Edit';
export const EMPTY_OBJECT_NAME = 'NewCollection';

@Component({
  selector: 'query-manager',
  templateUrl: './query-manager.component.html',
  styleUrls: ['./query-manager.component.scss']
})
export class QueryManagerComponent implements OnInit {
    @Input() hostObject: any;
    
    @Output() hostEvents: EventEmitter<any> = new EventEmitter<any>();

    @ViewChild('dimx') dimx:DIMXComponent | undefined;

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
    public utilitiesService: UtilitiesService) { }


  ngOnInit(): void {
    this.recycleBin = this.activateRoute.snapshot.queryParams.recycle_bin == 'true' || false;
    this.utilitiesService.addonUUID = this.activateRoute.snapshot.params.addon_uuid || '';
    this.menuItems = this.getMenuItems();
    this.addonService.addonUUID = this.activateRoute.snapshot.params['addon_uuid'];
    this.dataSource = this.getDataSource();
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
            queries = queries.sort(function(a, b) {
                const nameA = a.Name.toUpperCase(); // ignore upper and lowercase
                const nameB = b.Name.toUpperCase(); // ignore upper and lowercase
                if (nameA < nameB) {
                  return -1;
                }
                if (nameA > nameB) {
                  return 1;
                }

                // names must be equal
                return 0;
              });

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
                            Type: 'Link',
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
            this.dimx?.uploadFile({
                OverwriteOBject: true,
                Delimiter: ",",
                OwnerID: this.utilitiesService.addonUUID
            });
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

onDIMXProcessDone($event){
    debugger
    this.dataSource = this.getDataSource();
}

exportQueryScheme(queryKey){
    this.dimx?.DIMXExportRun({
        DIMXExportFormat: "csv",
        DIMXExportIncludeDeleted: false,
        DIMXExportFileName: queryKey,
        DIMXExportWhere: `Key LIKE '${queryKey}'`,
        DIMXExportFields: 'Key,Name,Resource,Series',
        DIMXExportDelimiter: ","
    });
}

onCustomizeFieldClick(fieldClickEvent: IPepFormFieldClickEvent) {
    this.navigateToQueryForm('Edit', fieldClickEvent.id);
}

}
