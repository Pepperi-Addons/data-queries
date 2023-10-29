import jwt from 'jwt-decode';
import { AddonData, Collection, FindOptions, PapiClient } from '@pepperi-addons/papi-sdk';
import { Injectable } from '@angular/core';

import { PepHttpService, PepSessionService } from '@pepperi-addons/ngx-lib';

export type FormMode = 'Add' | 'Edit';
export const EMPTY_OBJECT_NAME = 'NewCollection';
@Injectable({ providedIn: 'root' })
export class UtilitiesService {
    
    accessToken = '';
    parsedToken: any
    papiBaseURL = ''
    addonUUID;

    get papiClient(): PapiClient {
        return new PapiClient({
            baseURL: this.papiBaseURL,
            token: this.session.getIdpToken(),
            addonUUID: this.addonUUID,
            suppressLogging:true
        })
    }

    constructor(
        public session:  PepSessionService,
        private pepHttp: PepHttpService
    ) {
        const accessToken = this.session.getIdpToken();
        this.parsedToken = jwt(accessToken);
        this.papiBaseURL = this.parsedToken["pepperi.baseurl"];
    }

    getErrors(message:string): string[] {
        const start = message.indexOf('exception:') + 10;
        const end = message.indexOf('","detail');
        const errors = message.substring(start, end).split("\\n");
        return errors;
    }

    async getRecycledQueries(){
        let options: any = {
            where: ''
        };
        options.include_deleted = true;
        options.where ='Hidden = true';
        return await this.papiClient.addons.data.uuid(this.addonUUID).table('DataQueries').find(options);
    }

    async getQueriesByName(searchString){
        let options: any = {
            where: ''
        };
        options.where =`Name LIKE '%${searchString}%'`;
        return await this.papiClient.addons.data.uuid(this.addonUUID).table('DataQueries').find(options);

    }

	// expects an array of objects with a Name property
	caseInsensitiveSortByName(objects: any[]): any[] {
		return objects.sort(function(a, b) {
			const nameA = a.Name.toUpperCase(); // ignore upper and lowercase
			const nameB = b.Name.toUpperCase(); // ignore upper and lowercase
			if (nameA < nameB) {
			  return -1;
			}
			if (nameA > nameB) {
			  return 1;
			}
			// names must be equal
			return 0;
		});
	}
        
}
