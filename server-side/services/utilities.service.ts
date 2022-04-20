import { PapiClient } from '@pepperi-addons/papi-sdk';
import { Client } from '@pepperi-addons/debug-server';
import { DimxRelations } from '../models/metadata';

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

    async createDIMXRelations() {
        await Promise.all(DimxRelations.map(async (singleRelation) => {
            singleRelation.Name = 'DataQueries';
            await this.papiClient.addons.data.relations.upsert(singleRelation);
        }));
    }
}

