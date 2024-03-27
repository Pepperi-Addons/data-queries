import { PapiClient, Relation } from '@pepperi-addons/papi-sdk'
import { Client, Request } from '@pepperi-addons/debug-server';
import config from '../../addon.config.json'
import { AggregatedField, DataQuery, DATA_QUREIES_TABLE_NAME, GroupBy, Interval, Serie, ConditionalFilter, FilterCondition } from '../models/data-query';
import { ValidatorResult, validate } from 'jsonschema';
import esb, { Aggregation, Query, RequestBodySearch } from 'elastic-builder';
import jwtDecode from 'jwt-decode';
import { DataQueryResponse, SeriesData } from '../models/data-query-response';
import { QueryExecutionScheme } from '../models/query-execution-scheme';
import {JSONFilter, toKibanaQuery} from '@pepperi-addons/pepperi-filters'
import { BulkExecuteBody } from '../models/execute-body';
import { licenseOptions } from '../metadata/varSettingsData';

class ElasticService {

  papiClient: PapiClient;

  constructor(private client: Client) {
    this.papiClient = new PapiClient({
      baseURL: client.BaseURL,
      token: client.OAuthAccessToken,
      addonUUID: client.AddonUUID,
      addonSecretKey: client.AddonSecretKey
    });
  }

  MaxAggregationSize = 100;

  intervalUnitFormat: { [key in Interval]: string } = {
    Day: 'dd',
    Week: 'MM-dd',
    Month: 'MM',
    Quarter: 'MM-yyyy',
    Year: 'yyyy',
    None: ''
  }

  hitsFilter: Query = esb.matchAllQuery();
  hitsRequested = false;
  timeZoneOffsetString: string | undefined;
  dataLimitFilter: Query = esb.matchAllQuery();

  async executeUserDefinedQuery(request: Request): Promise<DataQueryResponse> {
	const startTime = Date.now();
    const validation: ValidatorResult = validate(request.body, QueryExecutionScheme);

    if (!validation.valid) {
      throw new Error(validation.toString());
    }

	let currentTime = Date.now();
    const query: DataQuery = await this.getUserDefinedQuery(request);
	console.log(`getting query time: ${Date.now() - currentTime} milliseconds`);

	if (query.VarSettings.License === licenseOptions.Free && query.VarSettings.TrialEndDate < new Date().toLocaleString()) {
		// No license and trial has ended, so we need to limit the results
		this.applyDataLimitFilter(query.VarSettings.DaysLimit, query.Resource);
	}
    // for filtering out hidden records
    const hiddenFilter: esb.BoolQuery = esb.boolQuery().should([esb.matchQuery('Hidden', 'false'), esb.boolQuery().mustNot(esb.existsQuery('Hidden'))]);

	const elasticRequestBody: RequestBodySearch = this.applyBodyParamsToQuery(request, query, hiddenFilter);

    if (!query.Series || query.Series.length === 0) {
      return new DataQueryResponse();
    }

	// format timeZoneOffset to string, to be used in aggregations
	this.timeZoneOffsetString = this.timeZoneOffsetToString(request.body?.TimeZoneOffset);

    // handle aggregation by series
    const series = request.body?.Series ? query.Series.filter(s => s.Name === request.body?.Series) : query.Series;
    const aggregationsList: { [key: string]: Aggregation[] } = this.buildSeriesAggregationList(series);

	// the resource relation data is needed for the scope filters, and for searching elastic
    const resourceRelationData = query.ResourceData;

	currentTime = Date.now();
    // build one query with all series (each aggregation have query and aggs)
    const queryAggregation: any = await this.buildAllSeriesAggregation(aggregationsList, query, resourceRelationData, request.body, hiddenFilter);
	console.log(`buildAllSeriesAggregation time: ${Date.now() - currentTime} milliseconds`);

    // this filter will be applied on the hits after aggregation is calculated
    elasticRequestBody.postFilter(this.hitsFilter);
    elasticRequestBody.aggs(queryAggregation);
    const body = {"DSL": elasticRequestBody.toJSON()};
    console.log(`lambdaBody: ${JSON.stringify(body)}`);

    return this.callElasticAndBuildResponse(body, resourceRelationData, startTime, query, request.body?.Series);

  }

