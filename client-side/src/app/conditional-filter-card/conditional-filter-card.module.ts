import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ConditionalFilterCardComponent } from './conditional-filter-card.component'
import { PepButtonModule } from '@pepperi-addons/ngx-lib/button';
import { PepMenuModule } from '@pepperi-addons/ngx-lib/menu';
import { TranslateModule, TranslateLoader } from '@ngx-translate/core';
import { PepAddonService, PepNgxLibModule } from '@pepperi-addons/ngx-lib';
import { MatDialogModule } from '@angular/material/dialog';
import { PepColorModule } from '@pepperi-addons/ngx-lib/color';
import { PepGroupButtonsModule } from '@pepperi-addons/ngx-lib/group-buttons';
import { PepSelectModule } from '@pepperi-addons/ngx-lib/select';
import { config } from '../addon.config';
import { PepQueryBuilderModule } from '@pepperi-addons/ngx-lib/query-builder';
import { PepGenericFormModule } from '@pepperi-addons/ngx-composite-lib/generic-form';

@NgModule({
    declarations: [ConditionalFilterCardComponent],
    imports: [
        CommonModule,
        PepButtonModule,
        PepMenuModule,
        PepNgxLibModule,
        PepSelectModule,
        MatDialogModule,
        PepGroupButtonsModule,
        PepColorModule,
		PepQueryBuilderModule,
		PepGenericFormModule,
        TranslateModule.forChild({
            loader: {
                provide: TranslateLoader,
                useFactory: (addonService: PepAddonService) => 
                    PepAddonService.createMultiTranslateLoader(config.AddonUUID, addonService, ['ngx-lib', 'ngx-composite-lib']),
                deps: [PepAddonService]
            }, isolate: false
        }),
    ],
    exports: [ConditionalFilterCardComponent]
})
export class ConditionalFilterCardModule { }
