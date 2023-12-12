export interface BulkExecuteBody {
	QueriesData: QueryData[];
	TimeZoneOffset: number;
}

export interface QueryData {
	Key: string;
	VariableValues: { [varName: string]: string };
}
