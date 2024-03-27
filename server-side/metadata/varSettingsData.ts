import { Relation } from "@pepperi-addons/papi-sdk";
import config from '../../addon.config.json'

const dataview = {
	Type: 'Form',
	Hidden: false,
	Columns: [{}],
	Context: {
		Object: {
			Resource: "transactions",
			InternalID: 0,
			Name: "Object Name",
		},
		Name: "Context Name",
		ScreenSize: "Tablet",
		Profile: {
			InternalID: 0,
			Name: "Profile Name",
		},
	},
	Fields: [
		{
			FieldID: "License",
			Type: "ComboBox",
			Title: "License",
			Mandatory: false,
			ReadOnly: false,
			Layout: {
				Origin: {
					X: 0,
					Y: 0,
				},
				Size: {
					Width: 2,
					Height: 0,
				}
			},
			Style: {
				Alignment: {
					Horizontal: "Stretch",
					Vertical: "Stretch",
				}
			},
			OptionalValues: [{Key: 'Free version', Value: 'Free version'}, {Key: 'Full version', Value: 'Full version'}],
			AdditionalProps: {
				emptyOption: false
			}
		},
		{
			FieldID: "DaysLimit",
			Type: "TextBox",
			Title: "Data is limited to the following number of days (valid only for the free version)",
			Mandatory: false,
			ReadOnly: false,
			Layout: {
				Origin: {
					X: 1,
					Y: 0,
				},
				Size: {
					Width: 2,
					Height: 0,
				}
			},
			Style: {
				Alignment: {
					Horizontal: "Stretch",
					Vertical: "Stretch",
				}
			}
		},
		{
			FieldID: "TrialEndDate",
			Type: "DateAndTime",
			Title: "Temporary allow full version (for trial) until (valid only for the free version)",
			Mandatory: false,
			ReadOnly: false,
			Layout: {
				Origin: {
					X: 2,
					Y: 0,
				},
				Size: {
					Width: 2,
					Height: 0,
				}
			},
			Style: {
				Alignment: {
					Horizontal: "Stretch",
					Vertical: "Stretch",
				}
			}
		},
		{
			FieldID: "MaxQueries",
			Type: "TextBox",
			Title: "Maximum queries allowed",
			Mandatory: false,
			ReadOnly: false,
			Layout: {
				Origin: {
					X: 3,
					Y: 0,
				},
				Size: {
					Width: 2,
					Height: 0,
				}
			},
			Style: {
				Alignment: {
					Horizontal: "Stretch",
					Vertical: "Stretch",
				}
			}
		}
	],
	Rows: []
};


// eslint-disable-next-line no-shadow
export enum licenseOptions {
	Free = 'Free version',
	Full = 'Full version'
}

export const varSettingsRelation: Relation = {
	RelationName: "VarSettings",
	AddonUUID: config.AddonUUID,
	Name: "InsightsVarSettings",
	Description: "Insights Var Settings",
	Type: "AddonAPI",
	AddonRelativeURL: "/api/insights_var_settings", // The endpoint to which VarSettings will call to GET the current values, and to POST new ones.
	Title: "Insights", //The title of the tab in which the fields will appear
	DataView: dataview
}

export interface VarSettingsObject {
    License: string;
    DaysLimit: string;
    TrialEndDate: string;
	MaxQueries: string;
}