  private async callElasticAndBuildResponse(body: any, resourceRelationData, startTime, query, seriesName: string): Promise<DataQueryResponse> {
	try {
		const currentTime = Date.now();
		const lambdaResponse = await this.papiClient.post(resourceRelationData.AddonRelativeURL ?? '', body);
		console.log(`elastic run time: ${Date.now() - currentTime} milliseconds`);

		console.log(`lambdaResponse: ${JSON.stringify(lambdaResponse)}`);
		const response: DataQueryResponse = this.buildResponseFromElasticResults(lambdaResponse, query, seriesName);

		console.log(`Total execution time: ${Date.now() - startTime} milliseconds`);

      return response;
    }
    catch (ex){
      console.log(`Failed to execute data query ID: ${query.Key}, lambdaBody: ${JSON.stringify(body)}`, ex)
      throw new Error(`Failed to execute data query ID: ${query.Key}`);
    }
  }

  private applyBodyParamsToQuery(request: Request, query: DataQuery, hiddenFilter: esb.BoolQuery): RequestBodySearch {
	let elasticRequestBody: RequestBodySearch;
	if (!request.body?.PageSize && !request.body?.Page) {
		elasticRequestBody = new esb.RequestBodySearch().size(0);
	}
	else {
		let pageSize = request.body?.PageSize ?? 100;
		if (pageSize > 100) { pageSize = 100; }
		let page = request.body?.Page ?? 1;
		page = Math.max(page-1, 0);
		elasticRequestBody = new esb.RequestBodySearch().size(pageSize).from(pageSize*(page));
		if (request.body?.Fields) { elasticRequestBody = elasticRequestBody.source(request.body.Fields); }
		if (request.body?.Series) {
			const requestedSeries = query.Series.find(s => s.Name === request.body.Series);
			if (!requestedSeries) {
			throw new Error(`Series '${request.body.Series}' does not exist on data query ID: ${query.Key}`);
			}
			if (requestedSeries?.Filter) {
				this.hitsFilter = esb.boolQuery().must([this.hitsFilter, toKibanaQuery(requestedSeries.Filter)]);
			}
		}
		if (request.body?.Filter) {
			this.hitsFilter = esb.boolQuery().must([this.hitsFilter, toKibanaQuery(request.body?.Filter)]);
		}
		// filter out hidden hits and apply data limit filter
		this.hitsFilter = esb.boolQuery().must([this.hitsFilter, hiddenFilter, this.dataLimitFilter]);

		this.hitsRequested = true;
	}
	return elasticRequestBody;
  }

  private async buildAllSeriesAggregation(aggregationsList: { [key: string]: esb.Aggregation[] }, query: DataQuery, resourceRelationData, body, hiddenFilter): Promise<any>{
    const variableValues: {[varName: string]: string} = body?.VariableValues;
    const filterObject: JSONFilter = body?.Filter;
    const userID: string = body?.UserID;
    const queryAggregation: any = [];
    const seriesToIterate = Object.keys(aggregationsList);
    for (const seriesName of seriesToIterate) {

      // build nested aggregations from array of aggregations for each series
      const seriesAggregation: esb.Aggregation = this.buildNestedAggregations(aggregationsList[seriesName]);
      const series = query.Series.filter(x => x.Name === seriesName)[0];

      // handle filter per series - merge resource filter per series and the filter object to one filter with 'AND' operation ("must" in DSL)
      let resourceFilter: Query = esb.termQuery('ElasticSearchType', series.Resource);

      if (series.Filter && Object.keys(series.Filter).length > 0) {
        if (variableValues) { this.replaceAllVariables(series.Filter, variableValues); }
        const serializedQuery: Query = toKibanaQuery(series.Filter, this.timeZoneOffsetString);
        resourceFilter = esb.boolQuery().must([resourceFilter, serializedQuery]);
      }
      const beforeAddingScopeFilters = Date.now();
      resourceFilter = await this.applyAdditionalFilters(series, resourceFilter, resourceRelationData, userID, variableValues);
      console.log(`applyAdditionalFilters time: ${Date.now() - beforeAddingScopeFilters} milliseconds`);

      if (this.hitsRequested) {
        this.hitsFilter = esb.boolQuery().must([this.hitsFilter, resourceFilter]);
      }
      if (filterObject) {
        resourceFilter = esb.boolQuery().must([resourceFilter, toKibanaQuery(filterObject, this.timeZoneOffsetString)]);
      }

      // filter out hidden records and apply data limit filter
      resourceFilter = esb.boolQuery().must([resourceFilter, hiddenFilter, this.dataLimitFilter]);

      const filterAggregation = esb.filterAggregation(seriesName, resourceFilter).agg(seriesAggregation);
      queryAggregation.push(filterAggregation);
    }

    return queryAggregation;
  }

