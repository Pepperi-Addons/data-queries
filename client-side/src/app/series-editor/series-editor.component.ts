import { TranslateService } from '@ngx-translate/core';
import { Component, EventEmitter, Inject, Input, OnInit, Output } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { IPepFieldValueChangeEvent, KeyValuePair, PepAddonService } from '@pepperi-addons/ngx-lib';
import { IPepButtonClickEvent, PepButton } from '@pepperi-addons/ngx-lib/button';
import { pepIconSystemBin } from '@pepperi-addons/ngx-lib/icon';
import { AddonService } from '../../services/addon.service';
import { config } from '../addon.config';
import { AccountTypes, Aggregators, DateOperation, Intervals, OrderType, ResourceTypes, ScriptAggregators, Serie, SERIES_LABEL_DEFAULT_VALUE, UserTypes } from '../../../../server-side/models/data-query';
import { MAT_DIALOG_DATA } from '@angular/material/dialog';
import { v4 as uuid } from 'uuid';

@Component({
  selector: 'app-series-editor',
  templateUrl: './series-editor.component.html',
  styleUrls: ['./series-editor.component.scss']
})
export class SeriesEditorComponent implements OnInit {
  chartInstance: any;
  currentSeries: Serie;
  resourceOptions: Array<PepButton> = [];
  aggregationsOptions: Array<PepButton> = [];
  scriptAggregationsOptions: Array<PepButton> = [];
  aggregationsFieldsOptions: any = {};
  intervalOptions: Array<PepButton> = [];
  formatOptions: Array<PepButton> = [];
  orderOptions: Array<PepButton> = [];
  //userFilterFieldOptions: Array<PepButton> = [];
  userFilterOptions: Array<PepButton> = [];
  //accountFilterFieldOptions: Array<PepButton> = [];
  accountFilterOptions: Array<PepButton> = [];
  periodOptions: Array<PepButton> = [];
  isLoaded = false;
  filterRuleFieldsOptions: any=[];
  isformValid = true;
  filterRule = null;
  seriesFilterRule = null;
  outputSeries = null;

  formFlags={
    useDynamicSeries:false,
    useCategories: false,
    useDynamicFilter:false,
    limitNumber: false
  }

  mode: string = 'Add';
  seriesEditorType: 'scorecards' | 'chart' = 'chart'
  series: Serie = {
    Key: uuid(),
    Name: '',
    Resource: 'all_activities',
    Label: SERIES_LABEL_DEFAULT_VALUE,
    Top: {
      Max: 0,
      Ascending: false,
    },
    AggregatedFields: [
      {
        Aggregator: 'Sum',
        FieldID: '',
        Alias: '',
        Script: 'params.Var1'
      }
    ],
    AggregatedParams: [{
      FieldID: '',
      Aggregator: 'Sum',
      Name: 'Var1'
    }],
    BreakBy: {
      FieldID: '',
      Interval: 'Month',
      Format: 'yyyy MMM'

    },
    Filter: undefined,
    Scope: {
      User: 'AllUsers',
      Account: 'AllAccounts'
    },
    DynamicFilterFields: [],
    GroupBy: [{
      FieldID: '',
      Interval: 'Month',
      Format: 'yyyy MMM',
      Alias: ''
    }]
  }

  formatOptionsMap = {
    'yyyy': 'Year',
    'yyyy MMM': 'YearMonth',
    'MMM': 'Month',
    'MMM dd': 'MonthDay',
    'yyyy MMM dd': 'YearMonthDay',
    'w':'Week',
    'w yyyy': 'WeekYear',
    'q':'Quarter',
    'q yyyy':'QuarterYear'
  }

  resourcesFields:any={};

  JSON: JSON;
  IsDateGroupBy: boolean;
  IsDateBreakBy: boolean;

  constructor(private addonService: PepAddonService,
    public routeParams: ActivatedRoute,
    public router: Router,
    public route: ActivatedRoute,
    private translate: TranslateService,
    public pluginService: AddonService,
    @Inject(MAT_DIALOG_DATA) public incoming: any) {
    this.JSON = JSON;
    if (incoming?.currentSeries) {
      this.mode = 'Update';
      this.series = incoming.currentSeries;
      this.seriesFilterRule = this.series.Filter;
      this.formFlags.useCategories = this.series.GroupBy[0].FieldID ? true : false;
      this.formFlags.useDynamicSeries = this.series.BreakBy.FieldID ? true : false;
      this.formFlags.useDynamicFilter = this.series.DynamicFilterFields.length > 0;
      this.formFlags.limitNumber = this.series.Top && this.series.Top.Max > 0;
    }
    if (incoming?.parent) {
      this.seriesEditorType = incoming.parent;
    }
    // set default name 
    if (incoming?.seriesName) {
      this.series.Name = incoming.seriesName;
    }
    this.pluginService.addonUUID = this.routeParams.snapshot.params['addon_uuid'];
  }

