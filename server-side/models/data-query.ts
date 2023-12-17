import { AddonData, AddonDataScheme, Relation } from "@pepperi-addons/papi-sdk";
import { JSONFilter } from "@pepperi-addons/pepperi-filters/build/json-filter";

export interface DataQuery extends AddonData {
    Key: string;
    Name: string;
    Description?: string;
    Resource: string;
	ResourceData: Relation;
    Series: Serie[];
    Variables: InputVariable[];
    Style: string;
    Currency?: string;
    Format: string;
}

export interface GroupBy {
    FieldID: string;
    Interval?: Interval;
    Format?: string;
    Alias?:string;
}

export interface Serie {
    Key: string,
    Name: string,
    Label: string,
    Top?: Top;
    Resource: string,
    DynamicFilterFields: string[],
    GroupBy?: GroupBy[],
    AggregatedFields: AggregatedField[];
    AggregatedParams?: AggregatedParam[],
    IntervalUnit?: Interval;
    BreakBy: BreakBy;
    Filter: JSONFilter,
    Scope: {
        User: UserType,
        Account: AccountType
    },
	ConditionalFilters: ConditionalFilter[]
}

export interface InputVariable {
    Key: string,
    Name: string,
    Type: string,
    DefaultValue: string,
    PreviewValue: string
}

export type BreakBy = GroupBy

export interface Top {
    Max: number,
    Ascending: boolean,
}
export interface AggregatedField {
    FieldID: string,
    Aggregator: Aggregator,
    Alias?: string,
    Script?: string
}
export interface AggregatedParam {
    FieldID: string,
    Aggregator: ScriptAggregator,
    Name: string,
}

export interface ConditionalFilter {
	id: number,
	Condition: JSONFilter,
	Filter: JSONFilter
}
export const UserTypes = ["AllUsers", "CurrentUser"];
export declare type UserType = typeof UserTypes[number];

export const AccountTypes = ["AllAccounts", "AccountsAssignedToCurrentUser", "CurrentAccount"];
export declare type AccountType = typeof AccountTypes[number];

export const DataTypes = ["Single", "Series", "MultiSeries"];
export declare type DataType = typeof DataTypes[number];

export const Intervals = ["Day", "Week", "Month", "Quarter", "Year"];
export declare type Interval = typeof Intervals[number];

export const Aggregators = ["Sum", "Count", "Average", "Script", "CountDistinct"];
export declare type Aggregator = typeof Aggregators[number];

export const ScriptAggregators = ["Sum", "Count", "CountDistinct"];
export declare type ScriptAggregator = typeof ScriptAggregators[number];

export const DateOperation = ['InTheLast', 'Today', 'ThisWeek', 'ThisMonth', 'Before', 'After', 'Between', 'DueIn', 'On', 'NotInTheLast', 'NotDueIn', 'IsEmpty', 'IsNotEmpty']
export const OrderType = ["Ascending", "Decending"];

export const DATA_QUREIES_TABLE_NAME = 'DataQueries';
export const SERIES_LABEL_DEFAULT_VALUE = '${label}';

export const queriesTableScheme: AddonDataScheme = {
    Name: DATA_QUREIES_TABLE_NAME,
    Type: 'data',
    Fields: {
        Key: {
            Type: "String"
        },
        Name: {
            Type: "String"
        },
        Resource: {
            Type: "String",
        },
        Series: {
            Type: "Array",
            Items: {
                Type: "Object",
                Fields: {}
            }
        },
        Variables: {
            Type: "Array",
            Items: {
                Type: "Object",
                Fields: {}
            }
        }
    },
}

