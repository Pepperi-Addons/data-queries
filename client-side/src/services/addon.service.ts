import jwt from 'jwt-decode';
import { PapiClient } from '@pepperi-addons/papi-sdk';
import { Injectable } from '@angular/core';
import { PepDataConvertorService, PepHttpService, PepSessionService } from '@pepperi-addons/ngx-lib';


@Injectable()
export class AddonService {

    accessToken = '';
    parsedToken: any
    papiBaseURL = ''
    addonUUID;
    queries: [] = [];
    get papiClient(): PapiClient {
        return new PapiClient({
            baseURL: this.papiBaseURL,
            token: this.session.getIdpToken(),
            addonUUID: this.addonUUID,
            suppressLogging: true
        })
    }

    constructor(
        public session: PepSessionService,
        public pepperiDataConverter: PepDataConvertorService,
        private pepHttp: PepHttpService) {
            const accessToken = this.session.getIdpToken();
            this.parsedToken = jwt(accessToken);
            this.papiBaseURL = this.parsedToken["pepperi.baseurl"]
    }
    ngOnInit() {
    }

    async get(endpoint: string): Promise<any> {
        return await this.papiClient.get(endpoint);
    }

    async post(endpoint: string, body: any): Promise<any> {
        return await this.papiClient.post(endpoint, body);
    }

    async executeQuery(queryID, body = {}) {
        //return this.papiClient.post(`/data_queries/${queryID}/execute`, null);
        return this.papiClient.addons.api.uuid(this.addonUUID).file('elastic').func('execute').post({key: queryID},body)
    }

    async executeQueryForAdmin(queryID, body = {}) {
        //return this.papiClient.post(`/data_queries/${queryID}/su_execute`, null);
        return this.papiClient.addons.api.uuid(this.addonUUID).file('elastic').func('su_execute').post({key: queryID},body)
    }

    async getDataQueryByKey(Key: string) {
        //return this.papiClient.get(`/data_queries?where=Key='${Key}'`);
        return this.papiClient.addons.api.uuid(this.addonUUID).file('api').func('queries').get({where: `Key='${Key}'`})
    }

    async getAllQueries(){
        //return this.papiClient.get(`/data_queries`);
        return this.papiClient.addons.api.uuid(this.addonUUID).file('api').func('queries').get()
    }

    async upsertDataQuery(body) {
        //return this.papiClient.post(`/data_queries`,body)
        return this.papiClient.addons.api.uuid(this.addonUUID).file('api').func('queries').post({},body);
    }

    async getCharts() {
        return this.papiClient.get(`/charts`);
    }

    async getResourceTypesFromRelation() {
        return this.papiClient.addons.data.relations.find({where: 'RelationName=DataQueries'});
    }

    async getResourceDataByName(resource) {
        return this.papiClient.addons.data.relations.find({where: `RelationName=DataQueries and Name=${resource}`});
    }

    removecsSuffix(str) {
        return (str.slice(-3)==".cs") ? str.slice(0,-3) : str;
    }

    async getSchemaByNameAndUUID(schemaName, uuid) {
        const originalUUID = this.addonUUID;
        // assignment of this.addonUUID allows us to get the schemes of another addon
        this.addonUUID = uuid; // uuid from relation data
        const schemeObject = await this.papiClient.addons.data.schemes.name(schemaName).get();
        this.addonUUID = originalUUID;
        return schemeObject;
    }

    async getDataIndexFields(resourceRelationData) {
        // if there's no SchemaRelativeURL, get the schema using addon uuid and schema name from the relation data
        let schema = resourceRelationData["SchemaRelativeURL"] ? await this.get(resourceRelationData["SchemaRelativeURL"]) : 
                     await this.getSchemaByNameAndUUID(resourceRelationData.Name, resourceRelationData.AddonUUID);
        let fields = [];
        for(const fieldID in schema.Fields) {
          this.pushFieldWithAllReferencedFields(fieldID, schema.Fields[fieldID], fields)
        }
        fields = fields.sort((obj1, obj2) => (obj1.FieldID > obj2.FieldID ? 1 : -1));
        return fields;
    }

    pushFieldWithAllReferencedFields(fieldID, fieldData, fields) {
        if(fieldData.Type == 'Resource' && fieldData.Indexed == true) {
          fields.push({
            FieldID: `${fieldID}.Key`,
            Type: "String",
            OptionalValues: fieldData.OptionalValues
          });
          if(fieldData.IndexedFields) {
            for (let referencedFieldID in fieldData.IndexedFields) {
              this.pushFieldWithAllReferencedFields(`${fieldID}.${referencedFieldID}`, fieldData.IndexedFields[referencedFieldID], fields);
            }
          }
        } else {
          fields.push({
            FieldID: fieldID,
            Type: fieldData.Type,
            OptionalValues: fieldData.OptionalValues
          });
        }
    }
}