  ngOnInit(): void {
    this.getDataIndexFields().then(() => {
      this.fillAggregatedFieldsType();
      this.setFilterRuleFieldsOptions()
      this.setAuthorizationFiltersFields();

      if(this.series.Filter)
        this.filterRule = JSON.parse(JSON.stringify(this.series.Filter));

      if (this.series.GroupBy && this.series.GroupBy[0])
         this.IsDateGroupBy = this.isAggragationFieldIsDate( this.series.GroupBy[0].FieldID);
      if (this.series.BreakBy)
        this.IsDateBreakBy = this.isAggragationFieldIsDate( this.series.BreakBy.FieldID);

      this.isLoaded = true;

    })
    Aggregators.forEach(aggregator => {
      this.aggregationsOptions.push({ key: aggregator, value: this.translate.instant(aggregator) });
    });

    ScriptAggregators.forEach(aggregator => {
      this.scriptAggregationsOptions.push({ key: aggregator, value: this.translate.instant(aggregator) });
    });

    Intervals.forEach(intervalUnit => {
      this.intervalOptions.push({ key: intervalUnit, value: intervalUnit });
    });

    ResourceTypes.forEach(resourceType => {null
      this.resourceOptions.push({ key: resourceType, value: resourceType });
    });

    UserTypes.forEach(userType => {
      this.userFilterOptions.push({ key: userType, value: this.translate.instant(userType) });
    });

    AccountTypes.forEach(accountType => {
      this.accountFilterOptions.push({ key: accountType, value: this.translate.instant(accountType) });
    });

    DateOperation.forEach(dateOperation => {
      this.periodOptions.push({ key: dateOperation, value: dateOperation });
    });

    OrderType.forEach(order => {
      this.orderOptions.push({ key: order, value: order });
    });
    Object.keys(this.formatOptionsMap).forEach((formatKey) => {
      this.formatOptions.push({ key: formatKey, value: this.translate.instant(this.formatOptionsMap[formatKey]) })
    })

  }

  private setAuthorizationFiltersFields() {
    this.userFilterOptions = [{ value: this.translate.instant("All_Users"), key: "AllUsers" }, { value: this.translate.instant("Current_User"), key: "CurrentUser" }],
      this.accountFilterOptions = [{ value: this.translate.instant("All_Accounts"), key: "AllAccounts" }, { value: this.translate.instant("Assgined_Accounts"), key: "AccountsAssignedToCurrentUser" }];
  }

  private fillAggregatedFieldsType() {
    if(this.series.AggregatedFields && this.series.AggregatedFields[0].Aggregator){
        this.fillAggregatorField();
    }
  }

  /*private fillAggregatorField(fields) {
    this.aggregationsFieldsOptions = [];
    fields.forEach(field => {
      this.aggregationsFieldsOptions.push({ key: field, value: field });
      if (field.startsWith('Account')) {
        this.accountFilterFieldOptions.push({ key: field, value: field });
      }
      if (field.startsWith('Agent')) {
        this.userFilterFieldOptions.push({ key: field, value: field });
      }
    });
  }*/

  private fillAggregatorField(){
    this.aggregationsFieldsOptions = {};
    if(this.series.Resource && this.resourcesFields[this.series.Resource]){
          this.aggregationsFieldsOptions["Number"] =  this.resourcesFields[this.series.Resource].filter(f=>f.Type == "long" || f.Type == "integer" || f.Type == "float"|| f.Type == "double").map(function(f) {return { key: f.FieldID, value: f.FieldID }})
          this.aggregationsFieldsOptions["Date"] =  this.resourcesFields[this.series.Resource].filter(f=>f.Type == "date").map(function(f) {return { key: f.FieldID, value: f.FieldID }})
          this.aggregationsFieldsOptions["All"] = this.resourcesFields[this.series.Resource].map(function(f) {return { key: f.FieldID, value: f.FieldID }});
    }
  }

  getResource(resource) {
    return this.resourceOptions.filter(x => x.value == resource);
  }

  getDataIndexFields() {
    return this.addonService.getAddonApiCall('10979a11-d7f4-41df-8993-f06bfd778304', 'data_index_meta_data', 'all_activities_schema').toPromise().then((allActivitiesFields) => {
      return this.addonService.getAddonApiCall('10979a11-d7f4-41df-8993-f06bfd778304', 'data_index_meta_data', 'transaction_lines_schema').toPromise().then((trnsactionLinesFields) => {
        this.resourcesFields["all_activities"] = allActivitiesFields.Fields.sort((obj1, obj2) => (obj1.FieldID > obj2.FieldID ? 1 : -1));
        this.resourcesFields["transaction_lines"] = trnsactionLinesFields.Fields.sort((obj1, obj2) => (obj1.FieldID > obj2.FieldID ? 1 : -1));
      });
    });
  }

