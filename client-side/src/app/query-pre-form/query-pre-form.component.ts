import { Component, Inject, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { TranslateService } from '@ngx-translate/core';
import { PepGenericListService } from '@pepperi-addons/ngx-composite-lib/generic-list';
import { PepDialogService } from '@pepperi-addons/ngx-lib/dialog';
import { AddonService } from 'src/services/addon.service';
import { PepLoaderService } from '@pepperi-addons/ngx-lib';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';


@Component({
  selector: 'query-pre-form',
  templateUrl: './query-pre-form.component.html',
  styleUrls: ['./query-pre-form.component.scss']
})
export class QueryPreFormComponent implements OnInit {
  
  dialogRef: MatDialogRef<any>;
  dataView;
  dataSource;
  mode: string = 'Add';
  fields: any;
  resourceRelations: any = [];
  resourceOptions: any = [];

  constructor(
    public addonService: AddonService,
    public translate: TranslateService,
    public genericListService: PepGenericListService,
    public activateRoute: ActivatedRoute,
    public dialogService: PepDialogService,
    public loaderService: PepLoaderService,
    @Inject(MAT_DIALOG_DATA) public incoming: any) {
        this.fields = {
            name: '',
            moveToQueryForm: false
        }
        this.dataView = this.getDataView();
        this.dataSource = this.getDataSource();
    }

   async ngOnInit() {
    this.resourceRelations = await this.addonService.getResourceTypesFromRelation();
    this.resourceOptions = this.resourceRelations.map((resource) => {
        return { Key: resource.Name, Value: resource.Name }
    });
    this.dataView = this.getDataView();
   }

   getDataSource(){
        return this.fields;
   }

   getDataView() {
       return {
         Type: "Form",
         Hidden: false,
         Columns: [],
         Context: {
           Object: {
             Resource: "transactions",
             InternalID: 0,
             Name: "Object Name",
           },
           Name: "Context Name",
           ScreenSize: "Tablet",
           Profile: {
             InternalID: 0,
             Name: "Profile Name",
           },
         },
         Fields: [
           {
             FieldID: "name",
             Type: "TextBox",
             Title: "Name",
             Mandatory: false,
             ReadOnly: false,
             Layout: {
               Origin: {
                 X: 0,
                 Y: 0,
               },
               Size: {
                 Width: 2,
                 Height: 0,
               },
             },
             Style: {
               Alignment: {
                 Horizontal: "Stretch",
                 Vertical: "Stretch",
               },
             },
           },
           {
            FieldID: "resource",
            Type: "ComboBox",
            Title: "Resource",
            Mandatory: false,
            ReadOnly: false,
            Layout: {
              Origin: {
                X: 0,
                Y: 1,
              },
              Size: {
                Width: 2,
                Height: 0,
              },
            },
            Style: {
              Alignment: {
                Horizontal: "Stretch",
                Vertical: "Stretch",
              },
            },
            OptionalValues: this.resourceOptions
          }
         ],
         Rows: [],
       };
   }

  onSave(e) {
	this.fields.resourceData = this.resourceRelations.find((resource) => resource.Name === this.fields.resource);
    this.fields.moveToQueryForm = true;
  }

}
