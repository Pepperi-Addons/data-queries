import { NgModule } from '@angular/core';
import { Component } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';
import { QueryManagerComponent } from './query_manager/query-manager.component';
import { QueryFormComponent } from './query-form/query-form.component';

// Important for single spa
@Component({
    selector: 'app-empty-route',
    template: '<div></div>',
})
export class EmptyRouteComponent {}

const routes: Routes = [
    {
        path: `settings/:addon_uuid`,
        children: [
            {
                path: 'query_manager',
                component: QueryManagerComponent //the component files name will be query-manager.component.ts/css/html
            },
            {
                path: 'query_manager/:query_uuid',
                component: QueryFormComponent //the component files name will be query-manager.component.ts/css/html
            }
        ]
    },
    {
        path: '**',
        component: EmptyRouteComponent
    }
];

@NgModule({
    imports: [RouterModule.forRoot(routes, { relativeLinkResolution: 'legacy' })],
    exports: [RouterModule]
})
export class AppRoutingModule { }