  private replaceAllVariables(jsonFilter, variableValues: {[varName: string]: string}): void {
    if (jsonFilter.Operation === 'AND' || jsonFilter.Operation === 'OR') {
      const f1 = this.replaceAllVariables(jsonFilter.LeftNode, variableValues);
      const f2 = this.replaceAllVariables(jsonFilter.RightNode, variableValues);

    } else {
      const op = jsonFilter.Operation;
      const valueType = jsonFilter.ValueType; // to be compatible with latest ngx-lib
      if (op === 'IsEqualVariable' || op === 'LessThanVarible' || op === 'GreaterThanVarible' || op === 'BetweenVariable' || valueType === 'Dynamic') {
        jsonFilter.Operation = this.getOperation(op);
        for ( const varName in variableValues) {
          for (const i in jsonFilter.Values) {
            if (jsonFilter.Values[i] === varName) {
				// if the variable contains multiple values, we need to split the string and add each value as a separate value
				if (jsonFilter.FieldType === 'MultipleStringValues') {
					jsonFilter.Values.splice(i, 1); // remove the variable name
					jsonFilter.Values = jsonFilter.Values.concat(variableValues[varName].split(','));
				}
				else {
					jsonFilter.Values[i] = variableValues[varName];
				}
			}
          }
        }
      }
    }
  }

  getOperation(op: string): string {
	switch (op) {
		case 'IsEqualVariable':
			return 'IsEqual'
		case 'LessThanVarible':
			return '<'
		case 'GreaterThanVarible':
			return '>'
		case 'BetweenVariable':
			return 'Between'
		default:
			return op;
	}
  }

  // apply scope filters and conditional filters
  private async applyAdditionalFilters(series: Serie, resourceFilter: Query, resourceRelationData: Relation, requestedUserID: string, variableValues: {[varName: string]: string}): Promise<Query> {
	let userID;
	if (requestedUserID) {
		userID = requestedUserID;
	} else {
		const jwtData = <any>jwtDecode(this.client.OAuthAccessToken);
		const userFieldID = resourceRelationData.UserFieldID;
		const currUserId = userFieldID === "InternalID" ? jwtData["pepperi.id"] : jwtData["pepperi.useruuid"];
		userID = currUserId;
	}

	resourceFilter = await this.addUserFilters(series, resourceFilter, resourceRelationData, userID);
	resourceFilter = await this.addAccountsFilters(series, resourceFilter, resourceRelationData, userID);

	if (series.ConditionalFilters && variableValues) {
		resourceFilter = this.applyConditionalFilters(resourceFilter, series.ConditionalFilters, variableValues);
	}

    return resourceFilter;
  }

