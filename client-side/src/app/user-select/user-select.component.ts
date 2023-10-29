import { Component, Inject, OnInit } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { MAT_DIALOG_DATA } from '@angular/material/dialog';

@Component({
  selector: 'user-select',
  templateUrl: './user-select.component.html',
  styleUrls: ['./user-select.component.scss']
})
export class UserSelectComponent implements OnInit {
  userOptions = [];
  selectedUser;

  constructor(
    public translate: TranslateService,
    @Inject(MAT_DIALOG_DATA) public incoming: any) {
      this.userOptions = incoming?.userOptions;
      this.selectedUser = incoming?.selectedUser;
    }

    ngOnInit() {
    }

    onSave(e) {
    }

}
