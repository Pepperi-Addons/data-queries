import { Injectable } from "@angular/core";
import { MatDialogRef } from "@angular/material/dialog";
import { PepColorService } from "@pepperi-addons/ngx-lib";
import { PepDialogData, PepDialogService } from "@pepperi-addons/ngx-lib/dialog";
import { Color } from "../app/models/color";


@Injectable({
    providedIn: 'root',
})
export class DataVisualizationService {
    dialogRef: MatDialogRef<any>;
    constructor(private pepColorService: PepColorService,
        private dialogService: PepDialogService) { };
    
    openDialog(title, content, buttons, input, callbackFunc = null): void {
        const config = this.dialogService.getDialogConfig(
            {
                disableClose: true,
                panelClass: 'pepperi-standalone'
            },
            'inline'
        );
        const data = new PepDialogData({
            title: title,
            content: content,
            actionButtons: buttons,
            actionsType: "custom",
            showHeader: true,
            showFooter: true,
            showClose: true
        })
        config.data = data;

        this.dialogRef = this.dialogService.openDialog(content, input, config);
        this.dialogRef.afterClosed().subscribe(res => {
            callbackFunc(res);
        });
    }

}