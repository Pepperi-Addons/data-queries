import { PapiClient } from '@pepperi-addons/papi-sdk';
import { Client } from '@pepperi-addons/debug-server';
import { DataQuery, DATA_QUREIES_TABLE_NAME } from '../models/data-query';

export class UtilitiesService {
    
    papiClient: PapiClient

    constructor(private client: Client) {
        this.papiClient = new PapiClient({
            baseURL: client.BaseURL,
            token: client.OAuthAccessToken,
            addonUUID: client.AddonUUID,
            addonSecretKey: client.AddonSecretKey,
            actionUUID: client.AddonUUID
        });
    }

    async createRelations(relations) {
        await Promise.all(relations.map(async (singleRelation) => {
            await this.papiClient.addons.data.relations.upsert(singleRelation);
        }));
    }

    async createADALSchemes() {
        return await this.papiClient.addons.data.schemes.post({
            Name: DATA_QUREIES_TABLE_NAME,
            Type: 'data',
            Fields: {
                Name: {Type: 'String'},
                Resource: {Type: 'String'} // ask shir if its ok
            }
        });
    }
}

