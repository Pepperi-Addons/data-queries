import { Client, Request } from "@pepperi-addons/debug-server/dist";
import ElasticService from "./services/elastic.service";

// [Endpoint='elastic/execute?query_id={queryID}']
export async function execute(client: Client, request: Request) {
    throw new Error(`Permission denied. Please contact support for more information. `);       

    // const service = new ElasticService(client);
    // if (request.method == 'POST') {
    //     // VariableValues is the only field allowed to be sent by all users.
    //     request.body = {"VariableValues": request.body?.VariableValues};
    //     return await service.executeUserDefinedQuery(client, request);
    // }
    // else{
    //     throw new Error('Bad request');
    // }
};

export async function execute_debug(client: Client, request: Request) {
    throw new Error(`Permission denied. Please contact support for more information. `);       

    // const service = new ElasticService(client);
    // if (request.method == 'POST') {
    //     await client.ValidatePermission('CALL_EXECUTE');
    //     return await service.executeUserDefinedQuery(client, request);
    // }
    // else{
    //     throw new Error('Bad request');
    // }

};