  private async addUserFilters(series: Serie, resourceFilter: Query, resourceRelationData: Relation, userID: string): Promise<Query> {
	if (series.Scope.User === "CurrentUser") {
		// IndexedUserFieldID
		const fieldName = resourceRelationData.IndexedUserFieldID;
		const userFilter: JSONFilter = this.buildJSONFilterObject(fieldName, [userID]);
		resourceFilter = esb.boolQuery().must([resourceFilter, toKibanaQuery(userFilter)]);
	}

	if (series.Scope.User === "UsersUnderMyRole") {
		const userFieldID = resourceRelationData.UserFieldID;
		const fieldName = resourceRelationData.IndexedUserFieldID;
		// working with papi users (instead of adal users), because buyers doesn't have IsUnderMyRole
		const usersUnderMyRole = await this.papiClient.get(`/users?where=IsUnderMyRole=true&fields=${userFieldID}`);
		const usersFilter: JSONFilter = this.buildJSONFilterObject(fieldName, usersUnderMyRole.map(user => user[userFieldID]));
		resourceFilter = esb.boolQuery().must([resourceFilter, toKibanaQuery(usersFilter)]);
	}

	return resourceFilter;
  }

  private async addAccountsFilters(series: Serie, resourceFilter: Query, resourceRelationData: Relation, userID: string): Promise<Query> {
	if (series.Scope.Account === "AccountsAssignedToCurrentUser") {
		// taking the fields from the relation
		const accountFieldID = resourceRelationData.AccountFieldID;
		const userFieldID = resourceRelationData.UserFieldID ?? "UUID";
		const accountFullFieldID = (userFieldID === "UUID") ? `Account` : `Account.${accountFieldID}`;
		const requestQuery = (userFieldID === "UUID") ?
			`where=Hidden=false and User='${userID}'&fields=${accountFullFieldID}` :
			`where=Hidden=false and User.${userFieldID}='${userID}'&fields=${accountFullFieldID}`;

		console.log(`requestQuery sent to resources/account_users: ${requestQuery}`);
		const assignedAccounts = await this.papiClient.get(`/resources/account_users?${requestQuery}`);

		//IndexedAccountFieldID
		const fieldName = resourceRelationData.IndexedAccountFieldID;
		const accountsFilter: JSONFilter = this.buildJSONFilterObject(fieldName, assignedAccounts.map(account => account[accountFullFieldID]));
		resourceFilter = esb.boolQuery().must([resourceFilter, toKibanaQuery(accountsFilter)]);
	}

	if (series.Scope.Account === "AccountsOfUsersUnderMyRole") {
		// working with papi users (instead of adal users), because buyers doesn't have IsUnderMyRole
		const usersUnderMyRole: any = await this.papiClient.get('/users?where=IsUnderMyRole=true');
		const accountFieldID = resourceRelationData.AccountFieldID;
		const userFieldID = resourceRelationData.UserFieldID ?? "UUID";
		const usersIds = this.buildUsersIdsString(usersUnderMyRole, userFieldID);

		// working with papi account_users (instead of adal account_users), because buyers doesn't have IsUnderMyRole
		const accountsOfUsersUnderMyRole = await this.papiClient.get(`/account_users?where=Hidden=false and User.${userFieldID} in ${usersIds}&fields=Account.${accountFieldID}`);
		const fieldName = resourceRelationData.IndexedAccountFieldID;
		const accountsOfUsersFilter: JSONFilter = this.buildJSONFilterObject(fieldName, accountsOfUsersUnderMyRole.map(account => account[`Account.${accountFieldID}`]));
		resourceFilter = esb.boolQuery().must([resourceFilter, toKibanaQuery(accountsOfUsersFilter)]);
	}

	return resourceFilter;
  }

  private buildJSONFilterObject(fieldName: string, values: string[]): JSONFilter {
	return {
		FieldType: 'String',
		ApiName: fieldName,
		Operation: 'IsEqual',
		Values: values
	}
  }

  private buildUsersIdsString(usersUnderMyRole, userFieldID): string {
    let IdsString = '(';
    for (const user of usersUnderMyRole) {
      IdsString += `'${user[userFieldID]}',`;
    }
    return `${IdsString.slice(0, -1)})`;
  }

