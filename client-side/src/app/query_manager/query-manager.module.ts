import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Routes } from '@angular/router';
import { HttpClientModule } from '@angular/common/http';
import { QueryManagerComponent } from './query-manager.component'
import { PepNgxLibModule, PepAddonService, PepTextboxField } from '@pepperi-addons/ngx-lib';
import { PepTopBarModule } from '@pepperi-addons/ngx-lib/top-bar';
import { PepSizeDetectorModule } from '@pepperi-addons/ngx-lib/size-detector';
import { PepPageLayoutModule } from '@pepperi-addons/ngx-lib/page-layout';
import { PepIconRegistry, pepIconSystemClose } from '@pepperi-addons/ngx-lib/icon';
import { AddonService } from '../../services/addon.service';
import { TranslateLoader, TranslateModule, TranslateService, TranslateStore } from '@ngx-translate/core';
import { PepGenericListModule } from '@pepperi-addons/ngx-composite-lib/generic-list';
import { PepGenericFormModule } from '@pepperi-addons/ngx-composite-lib/generic-form';
import { PepMenuModule } from '@pepperi-addons/ngx-lib/menu';
import { PepButtonModule } from '@pepperi-addons/ngx-lib/button';
import { QueryFormComponent } from '../query-form/query-form.component';
import { PepSelectModule } from '@pepperi-addons/ngx-lib/select';
import { PepTextboxModule } from '@pepperi-addons/ngx-lib/textbox';
import { PepNgxCompositeLibModule } from '@pepperi-addons/ngx-composite-lib';
import { PepRemoteLoaderModule } from '@pepperi-addons/ngx-lib/remote-loader';
import { PepDialogModule } from '@pepperi-addons/ngx-lib/dialog';
import { MatDialogModule } from '@angular/material/dialog';


const pepIcons = [
    pepIconSystemClose,
];

export const routes: Routes = [
    {
        path: '',
        component: QueryManagerComponent
    }
];

@NgModule({
    declarations: [
        QueryManagerComponent,
        QueryFormComponent
    ],
    imports: [
        CommonModule,
        HttpClientModule,
        PepNgxLibModule,
        PepSizeDetectorModule,
        PepGenericListModule,
        PepGenericFormModule,
        PepButtonModule,
        PepMenuModule,
        PepTopBarModule,
        PepPageLayoutModule,
        PepSelectModule,
        PepDialogModule,
        PepTextboxModule,
        PepNgxCompositeLibModule,
        PepRemoteLoaderModule,
        MatDialogModule,
        TranslateModule.forChild({
            loader: {
                provide: TranslateLoader,
                useFactory: PepAddonService.createMultiTranslateLoader,
                deps: [PepAddonService]
            }, isolate: false
        }),
        RouterModule.forChild(routes)
    ],
    exports:[QueryManagerComponent],
    providers: [
        TranslateStore,
        // When loading this module from route we need to add this here (because only this module is loading).
        AddonService
    ]
})
export class QueryManagerModule {
    constructor(
        translate: TranslateService,
        private pepIconRegistry: PepIconRegistry,
        private pepAddonService: PepAddonService
    ) {
        this.pepAddonService.setDefaultTranslateLang(translate);
        this.pepIconRegistry.registerIcons(pepIcons);
    }
}
