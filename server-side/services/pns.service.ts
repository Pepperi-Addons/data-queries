import { PapiClient } from '@pepperi-addons/papi-sdk';
import { Client } from '@pepperi-addons/debug-server';
import config from '../../addon.config.json';

export class PnsService {
    
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

    async subscribeToRelationsUpdate() {
		const relationsAddonUUID = "5ac7d8c3-0249-4805-8ce9-af4aecd77794";
        await this.papiClient.notification.subscriptions.upsert({
            AddonUUID: config.AddonUUID,
            AddonRelativeURL: "/api/update_relations_on_queries",
            Type: "data",
            Name: "relationsUpdated",
            FilterPolicy: {
                Action:['update'],
                Resource:['relations'],
                AddonUUID:[relationsAddonUUID]
            }
        })
	}

	async updateRelationsOnQueries(messageFromPNS: any) {
		const relationsKeys = messageFromPNS.Message.ModifiedObjects.map(obj => obj.ObjectKey);
		const relevantRelationsKeys = relationsKeys.filter(key => key.includes('DataQueries'));
		const relevantRelationsNames = relevantRelationsKeys.map(key => this.extractResourceNameFromKey(key));
		const queriesToUpdate = await this.papiClient.get(`/data_queries?where=Resource in (${relevantRelationsNames.join(',')})&fields=Key,ResourceData`);
		const promises = await Promise.all(queriesToUpdate.map(query => this.fixQueryRelation(query)));

		console.log(`Done updating ${promises.length} queries. fixQueryRelation returned: ${JSON.stringify(promises)}`);
	}

	extractResourceNameFromKey(key: string): string {
		// In our case the key format is: <resource_name>_<addon_uuid>_DataQueries
		let keyParts = key.split('_');
		keyParts.pop(); // remove the relation name (DataQueries)
		keyParts.pop(); // remove the addon uuid
		return keyParts.join('_');
	}

	async fixQueryRelation(query: any): Promise<boolean> {
		const relationSavedOnQuery = query.ResourceData;
		const updatedRelation = await this.papiClient.get(`/addons/data/relations?key=${relationSavedOnQuery.Key}`);

		console.log(`Updating resource relation data on query: ${query.Key}`);
		query.ResourceData = updatedRelation;
		await this.papiClient.post(`/data_queries`, query);
		return true;

	}
}

