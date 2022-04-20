import { Client, Request } from '@pepperi-addons/debug-server'
import QueryService from './services/query.service'
import ClientService from './services/client.service';

export async function queries(client: Client, request: Request) {
    const service = new QueryService(client)
    if (request.method == 'POST') {
        return await service.upsert(client, request);
    }
    else if (request.method == 'GET') {
        return await service.find(request.query);
    }
}

export function import_data_source(client: Client, request: Request) {
    const service = new QueryService(client)
    if (request.method == 'POST') {
        return service.importDataSource(request.body);
    }
    else if (request.method == 'GET') {
        throw new Error(`Method ${request.method} not supported`);       
    }
}

export function export_data_source(client: Client, request: Request) {
    const service = new QueryService(client)
    if (request.method == 'POST') {
        return service.exportDataSource(request.body);
    }
    else if (request.method == 'GET') {
        throw new Error(`Method ${request.method} not supported`);       
    }
}



