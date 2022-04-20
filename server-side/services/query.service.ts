import { PapiClient, InstalledAddon } from '@pepperi-addons/papi-sdk'
import { Client, Request } from '@pepperi-addons/debug-server';
import { v4 as uuid } from 'uuid';
import config from '../../addon.config.json'
import { DATA_QUREIES_TABLE_NAME, Interval, Intervals, Serie, SERIES_LABEL_DEFAULT_VALUE, UserTypes } from '../models/data-query';
import { validate } from 'jsonschema';
import { QueriesScheme } from '../models/queries-scheme';
import jwtDecode from 'jwt-decode';

class QueryService {

    papiClient: PapiClient

    constructor(private client: Client) {
        this.papiClient = new PapiClient({
            baseURL: client.BaseURL,
            token: client.OAuthAccessToken,
            addonUUID: client.AddonUUID,
            addonSecretKey: client.AddonSecretKey
        });
    }

    async upsert(client: Client, request: Request) {
        
        const userType = (<any>jwtDecode(client.OAuthAccessToken))["pepperi.employeetype"];
        // Hack until Addons permission will be developed
        if (userType !== 1) {
            throw new Error('Authorization request denied.');
        }

        const adal = this.papiClient.addons.data.uuid(config.AddonUUID).table(DATA_QUREIES_TABLE_NAME);
        const body = request.body;

        const validation = validate(body, QueriesScheme, { allowUnknownAttributes: false, });

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

        const query = await adal.upsert(body);
        return query;
    }

    generateSeriesKey(series: any) {
        series.forEach(serie => {
            if (!serie.Key) {
                serie.Key = uuid();
            }
        });
    }

    checkSeriesLabels(series: Serie[]) {
        series.forEach(serie => {
            if (!serie.Label) {
                serie.Label = SERIES_LABEL_DEFAULT_VALUE;
            }
        });
    }

    async find(query: any) {

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

    hasDuplicates(series) {
        const uniqueValues = new Set(series?.map(s => s.Key));

        if (uniqueValues.size < series.length) {
            throw new Error('Series Key must be unique');
        }
    }

    //DIMX
    // for the AddonRelativeURL of the relation
    async importDataSource(body) {
        console.log("importing data")
        return body;
    }

    async exportDataSource(body) {
        console.log("exporting data")
        return body;
     }

}

export default QueryService;

