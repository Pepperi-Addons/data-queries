import { AddonData, DIMXObject, PapiClient } from '@pepperi-addons/papi-sdk';
import { Client } from '@pepperi-addons/debug-server';
import config from '../../addon.config.json'
import { DATA_QUREIES_TABLE_NAME, DataQuery } from '../models';
import { VarSettingsObject, varSettingsRelation } from '../metadata/varSettingsData';
import { UtilitiesService } from './utilities.service';
import QueryService from './query.service';

export class VarSettingsService {

    private papiClient: PapiClient
	private utilitiesService: UtilitiesService;
	private queryService: QueryService;

    constructor(client: Client) {
        this.papiClient = new PapiClient({
            baseURL: client.BaseURL,
            token: client.OAuthAccessToken,
            addonUUID: client.AddonUUID,
            addonSecretKey: client.AddonSecretKey,
            actionUUID: client.ActionUUID
        });

		this.utilitiesService = new UtilitiesService(client);
		this.queryService = new QueryService(client);
    }

	async upsertVarSettings(varSettings: VarSettingsObject): Promise<DIMXObject[]> {
		await this.setKmsParameter('License', varSettings.License);
		await this.setKmsParameter('DaysLimit', varSettings.DaysLimit);
		await this.setKmsParameter('TrialEndDate', varSettings.TrialEndDate);

		// iterate over all queries to update the settings values saved on the queries
		const queries: DataQuery[] = (await this.queryService.find({fields: 'Key', page_size: -1})) as DataQuery[];
		queries.forEach(query => {
			query.VarSettings = varSettings;
		});

		return await this.papiClient.post(`/addons/data/batch/${config.AddonUUID}/${DATA_QUREIES_TABLE_NAME}`, {Objects: queries});

	}

	async getVarSettings(): Promise<VarSettingsObject> {
		const license = await this.getKmsParameter('License');
		const daysLimit = await this.getKmsParameter('DaysLimit');
		const trialEndDate = await this.getKmsParameter('TrialEndDate');

		return {
			License: license.Value,
			DaysLimit: daysLimit.Value,
			TrialEndDate: trialEndDate.Value
		};
	}

	async setDefaultVarSettings(): Promise<void> {
		await this.upsertVarSettings({
			License: 'Free version',
			DaysLimit: '90',
			TrialEndDate: new Date().toISOString()
		});
	}

	async setKmsParameter(key: string, value: string): Promise<void> {
		// TODO: use kms api when it's ready
		await this.papiClient.post(`/addons/api/8b4a1bd8-a2eb-4241-85ac-89c9e724e900/api/addon_data?addon_uuid=${config.AddonUUID}&key=${key}`, {
			Value: value
		});
	}

	async getKmsParameter(key: string): Promise<AddonData> {
		// TODO: use kms api when it's ready
		return await this.papiClient.get(`/addons/api/8b4a1bd8-a2eb-4241-85ac-89c9e724e900/api/addon_data?addon_uuid=${config.AddonUUID}&key=${key}`);
	}

	async upsertVarSettingsRelation(): Promise<void> {
		await this.utilitiesService.upsertRelation(varSettingsRelation);
	}
}