  setFilterRuleFieldsOptions(){
    if(this.resourcesFields[this.series.Resource]){
      this.filterRuleFieldsOptions = this.resourcesFields[this.series.Resource].map(f=> ({
        FieldID: f.FieldID,
        FieldType: this.getFilterBuilderFieldType(f.Type),
        Title: f.FieldID,
        OptionalValues: f.optionalValues? f.optionalValues.map(x => ({Key: x,Value: x}) as KeyValuePair<string>) :[]
      }));
    }
  }

  getFilterBuilderFieldType(type){
    switch(type){
      case "long":
      case "integer":
        return "Integer";
      case "float":
      case "double":
        return "Double";
      case "string":
      case "keyword":
        return "String";
      case "date":
        return "DateTime";
      case "boolean":
        return "Bool";

    }
    //'JsonBool'
    //'Date'
    //'MultipleStringValues'
    //'Guid'
  }
  

  onEventCheckboxChanged(eventType, event) {
    switch (eventType) {
      case 'Categories':
        this.formFlags.useCategories = event;
        break;
      case 'DynamicSeries':
        this.formFlags.useDynamicSeries = event;
        break;
      case 'LimitNumberResults':
        this.formFlags.limitNumber = event;
        break;
      case 'DynamicFilter':
        this.formFlags.useDynamicFilter = event;
        break;
    }
  }

  getScript() {
    return this.series.AggregatedFields.filter(af => af.Script)[0]?.Script;
  }

  getAggregatorField(aggregatorType) {
    switch (aggregatorType) {
      case 'GroupBy':
        if (this.series.GroupBy && this.series.GroupBy[0]?.FieldID) {
          return this.aggregationsFieldsOptions["All"].filter(x => x.value === this.series.GroupBy[0].FieldID)[0].key;
        }
        break;
      case 'BreakBy':
        if (this.series.BreakBy?.FieldID) {
          return this.aggregationsFieldsOptions["All"].filter(x => x.value === this.series.BreakBy.FieldID)[0].key;
        }
        break;
    }
  }

  onChartSelected(event: IPepFieldValueChangeEvent) {
    console.log(event);
    if (event) {
      //this.importChartFileAndExecute(event);
    }
  }

  onSave(e) {
    if (!this.formFlags.useCategories) {
      this.series.GroupBy[0].FieldID = '';
      this.series.GroupBy[0].Alias = '';
    }
    if (!this.formFlags.useDynamicSeries) {
      this.series.BreakBy.FieldID = '';
    }
    if (!this.formFlags.limitNumber) {
      this.series.Top.Max = 0;
    }
    if (this.series.GroupBy && this.series.GroupBy[0]?.FieldID && this.series.GroupBy[0]?.FieldID.indexOf("Date") == -1){
      this.series.GroupBy[0].Interval = 'None';
      this.series.GroupBy[0].Format = '';

    }
    if (this.series.BreakBy && this.series.BreakBy?.FieldID.indexOf("Date") == -1){
      this.series.BreakBy.Interval = 'None';
      this.series.BreakBy.Format = '';
    }
      this.series.Filter = JSON.parse(JSON.stringify(this.filterRule));
  }

  onTypeChange(e) {

  }

  onAggregatorSelected(aggregator){
    switch (aggregator) {
      case 'Script':
        break;
    }
  }
  
  onResourceChange(event) {
    this.fillAggregatedFieldsType();
    this.setFilterRuleFieldsOptions()
  }

  deleteDynamicFilterFields(index) {
    this.series.DynamicFilterFields.splice(index);
  }

  deleteAggregatedParam(index) {
    this.series.AggregatedParams.splice(index);
  }

  addAggregatedParam() {
    this.series.AggregatedParams.push({ Name: '', Aggregator: '', FieldID: '' });

  }

  addDynamicFilterFields() {
    this.series.DynamicFilterFields.push('');

  }

  onTopMaxChanged(event) {
    this.series.Top.Max = Number(event);
  }

  onGroupByFieldSelected(event) {
    const parts = `.${event}`.split('.');
    var alias = parts[parts.length - 1];
    this.series.GroupBy[0].Alias = alias;

    this.IsDateGroupBy = this.isAggragationFieldIsDate( this.series.GroupBy[0].FieldID)
  }

  onBreakByFieldSelected(event) {
    this.IsDateBreakBy = this.isAggragationFieldIsDate( this.series.BreakBy.FieldID)
  }


  isAggragationFieldIsDate(fieldID){
    if(this.aggregationsFieldsOptions["Date"]){
      var field  = this.aggregationsFieldsOptions["Date"].find(field=>field.key == fieldID)
      if(field)//it is a date breakBy by field
        return true;
    }
    return false
  }

  onFilterRuleChanged(event) {
    if (event) {
      this.filterRule = event;
      //this.series.Filter = event
    } else {
      this.filterRule = null;
      //this.series.Filter = null;
    }
  }

  onOrderChanged(event) {
    if (event === 'Ascending') {
      this.series.Top.Ascending = true;
    }
    else {
      this.series.Top.Ascending = false;
    }
  }
}
