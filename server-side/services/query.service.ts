import { PapiClient, AddonData } from '@pepperi-addons/papi-sdk'
import { Client, Request } from '@pepperi-addons/debug-server';
import { v4 as uuid } from 'uuid';
import config from '../../addon.config.json'
import { DATA_QUREIES_TABLE_NAME, Serie, SERIES_LABEL_DEFAULT_VALUE } from '../models/data-query';
import { Schema, validate, Validator } from 'jsonschema';
import { QueriesScheme } from '../models/queries-scheme';
import jwtDecode from 'jwt-decode';
import { VarSettingsService } from './varSettings.service';

class QueryService {

    private papiClient: PapiClient
	private varSettingsService: VarSettingsService;

    constructor(private client: Client) {
        this.papiClient = new PapiClient({
            baseURL: client.BaseURL,
            token: client.OAuthAccessToken,
            addonUUID: client.AddonUUID,
            addonSecretKey: client.AddonSecretKey
        });
		this.varSettingsService = new VarSettingsService(client);
    }

    async upsert(client: Client, request: Request): Promise<AddonData> {

        const userType = (<any>jwtDecode(client.OAuthAccessToken))["pepperi.employeetype"];
        // Hack until Addons permission will be developed
        if (userType !== 1) {
            throw new Error('Authorization request denied.');
        }

        const adal = this.papiClient.addons.data.uuid(config.AddonUUID).table(DATA_QUREIES_TABLE_NAME);
        const body = request.body;
        delete body.ExpirationDateTime;

        const validation = validate(body, QueriesScheme, { allowUnknownAttributes: false });

        if (!validation.valid) {
            throw new Error(validation.toString());
        }

        if (body.Series?.length > 0) {

            this.hasDuplicates(body.Series);
            this.checkSeriesLabels(body.Series);
            this.generateSeriesKey(body.Series);
        }

        if (!body.Key) {
            body.Key = uuid();
        }

		// set the VarSettings on the query
		body.VarSettings = await this.varSettingsService.getVarSettings();

        const query = await adal.upsert(body);
        return query;
    }

    generateSeriesKey(series: Serie[]): void {
        series.forEach(serie => {
            if (!serie.Key) {
                serie.Key = uuid();
            }
        });
    }

    checkSeriesLabels(series: Serie[]): void {
        series.forEach(serie => {
            if (!serie.Label) {
                serie.Label = SERIES_LABEL_DEFAULT_VALUE;
            }
        });
    }

    async find(query: any): Promise<AddonData> {

        const adal = this.papiClient.addons.data.uuid(config.AddonUUID).table(DATA_QUREIES_TABLE_NAME);

        if (query.key) {
            const chart = await adal.key(query.key).get();
            return chart;
        }
        else {
            const charts = await adal.find(query);
            return charts;
        }
    }

    hasDuplicates(series: Serie[]): void {
        const uniqueValues = new Set(series?.map(s => s.Key));

        if (uniqueValues.size < series.length) {
            throw new Error('Series Key must be unique');
        }
    }

    //DIMX
    // for the AddonRelativeURL of the relation
    async importDataSource(body: any): Promise<any> {
        console.log(`@@@@importing query: ${JSON.stringify(body)}@@@@`);
        body.DIMXObjects = await Promise.all(body.DIMXObjects.map(async (item) => {
            const validator = new Validator();
            const validSchema: Schema = this.getValidSchema();
            const validationResult = validator.validate(item.Object, validSchema);
            if (!validationResult.valid) {
                const errors = validationResult.errors.map(error => error.stack.replace("instance.", ""));
                item.Status = 'Error';
                item.Details = `query validation failed.\n ${errors.join("\n")}`;
            }
            return item;
        }));
		body.DIMXObjects = await this.setVarSettingsOnImportedQueries(body.DIMXObjects);
        console.log('returned object is:', JSON.stringify(body));
        return body;
    }

	getValidSchema(): Schema {
		return {
			properties: {
				Key: {
					type: "string",
					required: true
				},
				Name: {
					type: "string",
					required: true
				},
				Resource: {
					type: "string",
					required: true
				},
				Series: {
					type: "array"
				},
				Variables: {
					type: "array"
				}
			}
		}
	}

	async setVarSettingsOnImportedQueries(DIMXObjects: any[]): Promise<any[]> {
		const varSettingsService = new VarSettingsService(this.client);
		const varSettings = await varSettingsService.getVarSettings();

		// iterate over all queries to update the settings values saved on the queries
		return DIMXObjects.map(DIMXObject => {
			DIMXObject.Object.VarSettings = varSettings;
			return DIMXObject;
		});
	}

    async exportDataSource(body: any): Promise<any> {
        console.log("exporting data")
        return body;
    }

}

export default QueryService;

