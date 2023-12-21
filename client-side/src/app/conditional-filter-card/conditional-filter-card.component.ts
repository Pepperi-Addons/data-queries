import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { ActivatedRoute } from '@angular/router';
import { IPepQueryBuilderField } from '@pepperi-addons/ngx-lib/query-builder';
import { Serie, ConditionalFilter } from '../../../../server-side/models/data-query';

@Component({
    selector: 'conditional-filter-card',
    templateUrl: './conditional-filter-card.component.html',
    styleUrls: ['./conditional-filter-card.component.scss']
})
export class ConditionalFilterCardComponent implements OnInit {

    @Input() series: any;
    @Input() id: number;
	@Input() filterRuleStringVariables: IPepQueryBuilderField[];
	@Input() filterRuleFieldsOptions: IPepQueryBuilderField[];

    @Output() removeClick: EventEmitter<any> = new EventEmitter();
    @Output() editClick: EventEmitter<any> = new EventEmitter();

    public title: string;
    queryOptions = [];
    benchmarkQueryOptions = [];
    inputVars;
    benchmarkInputVars;
    blockLoaded = false;
	isFilterValid = false;
	filterCondition;
	dataView = null;
	dataSource = null;
	isLoaded = false;
	inputFilterRule: Serie["Filter"];
	filterRule: Serie["Filter"];
    constructor(
        public routeParams: ActivatedRoute,
        protected translate: TranslateService,
    ) {
    }

    async ngOnInit(): Promise<void> {
			this.inputFilterRule = this.series.ConditionalFilters[this.id].Filter;
		if(this.series.ConditionalFilters[this.id].Condition) {
			this.filterCondition = this.series.ConditionalFilters[this.id].Condition;
		}
		else {
			this.filterCondition = {
				variable: this.filterRuleStringVariables[0].FieldID,
				operation: 'Equal to',
				value: ''
			}
		}
		this.dataView = this.getDataView();
    	this.dataSource = this.getDataSource();
		this.isLoaded = true;
    }

    onRemoveClick() {
        this.removeClick.emit({id: this.id});
    }

    cardEdited() {
		const conditionalFilter: ConditionalFilter = {
			ID: this.id,
			Condition: this.filterCondition,
			Filter: this.filterRule
		};
        this.editClick.emit({conditionalFilter: conditionalFilter});
    }

	cardFieldEdited(fieldName: string) {
        switch (fieldName) {
			case 'Condition':
				this.editClick.emit({Condition: this.filterCondition, ID: this.id});
				break;
			case 'Filter':
				this.editClick.emit({Filter: this.filterRule, ID: this.id});
				break;
		}
    }

	getDataSource(){
        return this.filterCondition;
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
             FieldID: "variable",
             Type: "ComboBox",
             Title: "",
             Mandatory: false,
             ReadOnly: false,
             Layout: {
               Origin: {
                 X: 0,
                 Y: 0,
               },
               Size: {
                 Width: 1,
                 Height: 0,
               },
             },
             Style: {
               Alignment: {
                 Horizontal: "Stretch",
                 Vertical: "Stretch",
               },
             },
             OptionalValues: this.filterRuleStringVariables.map(variable => {return {Key: variable.FieldID, Value: variable.FieldID}}),
			 AdditionalProps: {
				emptyOption: false
			}
           },
		   {
			FieldID: "operation",
			Type: "ComboBox",
			Title: "",
			Mandatory: false,
			ReadOnly: false,
			Layout: {
			  Origin: {
				X: 1,
				Y: 0,
			  },
			  Size: {
				Width: 1,
				Height: 0,
			  },
			},
			Style: {
			  Alignment: {
				Horizontal: "Stretch",
				Vertical: "Stretch",
			  },
			},
			OptionalValues: [{Key: 'Equal to', Value: 'Equal to'}, {Key: 'Not equal to', Value: 'Not equal to'}]
		  },
		  {
			FieldID: "value",
			Type: "TextBox",
			Title: "",
			Mandatory: false,
			ReadOnly: false,
			Layout: {
			  Origin: {
				X: 2,
				Y: 0,
			  },
			  Size: {
				Width: 1,
				Height: 0,
			  },
			},
			Style: {
			  Alignment: {
				Horizontal: "Stretch",
				Vertical: "Stretch",
			  },
			}
		  }
         ],
         Rows: [],
       };
   }

	onFilterRuleChanged(event) {
		this.filterRule = event;
		this.cardFieldEdited('Filter');
    }
  

	async onFilterConditionChanged(event) {
		this.cardFieldEdited('Condition');
	}

	
}