  private buildSeriesAggregationList(series): { [key: string]: Aggregation[] } {

    const aggregationsList: { [key: string]: Aggregation[] } = {};

    for (const serie of series) {
      const aggregations: Aggregation[] = [];

      // First level - handle group by of each series
      if (serie.GroupBy && serie.GroupBy) {
        serie.GroupBy.forEach(groupBy => {
          if (groupBy.FieldID) {
            aggregations.push(this.buildAggregationQuery(groupBy));
          }
        });
      }

      // Second level handle break by
      if (serie.BreakBy && serie.BreakBy.FieldID) {
        aggregations.push(this.buildAggregationQuery(serie.BreakBy));
      }

      // Third level - handle aggregated fields
      this.handleSerieAggregatedFields(serie, aggregations, aggregationsList);


    }
    return aggregationsList;
  }

  private handleSerieAggregatedFields(serie: Serie, aggregations: Aggregation[], aggregationsList: { [key: string]: Aggregation[] }): void {
	// Third level - handle aggregated fields
	for (let i = 0; i < serie.AggregatedFields.length; i++) {
        const aggregatedField = serie.AggregatedFields[i];
        let agg;

        const lastIndex = serie.AggregatedFields.length - 1;

        const aggName = this.buildAggragationFieldString(aggregatedField);

        // if its script aggregation - we need more than one aggregation so we build the script aggs with its params
        if (aggregatedField.Aggregator === 'Script' && aggregatedField.Script) {
			this.handleScriptAggregation(i, serie, aggregations, aggregatedField, aggName)
        }
		else {

          agg = this.getAggregator(aggregatedField, aggName);

          if (i === lastIndex && serie.Top && serie.Top?.Max) {
            const bucketSortAgg = this.buildBucketSortAggregation(aggName, serie);
            const aggs = [agg, bucketSortAgg];
            aggregations[aggregations.length - 1].aggs(aggs);

          } else {
            aggregations.push(agg);
          }

        }
        aggregationsList[serie.Name] = aggregations;

      }
  }

  private handleScriptAggregation(fieldIndex: number, serie: Serie, aggregations: Aggregation[], aggregatedField: AggregatedField, aggName: string): void {
	const bucketPath = {};
	const scriptAggs: Aggregation[] = [];
	const lastIndex = serie.AggregatedFields.length - 1;
	serie.AggregatedParams?.forEach(aggregatedParam => {
	bucketPath[aggregatedParam.Name] = aggregatedParam.Name;
	scriptAggs.push(this.getAggregator(aggregatedParam, aggregatedParam.Name));
	});

	scriptAggs.push(esb.bucketScriptAggregation(aggName).bucketsPath(bucketPath).script(aggregatedField.Script!));

	// If its the last aggregated fields we need bucket sort aggregation in the last level
	if (fieldIndex === lastIndex && serie.Top && serie.Top?.Max) {
	const bucketSortAgg = this.buildBucketSortAggregation(aggName, serie);
	scriptAggs.push(bucketSortAgg);
	}
	aggregations[aggregations.length - 1].aggs(scriptAggs);
  }

  private buildBucketSortAggregation(aggName, serie): esb.BucketSortAggregation {
    const order = serie.Top.Ascending === true ? 'asc' : 'desc';
    return esb.bucketSortAggregation('sort').sort([esb.sort(aggName, order)]).size(serie.Top.Max)
  }

  private buildResponseFromElasticResults(lambdaResponse, query: DataQuery, seriesName: string): DataQueryResponse {

    const response: DataQueryResponse = new DataQueryResponse();
    const seriesToIterate = (seriesName) ? query.Series.filter(s => s.Name === seriesName) : query.Series;

    seriesToIterate.forEach(series => {

      const seriesData = new SeriesData(series.Name);

      const seriesAggregation = lambdaResponse.aggregations[series.Name];

      if (series.GroupBy && series.GroupBy[0].FieldID) {
		this.buildGroupBySerieResponse(series, seriesAggregation, response, seriesData);
      }
      else {
        let dataSet = <Map<string, any>>{};
        // if there is no group by - merge the data set with the first
        if (response.DataSet.length > 0) {
          dataSet = response.DataSet[0];
        } else {
          response.DataSet.push(dataSet);
        }

		this.handleSeriesWithoutGroupBy(series, seriesAggregation, response, dataSet, seriesData);
      }
      response.DataQueries.push(seriesData);
    });

    if (this.hitsRequested) { response.Objects = lambdaResponse.hits?.hits?.map(hit => hit['_source']); }
    response.NumberFormatter = this.getFormat(query);
    return response;
  }

