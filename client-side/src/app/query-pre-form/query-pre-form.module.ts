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
import { QueryPreFormComponent } from './query-pre-form.component';
import { PepFieldTitleModule } from '@pepperi-addons/ngx-lib/field-title';
import { TranslateLoader, TranslateModule, TranslateService, TranslateStore } from '@ngx-translate/core';
import { PepIconModule } from '@pepperi-addons/ngx-lib/icon';
import { MatIconModule } from '@angular/material/icon';
import { MatDialogModule } from '@angular/material/dialog';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { PepCheckboxModule } from '@pepperi-addons/ngx-lib/checkbox';
import {PepQueryBuilderModule} from '@pepperi-addons/ngx-lib/query-builder'
import { PepGenericFormModule } from '@pepperi-addons/ngx-composite-lib/generic-form';





@NgModule({
  declarations: [QueryPreFormComponent],
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    PepSelectModule,
    PepTextboxModule,
    PepCheckboxModule,
    PepButtonModule,
    PepTextareaModule,
    PepGroupButtonsModule,
    PepDialogModule,
    PepGenericFormModule,
    PepFieldTitleModule,
    PepIconModule,
    MatIconModule,
    MatDialogModule,
    PepQueryBuilderModule,
    TranslateModule.forChild(),
  ],
  exports: [QueryPreFormComponent],
  providers: [
    TranslateStore,
    AddonService,
    // Add here all used services.
  ]
})
export class QueryPreFormModule {
  constructor(
    translate: TranslateService,
    private pepAddonService: PepAddonService
  ) {
    this.pepAddonService.setDefaultTranslateLang(translate);
  }
}
