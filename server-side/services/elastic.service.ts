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

  async executeUserDefinedQuery(client: Client, request: Request) {

    const validation = validate(request.body, QueryExecutionScheme);

    if (!validation.valid) {
      throw new Error(validation.toString());
    }

    const query: DataQuery = await this.getUserDefinedQuery(request);
    const distributorUUID = (<any>jwtDecode(client.OAuthAccessToken))["pepperi.distributoruuid"];
    let endpoint = `${distributorUUID}/_search`;
    const method = 'POST';
    let elasticRequestBody: RequestBodySearch;
    let hitsRequested = false;
    if(!request.body.PageSize && !request.body.Page) {
      elasticRequestBody = new esb.RequestBodySearch().size(0);
    } else {
      let pageSize = request.body.PageSize ?? 100;
      if(pageSize > 100) pageSize = 100;
      let page = request.body.Page ?? 1;
      page = Math.max(page-1,0);
      elasticRequestBody = new esb.RequestBodySearch().size(pageSize).from(pageSize*(page));
      if(request.body.Fields) elasticRequestBody = elasticRequestBody.source(request.body.Fields);
      if(request.body.Filter) {
        let HitsFilter = toKibanaQuery(request.body.Filter);
        if(request.body.Series) {
          const requestedSeries = query.Series.find(s => s.Name === request.body.Series);
          if(!requestedSeries)
            throw new Error(`Series '${request.body.Series}' does not exist on data query ID: ${query.Key}`);
          if(requestedSeries.Filter)
            HitsFilter = esb.boolQuery().must([HitsFilter, toKibanaQuery(requestedSeries.Filter)]);
        }
        // this filter will be applied on the hits after aggregation is calculated.
        elasticRequestBody = elasticRequestBody.postFilter(HitsFilter);
      } 
      hitsRequested = true;
    }

    if (!query.Series || query.Series.length == 0) {
      return new DataQueryResponse();
    }

    // handle aggregation by series
    let aggregationsList: { [key: string]: Aggregation[] } = this.buildSeriesAggregationList(query.Series);

    // need to get the relation data based on the resource name
    const resourceRelationData = (await this.papiClient.addons.data.relations.find({
      where: `RelationName='DataQueries' AND Name='${query.Resource}'`
    }))[0];

    // build one query with all series (each aggregation have query and aggs)
    let queryAggregation: any = await this.buildAllSeriesAggregation(aggregationsList, query, request.body?.VariableValues, resourceRelationData, request.body?.Filter, request.body?.Series, request.body.IgnoreScopeFilters ?? false);

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

  private async buildAllSeriesAggregation(aggregationsList: { [key: string]: esb.Aggregation[]; }, query: DataQuery, variableValues: {[varName: string]: string}, resourceRelationData, filterObject: JSONFilter, seriesName: string, ignoreScopeFilters: boolean) {
    let queryAggregation: any = [];
    let seriesToIterate = Object.keys(aggregationsList);
    if(seriesName) {
      seriesToIterate = seriesToIterate.filter(s => s==seriesName);
      if(seriesToIterate.length==0) {
        throw new Error(`Series named '${seriesName}' does not exist on data query '${query.Key}'`);
      }
    }
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
      if(!ignoreScopeFilters) {
        resourceFilter = await this.addScopeFilters(series, resourceFilter, resourceRelationData);
      }
      if(filterObject) {
        resourceFilter = esb.boolQuery().must([resourceFilter, toKibanaQuery(filterObject)]);
      }
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
  private async addScopeFilters(series, resourceFilter, resourceRelationData) {
    if (series.Scope.User == "CurrentUser") {
      const jwtData = <any>jwtDecode(this.client.OAuthAccessToken);
      const userFieldID = resourceRelationData.UserFieldID;
      const currUserId = userFieldID=="InternalID" ? jwtData["pepperi.id"] : jwtData["pepperi.useruuid"];
      // IndexedUserFieldID
      const fieldName = resourceRelationData.IndexedUserFieldID;
      var userFilter: JSONFilter = {
        FieldType: 'String',
        ApiName: fieldName,
        Operation: 'IsEqual',
        Values: [currUserId]
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
      const jwtData = <any>jwtDecode(this.client.OAuthAccessToken);
      // taking the fields from the relation
      const accountFieldID = resourceRelationData.AccountFieldID;
      const userFieldID = resourceRelationData.UserFieldID;
      const currUserId = userFieldID=="InternalID" ? jwtData["pepperi.id"] : jwtData["pepperi.useruuid"];
      const assignedAccounts = await this.papiClient.get(`/account_users?where=User.${userFieldID}=${currUserId}&fields=Account.${accountFieldID}`);

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
      const userFieldID = resourceRelationData.UserFieldID;
      const usersIds = this.buildUsersIdsString(usersUnderMyRole, userFieldID);
      const accountsOfUsersUnderMyRole = await this.papiClient.get(`/account_users?where=User.${userFieldID} in ${usersIds}&fields=Account.${accountFieldID}`);
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

      // Second level handle break by - if no break by - create dummy break by becuase we works on buckets
      if (serie.BreakBy && serie.BreakBy.FieldID) {
        aggregations.push(this.buildAggregationQuery(serie.BreakBy, aggregations));
      }
      else {
        aggregations.push(this.buildDummyBreakBy());
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

  buildDummyBreakBy(): esb.Aggregation {
    let query: Aggregation = esb.termsAggregation('DummyBreakBy').script(esb.script('inline', "'DummyBreakBy'")).minDocCount(0);
    return query;
  }

  private buildBucketSortAggregation(aggName, serie) {
    const order = serie.Top.Ascending === true ? 'asc' : 'desc';
    return esb.bucketSortAggregation('sort').sort([esb.sort(aggName, order)]).size(serie.Top.Max)
  }

  private buildResponseFromElasticResults(lambdaResponse, query: DataQuery, seriesName: string, hitsRequested: boolean) {

    // for debugging
    // lambdaResponse = {
    //   "aggregations" : {
    //     "Total sales ($)" : {
    //       "doc_count" : 6122,
    //       "Item.MainCategory" : {
    //         "doc_count_error_upper_bound" : 0,
    //         "sum_other_doc_count" : 0,
    //         "buckets" : [
    //           {
    //             "key" : "Pharmacy",
    //             "doc_count" : 5203,
    //             "DummyBreakBy" : {
    //               "doc_count_error_upper_bound" : 0,
    //               "sum_other_doc_count" : 0,
    //               "buckets" : [
    //                 {
    //                   "key" : "DummyBreakBy",
    //                   "doc_count" : 5203,
    //                   "TotalUnitsPriceAfterDiscount_Sum" : {
    //                     "value" : 1310815.0
    //                   }
    //                 }
    //               ]
    //             }
    //           },
    //           {
    //             "key" : "Skincare",
    //             "doc_count" : 779,
    //             "DummyBreakBy" : {
    //               "doc_count_error_upper_bound" : 0,
    //               "sum_other_doc_count" : 0,
    //               "buckets" : [
    //                 {
    //                   "key" : "DummyBreakBy",
    //                   "doc_count" : 779,
    //                   "TotalUnitsPriceAfterDiscount_Sum" : {
    //                     "value" : 83446.0
    //                   }
    //                 }
    //               ]
    //             }
    //           },
    //           {
    //             "key" : "Hand Cosmetics",
    //             "doc_count" : 139,
    //             "DummyBreakBy" : {
    //               "doc_count_error_upper_bound" : 0,
    //               "sum_other_doc_count" : 0,
    //               "buckets" : [
    //                 {
    //                   "key" : "DummyBreakBy",
    //                   "doc_count" : 139,
    //                   "TotalUnitsPriceAfterDiscount_Sum" : {
    //                     "value" : 3879.0
    //                   }
    //                 }
    //               ]
    //             }
    //           },
    //           {
    //             "key" : "PPI_Package1",
    //             "doc_count" : 1,
    //             "DummyBreakBy" : {
    //               "doc_count_error_upper_bound" : 0,
    //               "sum_other_doc_count" : 0,
    //               "buckets" : [
    //                 {
    //                   "key" : "DummyBreakBy",
    //                   "doc_count" : 1,
    //                   "TotalUnitsPriceAfterDiscount_Sum" : {
    //                     "value" : 57.0
    //                   }
    //                 }
    //               ]
    //             }
    //           }
    //         ]
    //       }
    //     },
    //     "Total sales (QTY)" : {
    //       "doc_count" : 6122,
    //       "Item.MainCategory" : {
    //         "doc_count_error_upper_bound" : 0,
    //         "sum_other_doc_count" : 0,
    //         "buckets" : [
    //           {
    //             "key" : "Pharmacy",
    //             "doc_count" : 5203,
    //             "DummyBreakBy" : {
    //               "doc_count_error_upper_bound" : 0,
    //               "sum_other_doc_count" : 0,
    //               "buckets" : [
    //                 {
    //                   "key" : "DummyBreakBy",
    //                   "doc_count" : 5203,
    //                   "UnitsQuantity_Sum" : {
    //                     "value" : 66906.0
    //                   }
    //                 }
    //               ]
    //             }
    //           },
    //           {
    //             "key" : "Skincare",
    //             "doc_count" : 779,
    //             "DummyBreakBy" : {
    //               "doc_count_error_upper_bound" : 0,
    //               "sum_other_doc_count" : 0,
    //               "buckets" : [
    //                 {
    //                   "key" : "DummyBreakBy",
    //                   "doc_count" : 779,
    //                   "UnitsQuantity_Sum" : {
    //                     "value" : 3742.0
    //                   }
    //                 }
    //               ]
    //             }
    //           },
    //           {
    //             "key" : "Hand Cosmetics",
    //             "doc_count" : 139,
    //             "DummyBreakBy" : {
    //               "doc_count_error_upper_bound" : 0,
    //               "sum_other_doc_count" : 0,
    //               "buckets" : [
    //                 {
    //                   "key" : "DummyBreakBy",
    //                   "doc_count" : 139,
    //                   "UnitsQuantity_Sum" : {
    //                     "value" : 211.0
    //                   }
    //                 }
    //               ]
    //             }
    //           },
    //           {
    //             "key" : "PPI_Package1",
    //             "doc_count" : 1,
    //             "DummyBreakBy" : {
    //               "doc_count_error_upper_bound" : 0,
    //               "sum_other_doc_count" : 0,
    //               "buckets" : [
    //                 {
    //                   "key" : "DummyBreakBy",
    //                   "doc_count" : 1,
    //                   "UnitsQuantity_Sum" : {
    //                     "value" : 1.0
    //                   }
    //                 }
    //               ]
    //             }
    //           }
    //         ]
    //       }
    //     }
    //   }
    // }

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
          seriesAggregation[groupBy.FieldID].buckets.forEach(groupBybuckets => {

            const groupByValue = this.getKeyAggregationName(groupBybuckets).toString();
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
            this.handleBreakBy(series, groupBybuckets, response, dataSet, seriesData);
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
        this.handleBreakBy(series, seriesAggregation, response, dataSet, seriesData);
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

  private handleBreakBy(series: Serie, groupBybuckets: any, response: DataQueryResponse, dataSet, seriesData: SeriesData) {
    if (series.BreakBy && series.BreakBy.FieldID) {
      this.handleAggregatorsFieldsWithBreakBy(groupBybuckets[series.BreakBy.FieldID], series, dataSet, seriesData);
    }
    else {
      this.handleAggregatorsFieldsWithBreakBy(groupBybuckets['DummyBreakBy'], series, dataSet, seriesData);
    }
  }

  private handleAggregatorsFieldsWithBreakBy(breakBy: any, series: Serie, dataSet: Map<string, any>, seriesData) {
    breakBy.buckets.forEach(bucket => {
      let seriesName;
      seriesName = this.getKeyAggregationName(bucket);
      if (seriesName === 'DummyBreakBy') {
        seriesName = series.Name;
      }
      if (series.Label) {
        seriesName = this.buildDataSetKeyString(seriesName, series.Label);
      }
      if (seriesData.Series.indexOf(seriesName) == -1) {
        seriesData.Series.push(seriesName);
      }
      this.handleAggregatedFields(seriesName, bucket, series.AggregatedFields, dataSet);

    });
  }

  private handleAggregatedFields(seriesName, seriesAggregation, aggregatedFields, dataSet: Map<string, any>) {
    aggregatedFields.forEach((aggregatedField) => {

      const keyString = this.buildAggragationFieldString(aggregatedField);
      let val;
      if (seriesAggregation[keyString]?.value) {
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