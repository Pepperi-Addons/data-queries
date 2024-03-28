
/*
The return object format MUST contain the field 'success':
{success:true}

If the result of your code is 'false' then return:
{success:false, erroeMessage:{the reason why it is false}}
The error Message is importent! it will be written in the audit log and help the user to understand what happen
*/

import { Client, Request } from '@pepperi-addons/debug-server'
import { Relation } from '@pepperi-addons/papi-sdk'
import { DATA_QUREIES_TABLE_NAME, queriesTableScheme } from './models';
import { UtilitiesService } from './services/utilities.service';
import semver from 'semver';
import { PnsService } from './services/pns.service';
import { varSettingsRelation } from './metadata/varSettingsData';
import { VarSettingsService } from './services/varSettings.service';

export async function install(client: Client, request: Request): Promise<any> {
    // For page block template uncomment this.
    // const res = await createPageBlockRelation(client);
    // return res;
    try {
        const service = new UtilitiesService(client);
		const pnsService = new PnsService(client);
        await service.papiClient.addons.data.schemes.post(queriesTableScheme);
        await service.createDIMXRelations();
        await create_page_block_relation(client);
        await create_policy_and_profile(service, client.AddonUUID);
		await pnsService.subscribeToRelationsUpdate();
		await create_var_settings(client);
        return {success: true, resultObject: {}}
    }
    catch (err) {
        return {
            success: false,
            resultObject: err,
            errorMessage: `Error in creating necessary objects . error - ${err}`
        };
    }
}

export async function uninstall(client: Client, request: Request): Promise<any> {
    try {
        const service = new UtilitiesService(client);
        await service.papiClient.post(`/addons/data/schemes/${DATA_QUREIES_TABLE_NAME}/purge`);
        return { success: true, resultObject: {} }
    }
    catch (err){
        console.log('Failed to uninstall data-queries addon', err)
        return handle_exception(err);

    }
}

export async function upgrade(client: Client, request: Request): Promise<any> {
    try {
        const service = new UtilitiesService(client);
        await create_page_block_relation(client);
        if (request.body.FromVersion && semver.compare(request.body.FromVersion, '1.0.0') < 0)
        {
            await create_policy_and_profile(service, client.AddonUUID);
        }

		if (request.body.FromVersion && semver.compare(request.body.FromVersion, '1.2.28') < 0)
        {
            await service.setResourceDataOnAllQueries();
			const pnsService = new PnsService(client);
			await pnsService.subscribeToRelationsUpdate();
        }

		if (request.body.FromVersion && semver.compare(request.body.FromVersion, '1.4.20') < 0)
        {
			await create_var_settings(client);
        }

        return {success: true, resultObject: {}}
    }
    catch (err){
        console.log('Failed to upgrade data-queries addon', err)
        return handle_exception(err);

    }
}

export async function downgrade(client: Client, request: Request): Promise<any> {
    return {success: true, resultObject: {}}
}

async function create_page_block_relation(client: Client): Promise<any> {
    try {
        const settingsName = 'Settings';

        const settingsBlockRelation: Relation = {
            RelationName: "SettingsBlock",
            GroupName: 'Configuration',
            SlugName: 'query_manager',
            Name: 'QueryManager',
            Description: 'Page Builder (Beta)',
            Type: "NgComponent",
            SubType: "NG14",
            AddonUUID: client.AddonUUID,
            AddonRelativeURL: `file_${client.AddonUUID}`,
            ComponentName: `${settingsName}Component`,
            ModuleName: `${settingsName}Module`,
            ElementsModule: 'WebComponents',
            ElementName: `settings-element-${client.AddonUUID}`,
        };

        const service = new UtilitiesService(client);
        const result = await service.upsertRelation(settingsBlockRelation);
        return { success: true, resultObject: result };
    } catch (err) {
        return { success: false, resultObject: err, errorMessage: `Error in upsert relation. error - ${err}`};
    }
}

function handle_exception(err: unknown): any {
    let errorMessage = 'Unknown Error Occured';
    if (err instanceof Error) {
        errorMessage = err.message;
    }
    return {
        success: false,
        errorMessage: errorMessage,
        resultObject: {}
    };
}

async function create_policy_and_profile(service, addonUUID): Promise<void> {
    await service.papiClient.post('/policies', {
        AddonUUID: addonUUID,
        Name: "CALL_EXECUTE",
        Description: "permission to call execute endpoint"
    });
    await service.papiClient.post('/policy_profiles', {
        PolicyAddonUUID: addonUUID,
        PolicyName: "CALL_EXECUTE",
        ProfileID: "1",
        Allowed: true
    });
}

async function create_var_settings(client: Client): Promise<void> {
	const varSettingsService = new VarSettingsService(client);
	await varSettingsService.upsertVarSettingsRelation();
	await varSettingsService.setDefaultVarSettings();
}


