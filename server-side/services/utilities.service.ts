import { PapiClient, Relation } from '@pepperi-addons/papi-sdk';
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

    async createDIMXRelations(): Promise<void> {
        await Promise.all(DimxRelations.map(async (singleRelation) => {
            singleRelation.Name = 'DataQueries';
            await this.papiClient.addons.data.relations.upsert(singleRelation);
        }));
    }

	async setResourceDataOnAllQueries(): Promise<any[]> {
		const resourceToDataDict: { [name: string] : Relation } = {};

		const queries: any[] = await this.papiClient.get('/data_queries?fields=Key,Resource&page_size=-1');
		const resourcesToGet: Set<string> = new Set<string>(queries.map(query => query.Resource));
		const resourcesString: string = Array.from(resourcesToGet).join(',');
		const resourceRelationData: Relation[] = (await this.papiClient.addons.data.relations.find({
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

	async fixQueryRelation(query: any): Promise<boolean> {
		const relationSavedOnQuery: Relation = query.ResourceData;
		const actualRelation: Relation = await this.papiClient.get(`/addons/data/relations?key=${relationSavedOnQuery.Key}`);

		if(this.relationsAreEqual(relationSavedOnQuery, actualRelation))
		{
			console.log(`Relation saved on ${query.Key} query is up to date`);
			return true;
		}
		else
		{
			console.log(`Relation saved on ${query.Key} query is dirty, updating...`);
			query.ResourceData = actualRelation;
			await this.papiClient.post(`/data_queries`, query);
			return false;
		}
	}

	relationsAreEqual(relation1: any, relation2: any): boolean {
		let equal = true;

		if(Object.keys(relation1).length !== Object.keys(relation2).length) {
			equal = false;
		}

		Object.keys(relation1).forEach(key => {
			if(relation1[key] !== relation2[key]) {
				equal = false;
			}
		});

		return equal;
	}
}

