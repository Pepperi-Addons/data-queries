import { NgModule } from '@angular/core';
import { HttpClientModule } from '@angular/common/http';
import { BrowserModule } from '@angular/platform-browser';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { AddonService } from '../services/addon.service';
import { DataVisualizationService } from '../services/data-visualization.service';
import { PepAddonService } from '@pepperi-addons/ngx-lib';
import { TranslateModule, TranslateLoader, TranslateStore } from '@ngx-translate/core';
import { AppRoutingModule } from './app.routes';
import { AppComponent } from './app.component';
import { QueryManagerModule } from './query_manager/query-manager.module'
import { SeriesEditorModule } from './series-editor/series-editor.module'
import { PepGenericListService } from '@pepperi-addons/ngx-composite-lib/generic-list';


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
        QueryManagerModule,
        TranslateModule.forRoot({
            loader: {
                provide: TranslateLoader,
                useFactory: PepAddonService.createMultiTranslateLoader,
                deps: [PepAddonService]
            }
        })
    ],
    providers: [
        TranslateStore,
        AddonService,
        DataVisualizationService,
        PepGenericListService
        // When loading this module from route we need to add this here (because only this module is loading).
    ],
    bootstrap: [AppComponent]
})
export class AppModule {
}