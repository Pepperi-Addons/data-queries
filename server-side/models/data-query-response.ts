export class DataQueryResponse {
    DataQueries: SeriesData[];
    DataSet: Map<string, any>[];
    Objects?: any[];
    NumberFormatter?: any;

    constructor() {
        this.DataQueries = [];
        this.DataSet = [];
    }
}
export class SeriesData {
    Name: string;
    Groups: string[];
    Series: string[];

    constructor(seriesName) {
        this.Name = seriesName;
        this.Groups = [];
        this.Series = [];
    }
}

