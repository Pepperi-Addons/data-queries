
/*
The return object format MUST contain the field 'success':
{success:true}

If the result of your code is 'false' then return:
{success:false, erroeMessage:{the reason why it is false}}
The error Message is importent! it will be written in the audit log and help the user to understand what happen
*/

import { Client, Request } from '@pepperi-addons/debug-server'
import { Relation } from '@pepperi-addons/papi-sdk'
import MyService from './my.service';
import { DATA_QUREIES_TABLE_NAME, queriesTableScheme } from './models';
import { UtilitiesService } from './services/utilities.service';


export async function install(client: Client, request: Request): Promise<any> {
    // For page block template uncomment this.
    // const res = await createPageBlockRelation(client);
    // return res;
    try {
        const service = new UtilitiesService(client);
        await service.papiClient.addons.data.schemes.post(queriesTableScheme);
        await service.createDIMXRelations();
        return {success:true, resultObject:{}}
    }
    catch (err) {
        return { 
            success: false, 
            resultObject: err ,
            errorMessage: `Error in creating necessary objects . error - ${err}`
        };
    }
}

export async function uninstall(client: Client, request: Request): Promise<any> {
    try{
        const service = new UtilitiesService(client)
        await service.papiClient.post(`/addons/data/schemes/${DATA_QUREIES_TABLE_NAME}/purge`);
        return { success: true, resultObject: {} }
    }
    catch(err){
        console.log('Failed to uninstall data-queries addon', err)
        return handleException(err);

    }
}

export async function upgrade(client: Client, request: Request): Promise<any> {
    return {success:true,resultObject:{}}
}

export async function downgrade(client: Client, request: Request): Promise<any> {
    return {success:true,resultObject:{}}
}


async function createPageBlockRelation(client: Client): Promise<any> {
    try {
        // TODO: change to block name (this is the unique relation name and the description that will be on the page builder editor in Blocks section).
        const blockName = 'BLOCK_NAME_TO_CHANGE';

        // TODO: Change to fileName that declared in webpack.config.js
        const filename = 'block_file_name';

        const pageComponentRelation: Relation = {
            RelationName: "PageBlock",
            Name: blockName,
            Description: `${blockName} block`,
            Type: "NgComponent",
            SubType: "NG11",
            AddonUUID: client.AddonUUID,
            AddonRelativeURL: filename,
            ComponentName: `BlockComponent`, // This is should be the block component name (from the client-side)
            ModuleName: `BlockModule`, // This is should be the block module name (from the client-side)
            EditorComponentName: `BlockEditorComponent`, // This is should be the block editor component name (from the client-side)
            EditorModuleName: `BlockEditorModule` // This is should be the block editor module name (from the client-side)
        };

        const service = new MyService(client);
        const result = await service.upsertRelation(pageComponentRelation);
        return { success:true, resultObject: result };
    } catch(err) {
        return { success: false, resultObject: err , errorMessage: `Error in upsert relation. error - ${err}`};
    }
}

function handleException(err: unknown): any {
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
