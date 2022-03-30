import { EventEmitter, Injectable, Input, OnInit, Output } from "@angular/core";
import { ActivatedRoute, Router } from "@angular/router";
import { TranslateService } from "@ngx-translate/core";
import { PepAddonService } from "@pepperi-addons/ngx-lib";
import { IPepButtonClickEvent, PepButton } from "@pepperi-addons/ngx-lib/button";
import { PepDialogActionButton } from "@pepperi-addons/ngx-lib/dialog";
import { pepIconSystemBin } from "@pepperi-addons/ngx-lib/icon";
import { AddonService } from "../../services/addon.service";
import { DataVisualizationService } from "../../services/data-visualization.service";
import { DataQuery, Serie } from "../../../../server-side/models/data-query";
import { Overlay } from "../models/overlay ";
import { v4 as uuid } from 'uuid';
import { SeriesEditorComponent } from "../series-editor/series-editor.component";


@Injectable()
export abstract class BlockHelperService implements OnInit {

  @Input()
  set hostObject(value) {
    if (value && value.configuration) {
      this._configuration = value.configuration
    } else {
      if (this.blockLoaded) {
        this.loadDefaultConfiguration();
      }
    }
  }

  @Output() hostEvents: EventEmitter<any> = new EventEmitter<any>();
  protected _configuration: any;
  get configuration() {return this._configuration};
  label = false;
  currentDataQuery: DataQuery;
  activeTabIndex = 0;
  charts: any;
  blockLoaded = false;
  currentSeries: Serie;
  chartsOptions: { key: string, value: string }[] = [];
  seriesButtons: Array<Array<PepButton>> = [];
  DropShadowStyle: Array<PepButton> = [];
  PepSizes: Array<PepButton> = [];


  constructor(protected addonService: PepAddonService,
    public routeParams: ActivatedRoute,
    public router: Router,
    public route: ActivatedRoute,
    protected translate: TranslateService,
    protected dataVisualizationService: DataVisualizationService,
    public pluginService: AddonService) {
    this.pluginService.addonUUID = this.routeParams.snapshot.params['addon_uuid'];
  }

  async ngOnInit()  {
    if (!this.configuration || Object.keys(this.configuration).length == 0) {
      this.loadDefaultConfiguration();
    };

    this.PepSizes = [
      { key: 'sm', value: this.translate.instant('SM') },
      { key: 'md', value: this.translate.instant('MD') },
      { key: 'lg', value: this.translate.instant('LG') },
      { key: 'xl', value: this.translate.instant('XL') }
    ];

    this.DropShadowStyle = [
      { key: 'Soft', value: this.translate.instant('Soft') },
      { key: 'Regular', value: this.translate.instant('Regular') }
    ];

    const queryID = this.configuration?.query?.Key;
    if (queryID) {
      this._configuration.query = { Key: queryID };
      this.pluginService.getDataQueryByKey(queryID).then((res) => {
        this.currentDataQuery = res[0];
        this.blockLoaded = true;
        this.buildSeriesButtons();
        this._configuration.executeQuery = true;
        this.updateHostObject();
        this.hostEvents.emit({ action: 'block-editor-loaded' });
      })
    } else {
      const query = await this.pluginService.upsertDataQuery({Name: uuid()});
      this.currentDataQuery = query;
      this._configuration.query = { Key: query.Key }
      this.blockLoaded = true;
    }
  }

  protected loadDefaultConfiguration() {
    this._configuration = this.getDefaultHostObject();
    this.updateHostObject();
  }

  // need to be overriden
  protected abstract getDefaultHostObject();

  onEditClick() {
  }

  protected updateHostObject() {
    this.hostEvents.emit({
        action: 'set-configuration',
        configuration: this.configuration,
    });
  }

  protected updateQuerySeries(seriesToAddOrUpdate: any) {
    const idx = this.currentDataQuery?.Series?.findIndex(item => item.Key === seriesToAddOrUpdate.Key);
    if (idx > -1) {
        this.currentDataQuery.Series[idx] = seriesToAddOrUpdate;
    }
    else {
        if (!this.currentDataQuery?.Series) {
            this.currentDataQuery.Series = [];
        }
        this.currentDataQuery.Series.push(seriesToAddOrUpdate);
    }
    return this.currentDataQuery;
  }


  deleteSeries(event) {
    console.log(event);
    const idx = this.currentDataQuery.Series.findIndex(item => item.Key === event.source.key);
    if (idx > -1) {
        this.currentDataQuery.Series.splice(idx, 1);
    }

    this.pluginService.upsertDataQuery(this.currentDataQuery).then((res) => {
        this.currentDataQuery = res;
        this.buildSeriesButtons();
        this._configuration.executeQuery = true;
        this.updateHostObject();
    });
  }

  editSeries(event) {
    if (event) {
        let serie =  this.currentDataQuery.Series.filter(s => s.Key === event.source.key)[0];
        this.currentSeries = this.dataVisualizationService.deepCloneObject(serie) as Serie; // deep clone because if not the object will change also if cancel will be pressed
    }
    this.showSeriesEditorDialog(this.currentSeries);
  }

  add() {
    this.showSeriesEditorDialog(null);
  }

  tabClick(event) {
  }

  onFieldChange(key, event) {
    const value = event && event.source && event.source.key ? event.source.key : event && event.source && event.source.value ? event.source.value : event;

    if (key.indexOf('.') > -1) {
        let keyObj = key.split('.');
        this._configuration[keyObj[0]][keyObj[1]] = value;
    }
    else {
        this._configuration[key] = value;
    }
    this._configuration.executeQuery = false;
    this.updateHostObject();
  }


  showSeriesEditorDialog(series) {
    const seriesCount = this.currentDataQuery?.Series?.length ? this.currentDataQuery?.Series?.length : 0
    
    const callbackFunc = (seriesToAddOrUpdate) => {
        if (seriesToAddOrUpdate) {
            this.currentDataQuery = this.updateQuerySeries(seriesToAddOrUpdate);
            this.pluginService.upsertDataQuery(this.currentDataQuery).then((res) => {
                this.currentDataQuery = res;
                this.buildSeriesButtons();
                this._configuration.executeQuery = true;
                this.updateHostObject();
            })
        }
    }

    const actionButton: PepDialogActionButton = {
        title: "OK",
        className: "",
        callback: null,
    };
    const input = {
      currentSeries: series,
      parent: 'chart', // should be generic('scorecards' for scorecards-editor), but is it important?
      seriesName: series?.Name ? series.Name : `Series ${seriesCount + 1}`
    };
    this.dataVisualizationService.openDialog(this.translate.instant('EditQuery'), SeriesEditorComponent, actionButton, input, callbackFunc);
  }

  buildSeriesButtons() {
    this.seriesButtons = [];
    this.currentDataQuery?.Series?.forEach(serise => {
        this.seriesButtons.push([
            {
                key: serise.Key,
                value: serise.Name,
                callback: (event: IPepButtonClickEvent) => this.editSeries(event),
            },
            {
                key: serise.Key,
                classNames: 'caution',
                callback: (event: IPepButtonClickEvent) => this.deleteSeries(event),
                iconName: pepIconSystemBin.name,
            },
        ]);
    });
  }

  getSliderBackground(color) {
    if (!color) return;
    let alignTo = 'right';

    let col: Overlay = new Overlay();

    col.color = color;
    col.opacity = '100';

    let gradStr = this.dataVisualizationService.getRGBAcolor(col, 0) + ' , ' + this.dataVisualizationService.getRGBAcolor(col);

    return 'linear-gradient(to ' + alignTo + ', ' + gradStr + ')';
  }

}