  private buildGroupBySerieResponse(series: Serie, seriesAggregation: any, response: DataQueryResponse, seriesData: SeriesData): void {
	series.GroupBy!.forEach(groupBy => {
		let groupByString = groupBy.FieldID;

		if (groupBy.Alias) {
			groupByString = groupBy.Alias;
		}

		seriesData.Groups.push(groupByString);
		seriesAggregation[groupBy.FieldID].buckets.forEach(groupBybucket => {

		const groupByValue = this.getKeyAggregationName(groupBybucket).toString();
		let dataSet = <Map<string, any>>{};

		// If there are multiple Query Series, they should all have the same groups and then their series will be joined
		// So. if there data set with the same key & value - update it
		// for more details serach: Data aggregation resource PRD - 4.	Multiple Query Series
		const existingDataSet = response.DataSet.filter(currentDataSet => groupByString in currentDataSet && currentDataSet[groupByString] === groupByValue);
		if (existingDataSet.length > 0) {
			dataSet = existingDataSet[0];
		}
		else {
			dataSet[groupByString] = groupByValue;
			response.DataSet.push(dataSet);
		}
		this.handleSeriesWithGroupBy(series, groupBybucket, response, dataSet, seriesData);
		});
	});
  }

  private getFormat(query: DataQuery): any {
    let format = {};
    switch (query.Style) {
        case 'Custom':
            format = JSON.parse(query.Format);
            break;
        case 'Decimal':
            format = {style: "decimal"};
            break;
        case 'Currency':
            format = {style: "currency", currency: query.Currency};
            break;
		default:
    }
    return format;
  }

  private handleSeriesWithoutGroupBy(series: Serie, seriesAggregation: any, response: DataQueryResponse, dataSet, seriesData: SeriesData): void {
	// breakBy ONLY case
	if (series.BreakBy && series.BreakBy.FieldID) {
		this.handleAggregatorsFieldsWithBreakBy(seriesAggregation[series.BreakBy.FieldID], series, dataSet, seriesData);
	}
	// no groupBy or breakBy case
	else {
		// sending the aggregation itself as the bucket
		this.handleBucket(series.Name, seriesAggregation, series, dataSet, seriesData);
	}
  }

  private handleSeriesWithGroupBy(series: Serie, groupBybucket: any, response: DataQueryResponse, dataSet, seriesData: SeriesData): void {
	// groupBy AND breakBy case
    if (series.BreakBy && series.BreakBy.FieldID) {
      this.handleAggregatorsFieldsWithBreakBy(groupBybucket[series.BreakBy.FieldID], series, dataSet, seriesData);
    }
	// groupBy ONLY case
	// removed the dummyBreakBy from the query aggregation
    else {
		this.handleBucket(series.Name, groupBybucket, series, dataSet, seriesData);
    }
  }

  private handleAggregatorsFieldsWithBreakBy(breakBy: any, series: Serie, dataSet: Map<string, any>, seriesData: SeriesData): void {
    breakBy.buckets.forEach(bucket => {
      const seriesName = this.getKeyAggregationName(bucket);
      this.handleBucket(seriesName, bucket, series, dataSet, seriesData);
    });
  }

  private handleBucket(seriesName: string, bucket: any, series: Serie, dataSet: Map<string, any>, seriesData: SeriesData): void {
	if (series.Label) {
		seriesName = this.buildDataSetKeyString(seriesName, series.Label);
	}
	if (seriesData.Series.indexOf(seriesName) === -1) {
		seriesData.Series.push(seriesName);
	}
	this.handleAggregatedFields(seriesName, bucket, series.AggregatedFields, dataSet);
  }

