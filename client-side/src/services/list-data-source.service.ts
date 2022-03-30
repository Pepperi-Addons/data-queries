import { CardsGridDataView } from "@pepperi-addons/papi-sdk";
import { of } from "rxjs/internal/observable/of";

export const pageFiltersDataView = () => {
	const cardView: CardsGridDataView  = {
		Type: 'CardsGrid',
		Fields: [
			{
				FieldID: 'Resource',
				Type: 'TextBox',
				Title: "Resource",
				Mandatory: false,
				ReadOnly: true,
				Style: {
					Alignment: {
						Horizontal: "Left",
						Vertical: "Center",
					},
				}
			},
			{
				FieldID: 'Fields',
				Type: 'TextBox',
				Title: "Fields",
				Mandatory: false,
				ReadOnly: true,
				Style: {
					Alignment: {
						Horizontal: "Left",
						Vertical: "Center",
					},
				}
			}
		],
		Columns: [
					{
						Width: 0
					},
					{
						Width: 0
					}
				]
	}
	return of(cardView);
}
