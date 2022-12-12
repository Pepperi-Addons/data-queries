import { TranslateService } from '@ngx-translate/core';
import { Component, Inject, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { IPepFieldValueChangeEvent, KeyValuePair, PepAddonService } from '@pepperi-addons/ngx-lib';
import { PepButton } from '@pepperi-addons/ngx-lib/button';
import { AddonService } from '../../services/addon.service';
import { AccountTypes, Aggregators, DateOperation, InputVariable, Intervals, OrderType, ScriptAggregators, Serie, SERIES_LABEL_DEFAULT_VALUE, UserTypes } from '../../../../server-side/models/data-query';
import { MAT_DIALOG_DATA } from '@angular/material/dialog';
import { v4 as uuid } from 'uuid';
import { IPepQueryBuilderField } from '@pepperi-addons/ngx-lib/query-builder';
import { config } from '../addon.config';

@Component({
  selector: 'app-series-editor',
  templateUrl: './series-editor.component.html',
  styleUrls: ['./series-editor.component.scss']
})
export class SeriesEditorComponent implements OnInit {
  chartInstance: any;
  currentSeries: Serie;
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
  filterRuleFieldsOptions: IPepQueryBuilderField = [] as unknown as IPepQueryBuilderField;
  filterRuleVariables: IPepQueryBuilderField = [] as unknown as IPepQueryBuilderField;
  isformValid = true;
  filterRule = null;
  seriesFilterRule = null;
  outputSeries = null;
  resourceRelationData;
  currentAggregatorFieldsOptions = null;

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
    "'Q'q": 'Quarter',
    "'Q'q yyyy": 'QuarterYear'
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
    if(incoming?.resource) {
      this.series.Resource = incoming.resource;
      this.resourceRelationData = incoming.resourceRelationData;
    }
    if(incoming?.inputVariables) {
      this.filterRuleVariables = incoming.inputVariables.map((v: InputVariable) => ({
        FieldID: v.Name,
        FieldType: this.toFilterType(v.Type),
        Title: v.Name
      }))
    }
    this.pluginService.addonUUID = config.AddonUUID;
  }

  ngOnInit(): void {
    this.getDataIndexFields().then(() => {
      this.fillAggregatedFieldsType();
      this.setFilterRuleFieldsOptions()
      this.setAuthorizationFiltersFields();
      this.setFieldsByAggregator();

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
    this.userFilterOptions = [{ value: this.translate.instant("All_Users"), key: "AllUsers" }, { value: this.translate.instant("Current_User"), key: "CurrentUser" }, 
    { value: this.translate.instant("Users_Under_My_Role"), key: "UsersUnderMyRole" }],
    this.accountFilterOptions = [{ value: this.translate.instant("All_Accounts"), key: "AllAccounts" }, { value: this.translate.instant("Assigned_Accounts"), key: "AccountsAssignedToCurrentUser" }, 
    { value: this.translate.instant("Accounts_Of_Users_Under_My_Role"), key: "AccountsOfUsersUnderMyRole" }];
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
          this.aggregationsFieldsOptions["Number"] =  this.resourcesFields[this.series.Resource].filter(f=>f.Type == "Integer" || f.Type == "Double").map(function(f) {return { key: f.FieldID, value: f.FieldID }})
          this.aggregationsFieldsOptions["Date"] =  this.resourcesFields[this.series.Resource].filter(f=>f.Type == "DateTime").map(function(f) {return { key: f.FieldID, value: f.FieldID }})
          this.aggregationsFieldsOptions["All"] = this.resourcesFields[this.series.Resource].map(function(f) {return { key: (f.Type=="String" || f.Type=="MultipleStringValues")  ? f.FieldID+'.cs' : f.FieldID, value: f.FieldID }});
    }
  }

  async getDataIndexFields() {
    // if there's no SchemaRelativeURL, get the schema using addon uuid and schema name from the relation data
    let schema = this.resourceRelationData["SchemaRelativeURL"] ? await this.pluginService.get(this.resourceRelationData["SchemaRelativeURL"]) : 
                 await this.pluginService.getSchemaByNameAndUUID(this.resourceRelationData.Name, this.resourceRelationData.AddonUUID);
    let fields = [];
    for(const fieldID in schema.Fields) {
      this.pushFieldWithAllReferencedFields(fieldID, schema.Fields[fieldID], fields)
    }
    this.resourcesFields[this.series.Resource] = fields.sort((obj1, obj2) => (obj1.FieldID > obj2.FieldID ? 1 : -1));
    return fields;
  }

  setFilterRuleFieldsOptions(){
    if(this.resourcesFields[this.series.Resource]){
      this.filterRuleFieldsOptions = this.resourcesFields[this.series.Resource].map(f=> ({
        FieldID: f.FieldID,
        FieldType: f.Type,
        Title: f.FieldID,
        OptionalValues: f.OptionalValues? f.OptionalValues.map(x => ({Key: x,Value: x}) as KeyValuePair<string>) :[]
      }));
    }
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
    if (this.series.GroupBy && this.series.GroupBy[0]?.FieldID &&  !this.isAggragationFieldIsDate(this.series.GroupBy[0]?.FieldID)){
      this.series.GroupBy[0].Interval = 'None';
      this.series.GroupBy[0].Format = '';
    }
    if (this.series.BreakBy && !this.isAggragationFieldIsDate(this.series.BreakBy?.FieldID)){
      this.series.BreakBy.Interval = 'None';
      this.series.BreakBy.Format = '';
    }
      this.series.Filter = JSON.parse(JSON.stringify(this.filterRule));
  }

  onTypeChange(e) {

  }

  onAggregatorSelected(aggregator){
    if(this.series.AggregatedFields[0].FieldID)
      this.series.AggregatedFields[0].FieldID = null
    this.setFieldsByAggregator();
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
    if(event.slice(-3)==".cs") event = event.slice(0,-3);
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
    } else {
      this.filterRule = null;
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

  toFilterType(type) {
    switch(type) {
      case 'String':
        return 'String'
      case 'Number':
        return 'Double'
      case 'Date':
        return 'DateTime'
      case 'Boolean':
        return 'Bool'
    }
  }

  resourceIsValidForAccountFilter(resourceRelationData) {
    return (
      resourceRelationData.IndexedAccountFieldID &&
      resourceRelationData.AccountFieldID &&
      resourceRelationData.UserFieldID
    );
  }

  resourceIsValidForUserFilter(resourceRelationData) {
    return resourceRelationData.IndexedUserFieldID;
  }

  setFieldsByAggregator() {
    if(this.series.AggregatedFields[0].Aggregator=='Sum' || this.series.AggregatedFields[0].Aggregator=='Average') {
      this.currentAggregatorFieldsOptions = this.aggregationsFieldsOptions['Number']
    }
    else {
      this.currentAggregatorFieldsOptions = this.aggregationsFieldsOptions['All']
    }
  }

  pushFieldWithAllReferencedFields(fieldID, fieldData, fields) {
    if(fieldData.Type == 'Resource' && fieldData.Indexed == true) {
      fields.push({
        FieldID: `${fieldID}.Key`,
        Type: "String",
        OptionalValues: fieldData.OptionalValues
      });
      if(fieldData.IndexedFields) {
        for (let referencedFieldID in fieldData.IndexedFields) {
          this.pushFieldWithAllReferencedFields(`${fieldID}.${referencedFieldID}`, fieldData.IndexedFields[referencedFieldID], fields);
        }
      }
    } else {
      fields.push({
        FieldID: fieldID,
        Type: fieldData.Type,
        OptionalValues: fieldData.OptionalValues
      });
    }
  }
}