  private handleAggregatedFields(seriesName, seriesAggregation, aggregatedFields, dataSet: Map<string, any>): void {
    aggregatedFields.forEach((aggregatedField) => {

      const keyString = this.buildAggragationFieldString(aggregatedField);
      let val;
      if (seriesAggregation[keyString]?.value !== null) {
        val = seriesAggregation[keyString].value;

      } else {
        val = seriesAggregation.doc_count;

      }
      dataSet[seriesName] = val;
    })
  }

  private getKeyAggregationName(bucket: any): string {
    // in case of histogram aggregation we want the key as data and not timestamp
    return bucket['key_as_string'] ? bucket['key_as_string'] : bucket.key;
  }

  private buildNestedAggregations(aggregations: esb.Aggregation[]): esb.Aggregation {
    let aggs: any = null;
    for (let i = aggregations.length - 1; i >= 0; i--) {
      if (i === aggregations.length - 1) {
        aggs = aggregations[i];
      } else {
        aggs = aggregations[i].agg(aggs);
      }
    }
    return aggs;
  }

  // build sggregation - if the type field is date time build dateHistogramAggregation else termsAggregation
  // sourceAggs determine if its group by or break by so we can distinguish between them in the results
  private buildAggregationQuery(groupBy: GroupBy): Aggregation {

    // Maximum size of each aggregation is 100
    //const topAggs = groupBy.Top?.Max ? groupBy.Top.Max : this.MaxAggregationSize;

    // there is a There is a difference between data histogram aggregation and terms aggregation.
    // data histogram aggregation has no size.
    // This aggregation is already selective in the sense that the number of buckets is manageable through the interval
    // so it is necessary to do nested aggregation to get size buckets
    //const isDateHistogramAggregation = groupBy.IntervalUnit && groupBy.Interval;
    let query;
    if (groupBy.Interval && groupBy.Interval !== "None" && groupBy.Format) {
      //const calenderInterval = `${groupBy.Interval}${this.intervalUnitMap[groupBy.IntervalUnit!]}`;
      query = esb.dateHistogramAggregation(groupBy.FieldID, groupBy.FieldID).calendarInterval(groupBy.Interval.toLocaleLowerCase()).format(groupBy.Format);
	if (this.timeZoneOffsetString) {
		query = query.timeZone(this.timeZoneOffsetString);
	}
    } else {
      query = esb.termsAggregation(groupBy.FieldID, `${groupBy.FieldID}`);
      query._aggs.terms["size"] = '1000'; // default brings 10 buckets, we want to bring all buckets.
    }
    //Handle the sorting
    //query.order('_key', groupBy.Top?.Ascending ? 'asc' : 'desc');

    // nested aggregation to get size buckets
    // if (isDateHistogramAggregation) {
    //   query.aggs([esb.bucketSortAggregation('Top').size(topAggs)])
    // }

    return query;
  }

  private buildAggragationFieldString(aggregatedField: AggregatedField): string {
    if (aggregatedField.Aggregator === 'Script') {
		return `${aggregatedField.Aggregator}`
    } else {
		const dotRegex = new RegExp('\\.', 'g');
		return `${aggregatedField.FieldID.replace(dotRegex, '')}_${aggregatedField.Aggregator}`
    }
  }

  buildDataSetKeyString(keyName: string, pattern: string): string {
    return pattern.replace('${label}', keyName);
  }

  private getAggregator(aggregatedField: AggregatedField, aggName: string): esb.MetricsAggregationBase {
    let agg;
    switch (aggregatedField.Aggregator) {
      case 'Sum':
        agg = esb.sumAggregation(aggName, aggregatedField.FieldID);
        break;
      case 'CountDistinct':
        agg = esb.cardinalityAggregation(aggName, aggregatedField.FieldID);
        break;
      case 'Count':
        agg = esb.valueCountAggregation(aggName, '_id');
        break;
      case 'Average':
        agg = esb.avgAggregation(aggName, aggregatedField.FieldID);
        break;
      default:

    }
    return agg;
  }

