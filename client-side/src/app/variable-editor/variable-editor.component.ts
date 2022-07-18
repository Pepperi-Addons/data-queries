import { Component, Inject, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { TranslateService } from '@ngx-translate/core';
import { PepGenericListService } from '@pepperi-addons/ngx-composite-lib/generic-list';
import { PepDialogActionButton, PepDialogData, PepDialogService } from '@pepperi-addons/ngx-lib/dialog';
import { AddonService } from 'src/services/addon.service';
import { UtilitiesService } from 'src/services/utilities.service';
import { DataQuery, InputVariable } from '../../../../server-side/models/data-query';
import { PepLoaderService } from '@pepperi-addons/ngx-lib';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { v4 as uuid } from 'uuid';
import { IPepGenericFormFieldUpdate } from '@pepperi-addons/ngx-composite-lib/generic-form';


@Component({
  selector: 'variable-editor',
  templateUrl: './variable-editor.component.html',
  styleUrls: ['./variable-editor.component.scss']
})
export class VariableEditorComponent implements OnInit {
  
  query: DataQuery;
  dialogRef: MatDialogRef<any>;
  dataView;// = this.getDataView()
  dataSource;// = this.getDataSource()
  mode: string = 'Add';
  variable: InputVariable;
  isformValid = true;


  constructor(
    public addonService: AddonService,
    public translate: TranslateService,
    public genericListService: PepGenericListService,
    public activateRoute: ActivatedRoute,
    private router: Router,
    public dialogService: PepDialogService,
    private utilitiesService: UtilitiesService,
    public loaderService: PepLoaderService,
    @Inject(MAT_DIALOG_DATA) public incoming: any) {
        if (incoming?.currentVariable) {
            this.mode = 'Update';
            this.variable = incoming.currentVariable;
        }
        else {
            this.variable = {
                Key: uuid(),
                Name: incoming?.varName,
                Type: null,
                DefaultValue: '0',
                PreviewValue: '0'
            }
        }
        this.dataView = this.getDataView()
        this.dataSource = this.getDataSource()
    }

   async ngOnInit() {
   }

   getDataSource(){
        return this.variable
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
             FieldID: "Name",
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
            FieldID: "Type",
            Type: "ComboBox",
            Title: "Type",
            Mandatory: false,
            ReadOnly: this.mode == 'Update',
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
            OptionalValues: [{Key: 'String', Value: 'String'},
                             {Key: 'Number', Value: 'Number'},
                             {Key: 'Date', Value: 'Date'},
                             {Key: 'Boolean', Value: 'Boolean'}]
          },
          {
            FieldID: "DefaultValue",
            Type: "TextBox",
            Title: "Default Value",
            Mandatory: false,
            ReadOnly: false,
            Layout: {
              Origin: {
                X: 0,
                Y: 2,
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
            FieldID: "PreviewValue",
            Type: "TextBox",
            Title: "Preview Value",
            Mandatory: false,
            ReadOnly: false,
            Layout: {
              Origin: {
                X: 0,
                Y: 3,
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
          }
         ],
         Rows: [],
       };
   }

  onSave(e) {
  }

}
