import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { PepButtonModule } from '@pepperi-addons/ngx-lib/button';
import { PepSelectModule } from '@pepperi-addons/ngx-lib/select';
import { PepTextboxModule } from '@pepperi-addons/ngx-lib/textbox';
import { PepGroupButtonsModule } from '@pepperi-addons/ngx-lib/group-buttons';
import { PepTextareaModule } from '@pepperi-addons/ngx-lib/textarea';
import { PepAddonService, PepCustomizationService, PepFileService } from '@pepperi-addons/ngx-lib';
import { PepDialogModule, PepDialogService } from '@pepperi-addons/ngx-lib/dialog';
import { AddonService } from '../../services/addon.service';
import { VariableEditorComponent } from './variable-editor.component';
import { PepFieldTitleModule } from '@pepperi-addons/ngx-lib/field-title';
import { TranslateLoader, TranslateModule, TranslateService, TranslateStore } from '@ngx-translate/core';
import { HttpClient } from '@angular/common/http';
import { config } from '../addon.config';
import { PepIconModule } from '@pepperi-addons/ngx-lib/icon';
import { MatIconModule } from '@angular/material/icon';
import { MatDialogModule } from '@angular/material/dialog';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { PepCheckboxModule } from '@pepperi-addons/ngx-lib/checkbox';
import {PepQueryBuilderModule} from '@pepperi-addons/ngx-lib/query-builder'
import { PepGenericFormModule } from '@pepperi-addons/ngx-composite-lib/generic-form';





@NgModule({
  declarations: [VariableEditorComponent],
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    PepSelectModule,
    PepTextboxModule,
    PepCheckboxModule,
    PepButtonModule,
    CommonModule,
    PepTextareaModule,
    PepGroupButtonsModule,
    CommonModule,
    PepDialogModule,
    PepGenericFormModule,
    PepFieldTitleModule,
    PepIconModule,
    MatIconModule,
    MatDialogModule,
    PepQueryBuilderModule,
    TranslateModule.forChild({
      loader: {
        provide: TranslateLoader,
        useFactory: (http: HttpClient, fileService: PepFileService, addonService: PepAddonService) =>
          PepAddonService.createDefaultMultiTranslateLoader(http, fileService, addonService, config.AddonUUID),
        deps: [HttpClient, PepFileService, PepAddonService],
      }, isolate: false
    }),
  ],
  exports: [VariableEditorComponent],
  providers: [
    TranslateStore,
    AddonService,
    PepAddonService,
    PepDialogService,
    TranslateService,
    HttpClient,
    PepFileService,
    PepCustomizationService,
    // Add here all used services.
  ]
})
export class VariableEditorModule {
  constructor(
    translate: TranslateService,
    private pepAddonService: PepAddonService
  ) {
    this.pepAddonService.setDefaultTranslateLang(translate);
  }
}
