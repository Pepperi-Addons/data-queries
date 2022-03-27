import { AddonData } from "@pepperi-addons/papi-sdk";

export interface Chart extends AddonData {
    Name: string;
    ScriptURI: string;
    ReadOnly?: Boolean;
    Description?: string;
    FileID?: number;
    Hidden?: boolean;
    CreationDateTime?: string;
    ModificationDateTime?: string;
    [key: string]: any;
}

export interface ChartDTO {
    Key?: string;
    Name: string;
    ScriptURI: string;
    ReadOnly?: Boolean;
    Description?: string;
    Hidden?: boolean;
    CreationDateTime?: string;
    ModificationDateTime?: string;
}

export declare const ChartTypes: readonly ["Single", "Gauge", "MultiSeries"];
export declare type ChartType = typeof ChartTypes[number];