  private async getUserDefinedQuery(request: Request): Promise<DataQuery> {

    const queryKey = request.query.key;

    if (!queryKey) {
      throw new Error(`Missing request parameters: key`);
    }

    const adal = this.papiClient.addons.data.uuid(config.AddonUUID).table(DATA_QUREIES_TABLE_NAME);
    const query = await adal.key(queryKey).get();

    if (!query) {
      throw new Error(`Invalid request parameters: key`);
    }
    return <DataQuery>query;
  }

  private timeZoneOffsetToString(timeZoneOffset: number): string | undefined {
	let timeZoneOffsetString: string | undefined = undefined;

	if (timeZoneOffset) {
		timeZoneOffsetString = this.toHoursAndMinutes(Math.abs(timeZoneOffset));
		timeZoneOffsetString = (timeZoneOffset >= 0) ? `+${timeZoneOffsetString}` : `-${timeZoneOffsetString}`;
	}

	return timeZoneOffsetString;
  }

  private toHoursAndMinutes(totalMinutes: number): string {
	const minutes = totalMinutes % 60;
	const hours = Math.floor(totalMinutes / 60);

	return `${this.padTo2Digits(hours)}:${this.padTo2Digits(minutes)}`;
  }

  private padTo2Digits(num: number): string {
	return num.toString().padStart(2, '0');
  }

  public async executeMultipleQueries(body: BulkExecuteBody): Promise<DataQueryResponse[]> {
	const startTime = Date.now();
	const queriesData = body?.QueriesData;
	const timeZoneOffset = body?.TimeZoneOffset;

	const responses = await Promise.all(queriesData.map(queryData => {
		const request: Request = {
			query: {key: queryData.Key},
			body: {
				TimeZoneOffset: timeZoneOffset,
				VariableValues: queryData.VariableValues,
			},
			method: "POST",
			header: {}
		}
		return this.executeUserDefinedQuery(request);
	}));

	console.log(`Total execution time of ${queriesData.length} queries: ${Date.now() - startTime} milliseconds`);
	return responses;
  }

  // apply only filters which are fullfilled by the defined condition
  private applyConditionalFilters(resourceFilter: Query, conditionalFilters: ConditionalFilter[], variableValues: {[varName: string]: string}): Query {
	for (const conditionalFilter of conditionalFilters) {
		if (this.filterConditionIsFullfilled(conditionalFilter.Condition, variableValues)) {
			this.replaceAllVariables(conditionalFilter.Filter, variableValues); // replace all variables with their values
			resourceFilter = esb.boolQuery().must([resourceFilter, toKibanaQuery(conditionalFilter.Filter)]);
		}
	}
	return resourceFilter;
  }

  filterConditionIsFullfilled(filterCondition: FilterCondition, variableValues: {[varName: string]: string}): boolean {
	let isFullfilled = false;

	if (filterCondition.operation === 'Equal to') {
		isFullfilled = this.equalsIgnoringCase(variableValues[filterCondition.variable], filterCondition.value);
	}
	else if (filterCondition.operation === 'Not equal to') {
		isFullfilled = !this.equalsIgnoringCase(variableValues[filterCondition.variable], filterCondition.value);
	}

	return isFullfilled;
  }

  equalsIgnoringCase(str1: string, str2: string): boolean {
	return str1?.localeCompare(str2, undefined, { sensitivity: 'base' }) === 0;
  }

  applyDataLimitFilter(daysLimit: string, resource: string): void {
	const filterObject = {
		FieldType: 'DateTime',
		ApiName: (resource === 'all_activities' || resource === 'transaction_lines') ? 'ActionDateTime' : 'ModificationDateTime',
		Operation: 'InTheLast',
		Values: [daysLimit, 'Days']
	}

	this.dataLimitFilter = esb.boolQuery().must([this.dataLimitFilter, toKibanaQuery(filterObject as JSONFilter)]);
  }

}

export default ElasticService;
