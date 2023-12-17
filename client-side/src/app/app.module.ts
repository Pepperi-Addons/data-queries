import { DoBootstrap, Injector, NgModule } from '@angular/core';
import { HttpClientModule } from '@angular/common/http';
import { BrowserModule } from '@angular/platform-browser';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { AddonService } from '../services/addon.service';
import { PepAddonService } from '@pepperi-addons/ngx-lib';
import { TranslateModule, TranslateLoader, TranslateStore, TranslateService } from '@ngx-translate/core';
import { AppRoutingModule } from './app.routes';
import { AppComponent } from './app.component';
import { QueryManagerModule } from './query_manager/query-manager.module'
import { SeriesEditorModule } from './series-editor/series-editor.module'
import { PepGenericListService } from '@pepperi-addons/ngx-composite-lib/generic-list';
import { VariableEditorModule } from './variable-editor/variable-editor.module'
import { UserSelectModule } from './user-select/user-select.module'
import { QueryPreFormModule } from './query-pre-form/query-pre-form.module'
import { DataExportFormModule } from './data-export-form/data-export-form.module'
import { ConditionalFilterCardModule } from './conditional-filter-card/conditional-filter-card.module'
import { config } from './addon.config';
import { SettingsComponent, SettingsModule } from './settings';
@NgModule({
    declarations: [
        AppComponent
    ],
    imports: [
        BrowserModule,
        BrowserAnimationsModule,
        HttpClientModule,
        AppRoutingModule,
        SeriesEditorModule,
        VariableEditorModule,
        QueryPreFormModule,
        DataExportFormModule,
        QueryManagerModule,
        UserSelectModule,
		ConditionalFilterCardModule,
        SettingsModule,
        TranslateModule.forRoot({
            loader: {
                provide: TranslateLoader,
                useFactory: (addonService: PepAddonService) => 
                    PepAddonService.createMultiTranslateLoader(config.AddonUUID, addonService, ['ngx-lib', 'ngx-composite-lib']),
                deps: [PepAddonService]
            }
        }),
    ],
    providers: [
        TranslateStore,
        AddonService,
        PepGenericListService
        // When loading this module from route we need to add this here (because only this module is loading).
    ],
    bootstrap: [
        // AppComponent
    ]
})
export class AppModule implements DoBootstrap {
    constructor(
        private injector: Injector,
        translate: TranslateService,
        private pepAddonService: PepAddonService
    ) {
        this.pepAddonService.setDefaultTranslateLang(translate);
    }

    ngDoBootstrap() {
        this.pepAddonService.defineCustomElement(`settings-element-${config.AddonUUID}`, SettingsComponent, this.injector);
    }
}