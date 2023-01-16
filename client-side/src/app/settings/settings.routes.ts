import { NgModule } from '@angular/core';
import { Component } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';
import { QueryManagerComponent } from '../query_manager/query-manager.component';
import { QueryFormComponent } from '../query-form/query-form.component';
import { SettingsComponent } from './settings.component';
import { DataExportFormComponent } from '../data-export-form/data-export-form.component';

// Important for single spa
@Component({
    selector: 'app-empty-route',
    template: '<div>Route is not exist settings.</div>',
})
export class EmptyRouteComponent {}

const routes: Routes = [{
    path: ':settingsSectionName/:addonUUID/:slugName',
    component: SettingsComponent,
    children: [
        {
            path: '',
            component: QueryManagerComponent //the component files name will be query-manager.component.ts/css/html
        },
        {
            path: ':query_uuid/data_export',
            component: DataExportFormComponent //the component files name will be query-manager.component.ts/css/html
        },
        {
            path: ':query_uuid',
            component: QueryFormComponent //the component files name will be query-manager.component.ts/css/html
        },
        { path: '**', component: EmptyRouteComponent }
    ]
}];

@NgModule({
    imports: [
        RouterModule.forChild(routes),
    ],
    exports: [RouterModule]
})
export class SettingsRoutingModule { }



