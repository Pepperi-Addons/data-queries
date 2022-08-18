import config from '../../addon.config.json';
import { AddonDataScheme, Relation } from "@pepperi-addons/papi-sdk";

export const DimxRelations: Relation[] = [{
    AddonUUID: config.AddonUUID,
    Name: 'DataQueries',
    RelationName: 'DataImportResource',
    Type: 'AddonAPI',
    Description: 'relation for importing queries to query manager',
    AddonRelativeURL: '/api/import_data_source'
},
{
    AddonUUID: config.AddonUUID,
    Name: 'DataQueries',
    RelationName: 'DataExportResource',
    Type: 'AddonAPI',
    Description: 'relation for exporting queries from query manager',
    AddonRelativeURL: '/api/export_data_source'
}]

