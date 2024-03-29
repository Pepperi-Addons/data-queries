import { PapiClient } from '@pepperi-addons/papi-sdk'
import { Client, Request } from '@pepperi-addons/debug-server';
import config from '../../addon.config.json'
import { AggregatedField, DataQuery, DATA_QUREIES_TABLE_NAME, GroupBy, Interval, Serie } from '../models/data-query';
import { validate } from 'jsonschema';
import esb, { Aggregation, Query, RequestBodySearch } from 'elastic-builder';
import { callElasticSearchLambda } from '@pepperi-addons/system-addon-utils';
import jwtDecode from 'jwt-decode';
import { DataQueryResponse, SeriesData } from '../models/data-query-response';
import { QueryExecutionScheme } from '../models/query-execution-scheme';
import {JSONFilter, toKibanaQuery} from '@pepperi-addons/pepperi-filters'

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

  async executeUserDefinedQuery(client: Client, request: Request) {

    const validation = validate(request.body, QueryExecutionScheme);

    if (!validation.valid) {
      throw new Error(validation.toString());
    }

    const query: DataQuery = await this.getUserDefinedQuery(request);
    let elasticRequestBody: RequestBodySearch;
    let hitsRequested = false;
    // for filtering out hidden records
    const hiddenFilter = esb.boolQuery().should([esb.matchQuery('Hidden', 'false'), esb.boolQuery().mustNot(esb.existsQuery('Hidden'))]);
    if(!request.body?.PageSize && !request.body?.Page) {
      elasticRequestBody = new esb.RequestBodySearch().size(0);
    } else {
      let pageSize = request.body?.PageSize ?? 100;
      if(pageSize > 100) pageSize = 100;
      let page = request.body?.Page ?? 1;
      page = Math.max(page-1,0);
      elasticRequestBody = new esb.RequestBodySearch().size(pageSize).from(pageSize*(page));
      if(request.body?.Fields) elasticRequestBody = elasticRequestBody.source(request.body.Fields);
      if(request.body?.Series) {
        const requestedSeries = query.Series.find(s => s.Name === request.body.Series);
        if(!requestedSeries) {
          throw new Error(`Series '${request.body.Series}' does not exist on data query ID: ${query.Key}`);
        }
        if(requestedSeries?.Filter) {
          this.hitsFilter = esb.boolQuery().must([this.hitsFilter, toKibanaQuery(requestedSeries.Filter)]);
        }
      }
      if(request.body?.Filter) {
        this.hitsFilter = esb.boolQuery().must([this.hitsFilter, toKibanaQuery(request.body?.Filter)]);
      }
      // filter out hidden hits
      this.hitsFilter = esb.boolQuery().must([this.hitsFilter, hiddenFilter]);
      hitsRequested = true;
    }

    if (!query.Series || query.Series.length == 0) {
      return new DataQueryResponse();
    }

    // handle aggregation by series
    const series = request.body?.Series ? query.Series.filter(s => s.Name == request.body?.Series) : query.Series;
    let aggregationsList: { [key: string]: Aggregation[] } = this.buildSeriesAggregationList(series);

    // need to get the relation data based on the resource name
    const resourceRelationData = (await this.papiClient.addons.data.relations.find({
      where: `RelationName='DataQueries' AND Name='${query.Resource}'`
    }))[0];

    // build one query with all series (each aggregation have query and aggs)
    let queryAggregation: any = await this.buildAllSeriesAggregation(aggregationsList, query, resourceRelationData, request.body, hitsRequested, hiddenFilter);
    // this filter will be applied on the hits after aggregation is calculated
    elasticRequestBody.postFilter(this.hitsFilter);
    elasticRequestBody.aggs(queryAggregation);
    const body = {"DSL": elasticRequestBody.toJSON()};
    console.log(`lambdaBody: ${JSON.stringify(body)}`);

    //const lambdaResponse = await callElasticSearchLambda(endpoint, method, JSON.stringify(body), null, true);

    // if (!lambdaResponse.success) {
    //   console.log(`Failed to execute data query ID: ${query.Key}, lambdaBody: ${JSON.stringify(body)}`)
    //   throw new Error(`Failed to execute data query ID: ${query.Key}`);
    // }
    try {
      //const lambdaResponse = await this.papiClient.post(`/elasticsearch/search/${query.Resource}`,body);
      const lambdaResponse = await this.papiClient.post(resourceRelationData.AddonRelativeURL ?? '',body);
      console.log(`lambdaResponse: ${JSON.stringify(lambdaResponse)}`);
      const response: DataQueryResponse = this.buildResponseFromElasticResults(lambdaResponse, query, request.body?.Series, hitsRequested);
      return response;
    }
    catch(ex){
      console.log(`Failed to execute data query ID: ${query.Key}, lambdaBody: ${JSON.stringify(body)}`,ex)
      throw new Error(`Failed to execute data query ID: ${query.Key}`);
    }

  }

  private async buildAllSeriesAggregation(aggregationsList: { [key: string]: esb.Aggregation[] }, query: DataQuery, resourceRelationData, body, hitsRequested, hiddenFilter) {
    const variableValues: {[varName: string]: string} = body?.VariableValues;
    const filterObject: JSONFilter = body?.Filter;
    const userID: string = body?.UserID;
    let queryAggregation: any = [];
    let seriesToIterate = Object.keys(aggregationsList);
    for(const seriesName of seriesToIterate) {

      // build nested aggregations from array of aggregations for each series
      let seriesAggregation: esb.Aggregation = this.buildNestedAggregations(aggregationsList[seriesName]);
      const series = query.Series.filter(x => x.Name === seriesName)[0];

      // handle filter per series - merge resource filter per series and the filter object to one filter with 'AND' operation ("must" in DSL)
      let resourceFilter: Query = esb.termQuery('ElasticSearchType', series.Resource);

      if (series.Filter && Object.keys(series.Filter).length > 0) {
        if(variableValues) this.replaceAllVariables(series.Filter, variableValues);
        const serializedQuery: Query = toKibanaQuery(series.Filter);
        resourceFilter = esb.boolQuery().must([resourceFilter, serializedQuery]);
      }
      resourceFilter = await this.addScopeFilters(series, resourceFilter, resourceRelationData, userID);
      if(hitsRequested) {
        this.hitsFilter = esb.boolQuery().must([this.hitsFilter, resourceFilter]);
      }
      if(filterObject) {
        resourceFilter = esb.boolQuery().must([resourceFilter, toKibanaQuery(filterObject)]);
      }

      // filter out hidden records
      resourceFilter = esb.boolQuery().must([resourceFilter, hiddenFilter]);

      const filterAggregation = esb.filterAggregation(seriesName, resourceFilter).agg(seriesAggregation);
      queryAggregation.push(filterAggregation);
    };

    return queryAggregation;
  }

  private replaceAllVariables(jsonFilter, variableValues: {[varName: string]: string}) {
    if (jsonFilter.Operation === 'AND' || jsonFilter.Operation === 'OR') {
      const f1 = this.replaceAllVariables(jsonFilter.LeftNode, variableValues);
      const f2 = this.replaceAllVariables(jsonFilter.RightNode, variableValues);
      return;
    } else {
      const op = jsonFilter.Operation;
      if(op == 'IsEqualVariable' || op == 'LessThanVarible' || op == 'GreaterThanVarible' || op == 'BetweenVariable') {
        switch(op) {
          case 'IsEqualVariable':
            jsonFilter.Operation = 'IsEqual'
            break
          case 'LessThanVarible':
            jsonFilter.Operation = '<'
            break
          case 'GreaterThanVarible':
            jsonFilter.Operation = '>'
            break
          case 'BetweenVariable':
            jsonFilter.Operation = 'Between'
        }
        for( const varName in variableValues) {
          for(const i in jsonFilter.Values) {
            if(jsonFilter.Values[i] == varName)
              jsonFilter.Values[i] = variableValues[varName]
          }
        }
      }
    }
  }

  // if there is scope add user/accounts filters to resourceFilter
  private async addScopeFilters(series, resourceFilter, resourceRelationData, requestedUserID) {
	let userID;
	if(requestedUserID) {
		userID = requestedUserID;
	} else {
		const jwtData = <any>jwtDecode(this.client.OAuthAccessToken);
		const userFieldID = resourceRelationData.UserFieldID;
		const currUserId = userFieldID=="InternalID" ? jwtData["pepperi.id"] : jwtData["pepperi.useruuid"];
		userID = currUserId;
	}
	
    if (series.Scope.User == "CurrentUser") {
      // IndexedUserFieldID
      const fieldName = resourceRelationData.IndexedUserFieldID;
      var userFilter: JSONFilter = {
        FieldType: 'String',
        ApiName: fieldName,
        Operation: 'IsEqual',
        Values: [userID]
      }
      resourceFilter = esb.boolQuery().must([resourceFilter, toKibanaQuery(userFilter)]);
    }

    if(series.Scope.User == "UsersUnderMyRole") {
      const userFieldID = resourceRelationData.UserFieldID;
      const fieldName = resourceRelationData.IndexedUserFieldID;
      const usersUnderMyRole = await this.papiClient.get(`/users?where=IsUnderMyRole=true&fields=${userFieldID}`);
      var usersFilter: JSONFilter = {
        FieldType: 'String',
        ApiName: fieldName,
        Operation: 'IsEqual',
        Values: usersUnderMyRole.map(user => user[userFieldID])
      }
      resourceFilter = esb.boolQuery().must([resourceFilter, toKibanaQuery(usersFilter)]);
    }

    if(series.Scope.Account == "AccountsAssignedToCurrentUser") {
      // taking the fields from the relation
      const accountFieldID = resourceRelationData.AccountFieldID;
      const userFieldID = resourceRelationData.UserFieldID ?? "UUID";
      const assignedAccounts = await this.papiClient.get(`/account_users?where=Hidden=false and User.${userFieldID}='${userID}'&fields=Account.${accountFieldID}`);

      //IndexedAccountFieldID
      const fieldName = resourceRelationData.IndexedAccountFieldID;
      var accountsFilter: JSONFilter = {
        FieldType: 'String',
        ApiName: fieldName,
        Operation: 'IsEqual',
        Values: assignedAccounts.map(account => account[`Account.${accountFieldID}`])
      }
      resourceFilter = esb.boolQuery().must([resourceFilter, toKibanaQuery(accountsFilter)]);
    }

    if(series.Scope.Account == "AccountsOfUsersUnderMyRole") {
      const usersUnderMyRole: any = await this.papiClient.get('/users?where=IsUnderMyRole=true');
      const accountFieldID = resourceRelationData.AccountFieldID;
      const userFieldID = resourceRelationData.UserFieldID ?? "UUID";
      const usersIds = this.buildUsersIdsString(usersUnderMyRole, userFieldID);
      const accountsOfUsersUnderMyRole = await this.papiClient.get(`/account_users?where=Hidden=false and User.${userFieldID} in ${usersIds}&fields=Account.${accountFieldID}`);
      const fieldName = resourceRelationData.IndexedAccountFieldID;
      var accountsOfUsersFilter: JSONFilter = {
        FieldType: 'String',
        ApiName: fieldName,
        Operation: 'IsEqual',
        Values: accountsOfUsersUnderMyRole.map(account => account[`Account.${accountFieldID}`])
      }
      resourceFilter = esb.boolQuery().must([resourceFilter, toKibanaQuery(accountsOfUsersFilter)]);
    }

    return resourceFilter;
  }

  private buildUsersIdsString(usersUnderMyRole, userFieldID) {
    let IdsString = '(';
    for(const user of usersUnderMyRole) {
      IdsString += `'${user[userFieldID]}',`;
    }
    return IdsString.slice(0,-1)+')';
  }

  private buildSeriesAggregationList(series) {

    let aggregationsList: { [key: string]: Aggregation[] } = {};

    for (const serie of series) {
      let aggregations: Aggregation[] = [];

      // First level - handle group by of each series
      if (serie.GroupBy && serie.GroupBy) {
        serie.GroupBy.forEach(groupBy => {
          if (groupBy.FieldID) {
            aggregations.push(this.buildAggregationQuery(groupBy, aggregations));
          }
        });
      }

      // Second level handle break by
      if (serie.BreakBy && serie.BreakBy.FieldID) {
        aggregations.push(this.buildAggregationQuery(serie.BreakBy, aggregations));
      }

      // Third level - handle aggregated fields
      for (let i = 0; i < serie.AggregatedFields.length; i++) {
        const aggregatedField = serie.AggregatedFields[i];
        let agg;

        let lastIndex = serie.AggregatedFields.length - 1;

        const aggName = this.buildAggragationFieldString(aggregatedField);

        // if its script aggregation - we need more than one aggregation so we build the script aggs with its params
        if (aggregatedField.Aggregator === 'Script' && aggregatedField.Script) {
          let bucketPath = {};
          let scriptAggs: Aggregation[] = [];
          serie.AggregatedParams?.forEach(aggregatedParam => {
            bucketPath[aggregatedParam.Name] = aggregatedParam.Name;
            scriptAggs.push(this.getAggregator(aggregatedParam, aggregatedParam.Name));
          });

          scriptAggs.push(esb.bucketScriptAggregation(aggName).bucketsPath(bucketPath).script(aggregatedField.Script));

          // If its the last aggregated fields we need bucket sort aggregation in the last level
          if (i === lastIndex && serie.Top && serie.Top?.Max) {
            const bucketSortAgg = this.buildBucketSortAggregation(aggName, serie);
            scriptAggs.push(bucketSortAgg);
          }
          aggregations[aggregations.length - 1].aggs(scriptAggs);

        } else {

          agg = this.getAggregator(aggregatedField, aggName);

          if (i === lastIndex && serie.Top && serie.Top?.Max) {
            const bucketSortAgg = this.buildBucketSortAggregation(aggName, serie);
            let aggs = [agg, bucketSortAgg];
            aggregations[aggregations.length - 1].aggs(aggs);

          } else {
            aggregations.push(agg);
          }

        }
        aggregationsList[serie.Name] = aggregations;

      }
    }
    return aggregationsList;
  }

  private buildBucketSortAggregation(aggName, serie) {
    const order = serie.Top.Ascending === true ? 'asc' : 'desc';
    return esb.bucketSortAggregation('sort').sort([esb.sort(aggName, order)]).size(serie.Top.Max)
  }

  private buildResponseFromElasticResults(lambdaResponse, query: DataQuery, seriesName: string, hitsRequested: boolean) {

    let response: DataQueryResponse = new DataQueryResponse();
    const seriesToIterate = (seriesName) ? query.Series.filter(s => s.Name==seriesName) : query.Series;

    seriesToIterate.forEach(series => {

      let seriesData = new SeriesData(series.Name);

      const seriesAggregation = lambdaResponse.aggregations[series.Name];

      if (series.GroupBy && series.GroupBy[0].FieldID) {

        series.GroupBy.forEach(groupBy => {
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
            const existingDataSet = response.DataSet.filter(dataSet => groupByString in dataSet && dataSet[groupByString] === groupByValue);
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
    if(hitsRequested) response.Objects = lambdaResponse.hits?.hits?.map(hit => hit['_source']);
    response.NumberFormatter = this.getFormat(query);
    return response;
  }

  private getFormat(query) {
    let format = {};
    switch(query.Style) {
        case 'Custom':
            format = JSON.parse(query.Format);
            break;
        case 'Decimal':
            format = {style: "decimal"};
            break;
        case 'Currency':
            format = {style:"currency", currency: query.Currency};
            break;
    }
    return format;
  }

  private handleSeriesWithoutGroupBy(series: Serie, seriesAggregation: any, response: DataQueryResponse, dataSet, seriesData: SeriesData) {
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

  private handleSeriesWithGroupBy(series: Serie, groupBybucket: any, response: DataQueryResponse, dataSet, seriesData: SeriesData) {
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

  private handleAggregatorsFieldsWithBreakBy(breakBy: any, series: Serie, dataSet: Map<string, any>, seriesData: SeriesData) {
    breakBy.buckets.forEach(bucket => {
      const seriesName = this.getKeyAggregationName(bucket);
      this.handleBucket(seriesName, bucket, series, dataSet, seriesData);
    });
  }

  private handleBucket(seriesName: string, bucket: any, series: Serie, dataSet: Map<string, any>, seriesData: SeriesData) {
	if (series.Label) {
		seriesName = this.buildDataSetKeyString(seriesName, series.Label);
	  }
	  if (seriesData.Series.indexOf(seriesName) == -1) {
		seriesData.Series.push(seriesName);
	  }
	  this.handleAggregatedFields(seriesName, bucket, series.AggregatedFields, dataSet);
  }

  private handleAggregatedFields(seriesName, seriesAggregation, aggregatedFields, dataSet: Map<string, any>) {
    aggregatedFields.forEach((aggregatedField) => {

      const keyString = this.buildAggragationFieldString(aggregatedField);
      let val;
      if (seriesAggregation[keyString]?.value != null) {
        val = seriesAggregation[keyString].value;

      } else {
        val = seriesAggregation.doc_count;

      }
      dataSet[seriesName] = val;
    })
  }

  private getKeyAggregationName(bucket: any) {
    // in case of histogram aggregation we want the key as data and not timestamp
    return bucket['key_as_string'] ? bucket['key_as_string'] : bucket.key;
  }

  private buildNestedAggregations(aggregations: esb.Aggregation[]) {
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
  private buildAggregationQuery(groupBy: GroupBy, sggregations: esb.Aggregation[]) {

    // Maximum size of each aggregation is 100
    //const topAggs = groupBy.Top?.Max ? groupBy.Top.Max : this.MaxAggregationSize;

    // there is a There is a difference between data histogram aggregation and terms aggregation. 
    // data histogram aggregation has no size.
    // This aggregation is already selective in the sense that the number of buckets is manageable through the interval 
    // so it is necessary to do nested aggregation to get size buckets
    //const isDateHistogramAggregation = groupBy.IntervalUnit && groupBy.Interval;
    let query;
    if (groupBy.Interval && groupBy.Interval != "None" && groupBy.Format) {
      //const calenderInterval = `${groupBy.Interval}${this.intervalUnitMap[groupBy.IntervalUnit!]}`;
      query = esb.dateHistogramAggregation(groupBy.FieldID, groupBy.FieldID).calendarInterval(groupBy.Interval.toLocaleLowerCase()).format(groupBy.Format);
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
      return `${aggregatedField.FieldID.replace('.', '')}_${aggregatedField.Aggregator}`
    }
  }

  buildDataSetKeyString(keyName: string, pattern: string) {
    return pattern.replace('${label}', keyName);
  }

  private getAggregator(aggregatedField: AggregatedField, aggName: string) {
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

    }
    return agg;
  }

  private async getUserDefinedQuery(request: Request) {

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
}

export default ElasticService;