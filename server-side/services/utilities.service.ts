import { PapiClient } from '@pepperi-addons/papi-sdk';
import { Client } from '@pepperi-addons/debug-server';
import { DimxRelations } from '../models/metadata';
import { DATA_QUREIES_TABLE_NAME } from '../models';

export class UtilitiesService {
    
    papiClient: PapiClient

    constructor(private client: Client) {
        this.papiClient = new PapiClient({
            baseURL: client.BaseURL,
            token: client.OAuthAccessToken,
            addonUUID: client.AddonUUID,
            addonSecretKey: client.AddonSecretKey,
            actionUUID: client.ActionUUID
        });
    }

    async createDIMXRelations() {
        await Promise.all(DimxRelations.map(async (singleRelation) => {
            singleRelation.Name = 'DataQueries';
            await this.papiClient.addons.data.relations.upsert(singleRelation);
        }));
    }

	async setResourceDataOnAllQueries() {
		const resourceToDataDict = {};

		const queries = await this.papiClient.get('/data_queries?fields=Key,Resource&page_size=-1');
		const resourcesToGet = new Set<string>(queries.map(query => query.Resource));
		const resourcesString = Array.from(resourcesToGet).join(',');
		const resourceRelationData = (await this.papiClient.addons.data.relations.find({
			where: `RelationName='DataQueries' AND Name in (${resourcesString})`
		}));

		resourceRelationData.forEach(resourceData => {
			resourceToDataDict[resourceData.Name] = resourceData;
		});

		queries.forEach(query => {
			query.ResourceData = resourceToDataDict[query.Resource];
		});

		return await this.papiClient.post(`/addons/data/batch/${this.client.AddonUUID}/${DATA_QUREIES_TABLE_NAME}`, {Objects: queries});
	}
}

