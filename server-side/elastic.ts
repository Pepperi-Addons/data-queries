import { Client, Request } from "@pepperi-addons/debug-server/dist";
import ElasticService from "./services/elastic.service";
import { DataQueryResponse } from "./models/data-query-response";

// [Endpoint='elastic/execute?query_id={queryID}']
export async function execute(client: Client, request: Request): Promise<DataQueryResponse> {
    const service = new ElasticService(client);
    if (request.method === 'POST') {
        // VariableValues and TimeZoneOffset is the only fields allowed to be sent by all users.
        request.body = {
			VariableValues: request.body?.VariableValues,
			TimeZoneOffset: request.body?.TimeZoneOffset
		};
        return await service.executeUserDefinedQuery(request);
    }
    else {
        throw new Error('Bad request');
    }
}

export async function execute_debug(client: Client, request: Request): Promise<DataQueryResponse> {
    const service = new ElasticService(client);
    if (request.method === 'POST') {
        await client.ValidatePermission('CALL_EXECUTE');
        return await service.executeUserDefinedQuery(request);
    }
    else {
        throw new Error('Bad request');
    }

}

export async function execute_bulk(client: Client, request: Request): Promise<DataQueryResponse[]> {
    const service = new ElasticService(client);
    if (request.method === 'POST') {
        return await service.executeMultipleQueries(request.body);
    }
    else {
        throw new Error('Bad request');
    }

}
