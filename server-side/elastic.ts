import { Client, Request } from "@pepperi-addons/debug-server/dist";
import ElasticService from "./services/elastic.service";

// [Endpoint='elastic/execute?query_id={queryID}']
export async function execute(client: Client, request: Request) {
    const service = new ElasticService(client);
    if (request.method == 'POST') {
        return await service.executeUserDefinedQuery(client, request);
    }
    else{
        throw new Error('Bad request');
    }

};

