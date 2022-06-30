import esri = __esri;
// core
import esriRequest from '@arcgis/core/request';
import { watch, whenOnce } from '@arcgis/core/core/reactiveUtils';
import Collection from '@arcgis/core/core/Collection';
// widget
import { subclass, property } from '@arcgis/core/core/accessorSupport/decorators';
import Widget from '@arcgis/core/widgets/Widget';
import { storeNode, tsx } from '@arcgis/core/widgets/support/widget';
// graphic and geometry
import { contains } from '@arcgis/core/geometry/geometryEngine';
import Graphic from '@arcgis/core/Graphic';
import { SimpleMarkerSymbol, TextSymbol } from '@arcgis/core/symbols';
// widgets
import Search from '@arcgis/core/widgets/Search';
import BasemapToggle from '@arcgis/core/widgets/BasemapToggle';
import Legend from '@arcgis/core/widgets/Legend';
import ViewControl from '@vernonia/core/dist/widgets/ViewControl';
import '@vernonia/core/dist/widgets/ViewControl.css';

import Loader from '@vernonia/core/dist/widgets/Loader';
import '@vernonia/core/dist/widgets/Loader.css';
import Disclaimer from '@vernonia/core/dist/widgets/Disclaimer';

// styles
const CSS = {
  // widget
  base: 'flood-map-app',
  header: 'flood-map-app--header',
  view: 'flood-map-app--view',

  // info widget
  progress: 'flood-map-app--progress',
  info: 'flood-map-app--info',
};

let KEY = 0;

@subclass('FloodMapApp')
export default class FloodMapApp extends Widget {
  constructor(
    properties: esri.WidgetProperties & {
      view: esri.MapView;
      nextBasemap: esri.Basemap;
      boundary: esri.Polygon;
      baseLayer: esri.MapImageLayer;
    },
  ) {
    super(properties);

    document.body.append(this.container);

    const loader = new Loader({
      title: 'Upper Nehalem Flood Map',
      copyright: 'Upper Nehalem Flood',
    });

    properties.view.when((): void => {
      loader.end();
    });

    if (!Disclaimer.isAccepted()) {
      new Disclaimer({
        text: `The purpose of this application is to help the citizens of the Upper Nehalem basin be informed of flood hazards and to be prepared for flood events. Any information herein is for reference only. Upper Nehalem Flood makes every effort to keep this information current and accurate. However, Upper Nehalem Flood is not responsible for errors, misuse, omissions, or misinterpretations. There are no warranties, expressed or implied, including the warranty of merchantability or fitness for a particular purpose, accompanying this application.`,
      });
    }
  }

  async postInitialize(): Promise<void> {
    const { container, view, nextBasemap, boundary, baseLayer } = this;

    // clear default zoom
    view.ui.empty('top-left');

    view.ui.add(
      new ViewControl({
        view,
        includeLocate: true,
        includeFullscreen: true,
        fullscreenElement: container,
      }),
      'bottom-right',
    );

    view.ui.add(
      new BasemapToggle({
        view,
        nextBasemap,
      }),
      'bottom-right',
    );

    const search = (this.search = new Search({
      view,
      locationEnabled: false,
      popupEnabled: false,
      resultGraphicEnabled: false,
    }));

    view.ui.add(search, 'top-right');

    whenOnce((): number => search.defaultSources.length).then((): void => {
      search.defaultSources.forEach((source) => {
        source.filter = {
          geometry: boundary,
        };
      });
    });

    const selectResult = search.on('select-result', (event: esri.SearchSelectResultEvent): void => {
      this._viewClickHandler({
        mapPoint: event.result.feature.geometry as esri.Point,
      } as esri.ViewClickEvent);
    });

    whenOnce((): boolean => baseLayer.loaded).then((): void => {
      baseLayer.sublayers.forEach((sublayer: esri.Sublayer): void => {
        if (sublayer.title === 'Places') sublayer.legendEnabled = false;
      });
    });

    this.info = new Info();

    ////////////////////////////////////////
    // assure no view or dom race conditions
    ////////////////////////////////////////
    await setTimeout((): 0 => {
      return 0;
    }, 0);
    /////////////////////
    // set view container
    /////////////////////
    view.container = document.querySelector('div[data-view-container]') as HTMLDivElement;
    ////////////////////////////
    // wait for serviceable view
    ////////////////////////////
    await view.when();

    const viewClick = view.on('click', this._viewClickHandler.bind(this));

    this.own([selectResult, viewClick]);
  }

  container = document.createElement('calcite-shell');

  view!: esri.MapView;

  nextBasemap!: esri.Basemap;

  boundary!: esri.Polygon;

  baseLayer!: esri.MapImageLayer;

  protected search!: Search;

  protected info!: Info;

  @property()
  protected panelState: 'none' | 'info' | 'layers' | 'legend' | 'print' = 'info';

  private async _viewClickHandler(event: esri.ViewClickEvent): Promise<void> {
    const {
      view: {
        graphics,
        map: { ground },
      },
      baseLayer,
      boundary,
      info,
    } = this;
    const { mapPoint } = event;

    if (info.state === 'querying' || info.state === 'printing') return;

    info.state = 'querying';

    // remove graphics
    graphics.removeAll();

    // check map point is in boundary
    if (!contains(boundary, mapPoint)) {
      info.state = 'ready';
      return;
    }

    graphics.add(
      new Graphic({
        geometry: mapPoint,
        // symbol: new TextSymbol({
        //   color: '#ed5151',
        //   text: '\ue61d',
        //   horizontalAlignment: 'center',
        //   verticalAlignment: 'bottom',
        //   font: {
        //     size: 24,
        //     family: 'CalciteWebCoreIcons',
        //   },
        // }),
        symbol: new SimpleMarkerSymbol({
          color: '#ed5151',
          style: 'circle',
          size: 12,
          outline: {
            width: 1.5,
            color: 'white',
          },
        }),
      }),
    );

    const queries = baseLayer.sublayers.map(
      (sublayer: esri.Sublayer): Promise<esri.FeatureSet | esri.ElevationQueryResult> => {
        return sublayer.queryFeatures({
          geometry: mapPoint,
          outFields: ['*'],
          returnGeometry: false,
        });
      },
    );

    queries.push(ground.queryElevation(mapPoint));

    const [
      jurisdictions,
      sections,
      counties,
      basin,
      floodZones,
      profiles,
      xsections,
      bfe,
      columbiaFirm,
      clatsopFirm,
      places,
      elevation,
    ] = await Promise.all(queries);

    const county = (counties as esri.FeatureSet).features[0].attributes.instName;

    const _info = {
      latitude: mapPoint.latitude.toFixed(5),
      longitude: mapPoint.longitude.toFixed(5),
      elevation: `${(((elevation as esri.ElevationQueryResult).geometry as esri.Point).z * 3.28084).toFixed(2)} feet`,
      section: (sections as esri.FeatureSet).features[0].attributes.LABEL,
      county,
      zone: 'Flood Zone X',
      description: 'Area of Minimal Flood Risk',
      firm: '',
      jurisdiction: (jurisdictions as esri.FeatureSet).features[0].attributes.name,
    };

    const feature = (floodZones as esri.FeatureSet).features[0];

    if (feature) {
      const { zone, desc } = feature.attributes;
      _info.zone = `Flood ${zone}`;
      _info.description = desc;

      if (county === 'Clatsop County') _info.firm = (clatsopFirm as esri.FeatureSet).features[0].attributes.FIRM_PAN;

      if (county === 'Columbia County') _info.firm = (columbiaFirm as esri.FeatureSet).features[0].attributes.FIRM_PAN;
    }

    info.info = _info;

    info.point = mapPoint;

    this.panelState = 'info';

    setTimeout((): void => {
      info.state = 'info';
    }, 2000);
  }

  private _baseSublayerVisibility(id: number, visible: boolean): void {
    const {
      baseLayer: { sublayers },
    } = this;

    sublayers.find((sublayer: esri.Sublayer): boolean => {
      return sublayer.id === id;
    }).visible = visible;
  }

  render(): tsx.JSX.Element {
    const { id, panelState } = this;

    const tooltips = [0, 1, 2, 3].map((index: number): string => {
      return `tt_${id}_${index}_${KEY++}`;
    });

    return (
      <calcite-shell class={CSS.base} content-behind="">
        {/* header */}
        {this._createHeader()}

        {/* widgets panel */}
        <calcite-shell-panel detached="" slot="primary-panel" position="start" collapsed={panelState === 'none'}>
          {/* actions */}
          <calcite-action-bar slot="action-bar" expand-disabled="">
            <calcite-action-group>
              <calcite-action
                id={tooltips[0]}
                text="Flood Info"
                icon="information"
                active={panelState === 'info'}
                afterCreate={(action: HTMLCalciteActionElement) => {
                  action.addEventListener('click', (): void => {
                    this.panelState = this.panelState === 'info' ? 'none' : 'info';
                  });
                }}
              ></calcite-action>
              <calcite-action
                id={tooltips[1]}
                text="Layers"
                icon="layers"
                active={panelState === 'layers'}
                afterCreate={(action: HTMLCalciteActionElement) => {
                  action.addEventListener('click', (): void => {
                    this.panelState = this.panelState === 'layers' ? 'none' : 'layers';
                  });
                }}
              ></calcite-action>
              <calcite-action
                id={tooltips[2]}
                text="Legend"
                icon="legend"
                active={panelState === 'legend'}
                afterCreate={(action: HTMLCalciteActionElement) => {
                  action.addEventListener('click', (): void => {
                    this.panelState = this.panelState === 'legend' ? 'none' : 'legend';
                  });
                }}
              ></calcite-action>
            </calcite-action-group>
            <calcite-action-group slot="bottom-actions">
              <calcite-action id={tooltips[3]} text="About" icon="question"></calcite-action>
            </calcite-action-group>

            {/* tooltips */}
            <calcite-tooltip close-on-click="" overlay-positioning="fixed" reference-element={tooltips[0]}>
              Flood Info
            </calcite-tooltip>
            <calcite-tooltip close-on-click="" overlay-positioning="fixed" reference-element={tooltips[1]}>
              Layers
            </calcite-tooltip>
            <calcite-tooltip close-on-click="" overlay-positioning="fixed" reference-element={tooltips[2]}>
              Legend
            </calcite-tooltip>
            <calcite-tooltip close-on-click="" overlay-positioning="fixed" reference-element={tooltips[3]}>
              About
            </calcite-tooltip>
          </calcite-action-bar>

          {/* info panel */}
          <calcite-panel
            heading="Flood Info"
            show-back-button=""
            hidden={panelState !== 'info'}
            afterCreate={this._closePanel.bind(this)}
          >
            <calcite-block
              afterCreate={(container: HTMLCalciteBlockElement): void => {
                this.info.container = container;
              }}
            ></calcite-block>
          </calcite-panel>

          {/* layers panel */}
          <calcite-panel
            heading="Layers"
            show-back-button=""
            hidden={panelState !== 'layers'}
            afterCreate={this._closePanel.bind(this)}
          >
            {this._createLayers()}
          </calcite-panel>

          {/* legend panel */}
          <calcite-panel
            heading="Legend"
            show-back-button=""
            hidden={panelState !== 'legend'}
            afterCreate={this._closePanel.bind(this)}
          >
            <div
              afterCreate={(container: HTMLDivElement): void => {
                new Legend({
                  view: this.view,
                  container,
                });
              }}
            ></div>
          </calcite-panel>
        </calcite-shell-panel>

        {/* view */}
        <div class={CSS.view} data-view-container=""></div>
      </calcite-shell>
    );
  }

  /**
   * Wire panel close event.
   * @param panel
   */
  private _closePanel(panel: HTMLCalcitePanelElement): void {
    panel.addEventListener('calcitePanelBackClick', (): void => {
      this.panelState = 'none';
    });
  }

  private _createHeader(): tsx.JSX.Element {
    return (
      <div class={this.classes(CSS.header, 'bootstrap')} slot="header">
        <div class="px-3 py-2 navbar-dark bg-dark text-white d-none d-lg-block">
          <div class="container">
            <div class="d-flex flex-wrap align-items-center justify-content-center justify-content-lg-start">
              <a
                href="/"
                class="title d-flex align-items-center my-2 my-lg-0 me-lg-auto text-white text-decoration-none"
              >
                Upper Nehalem Flood
              </a>
              <ul class="nav col-12 col-lg-auto my-2 justify-content-center my-md-0 text-small">
                <li>
                  <a href="/flood/" class="nav-link text-white">
                    <span class="d-block mx-auto mb-1">
                      <i class="fa-solid fa-water"></i>
                    </span>
                    Flood
                  </a>
                </li>
                <li>
                  <a href="/be-prepared/" class="nav-link text-white">
                    <span class="d-block mx-auto mb-1">
                      <i class="fa-solid fa-house-flood-water"></i>
                    </span>
                    Be Prepared
                  </a>
                </li>
                <li>
                  <a href="/resources/" class="nav-link text-white">
                    <span class="d-block mx-auto mb-1">
                      <i class="fa-solid fa-circle-info"></i>
                    </span>
                    Resources
                  </a>
                </li>
                <li>
                  <a href="/news/" class="nav-link text-white">
                    <span class="d-block mx-auto mb-1">
                      <i class="fa-solid fa-newspaper"></i>
                    </span>
                    News
                  </a>
                </li>
                <li>
                  <a href="/map/" class="nav-link text-primary">
                    <span class="d-block mx-auto mb-1">
                      <i class="fa-solid fa-location-dot"></i>
                    </span>
                    Map
                  </a>
                </li>
                <li>
                  <a href="/contribute/" class="nav-link text-white">
                    <span class="d-block mx-auto mb-1">
                      <i class="fa-solid fa-users"></i>
                    </span>
                    Contribute
                  </a>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    );
  }

  private _createLayers(): tsx.JSX.Element {
    return (
      <div>
        {/* flood layers */}
        <calcite-block heading="Flood Layers" open="" collapsible="">
          <calcite-label layout="inline">
            <calcite-checkbox
              afterCreate={(checkbox: HTMLCalciteCheckboxElement): void => {
                checkbox.addEventListener('calciteCheckboxChange', (event: Event): void => {
                  this._baseSublayerVisibility(10, (event.target as HTMLCalciteCheckboxElement).checked);
                });
              }}
            ></calcite-checkbox>
            Base Flood Elevations
          </calcite-label>
          <calcite-label layout="inline">
            <calcite-checkbox
              afterCreate={(checkbox: HTMLCalciteCheckboxElement): void => {
                checkbox.addEventListener('calciteCheckboxChange', (event: Event): void => {
                  this._baseSublayerVisibility(11, (event.target as HTMLCalciteCheckboxElement).checked);
                });
              }}
            ></calcite-checkbox>
            Cross Sections
          </calcite-label>
          <calcite-label layout="inline">
            <calcite-checkbox
              afterCreate={(checkbox: HTMLCalciteCheckboxElement): void => {
                checkbox.addEventListener('calciteCheckboxChange', (event: Event): void => {
                  this._baseSublayerVisibility(12, (event.target as HTMLCalciteCheckboxElement).checked);
                });
              }}
            ></calcite-checkbox>
            Stream Profiles
          </calcite-label>
        </calcite-block>
        {/* firm panels */}
        <calcite-block heading="FIRM Panels" collapsible="">
          <calcite-label layout="inline">
            <calcite-checkbox
              afterCreate={(checkbox: HTMLCalciteCheckboxElement): void => {
                checkbox.addEventListener('calciteCheckboxChange', (event: Event): void => {
                  this._baseSublayerVisibility(5, (event.target as HTMLCalciteCheckboxElement).checked);
                });
              }}
            ></calcite-checkbox>
            Clatsop County FIRM Panels
          </calcite-label>
          <calcite-label layout="inline">
            <calcite-checkbox
              afterCreate={(checkbox: HTMLCalciteCheckboxElement): void => {
                checkbox.addEventListener('calciteCheckboxChange', (event: Event): void => {
                  this._baseSublayerVisibility(6, (event.target as HTMLCalciteCheckboxElement).checked);
                });
              }}
            ></calcite-checkbox>
            Columbia County FIRM Panels
          </calcite-label>
        </calcite-block>
        {/* reference layers */}
        <calcite-block heading="Reference Layers" collapsible="">
          <calcite-label layout="inline">
            <calcite-checkbox
              afterCreate={(checkbox: HTMLCalciteCheckboxElement): void => {
                checkbox.addEventListener('calciteCheckboxChange', (event: Event): void => {
                  this._baseSublayerVisibility(20, (event.target as HTMLCalciteCheckboxElement).checked);
                });
              }}
            ></calcite-checkbox>
            County Boundaries
          </calcite-label>
          <calcite-label layout="inline">
            <calcite-checkbox
              afterCreate={(checkbox: HTMLCalciteCheckboxElement): void => {
                checkbox.addEventListener('calciteCheckboxChange', (event: Event): void => {
                  this._baseSublayerVisibility(21, (event.target as HTMLCalciteCheckboxElement).checked);
                });
              }}
            ></calcite-checkbox>
            Sections
          </calcite-label>
          <calcite-label layout="inline">
            <calcite-checkbox
              afterCreate={(checkbox: HTMLCalciteCheckboxElement): void => {
                checkbox.addEventListener('calciteCheckboxChange', (event: Event): void => {
                  this._baseSublayerVisibility(22, (event.target as HTMLCalciteCheckboxElement).checked);
                });
              }}
            ></calcite-checkbox>
            Floodplain Jurisdiction
          </calcite-label>
        </calcite-block>
      </div>
    );
  }
}

/**
 * Widget to display flood info.
 */
@subclass('Info')
export class Info extends Widget {
  postInitialize(): void {
    watch(
      () => this.state,
      (state): void => {
        if (state === 'ready' || state === 'querying') {
          this._printState = 'ready';
        }
      },
    );
  }

  @property()
  state: 'ready' | 'querying' | 'info' | 'printing' = 'ready';

  @property()
  info = {
    latitude: '',
    longitude: '',
    elevation: '',
    section: '',
    county: '',
    zone: '',
    description: '',
    firm: '',
    jurisdiction: '',
  };

  point!: esri.Point;

  @property()
  private _printState: 'ready' | 'printing' | 'printed' = 'ready';

  private _printUrl = '';

  render(): tsx.JSX.Element {
    const {
      state,
      info: { latitude, longitude, elevation, section, county, zone, description, firm, jurisdiction },
      _printState,
    } = this;

    return (
      <calcite-block open="" style="margin: 0;">
        <div hidden={state !== 'ready'}>
          Click on a point of interest in the map or search for an address to display flood hazard information at that
          location.
        </div>
        <div hidden={state !== 'querying'}>
          <p>Querying Information</p>
          <div class={CSS.progress}>
            <calcite-progress type="indeterminate"></calcite-progress>
          </div>
        </div>
        <div hidden={state !== 'info' && state !== 'printing'}>
          <p class={CSS.info}>
            <strong>Location</strong>
            <span>Latitude: {latitude}</span>
            <span>Longitude: {longitude}</span>
            <span>Elevation: {elevation}</span>
            <span>Section: {section}</span>
            <span>County: {county}</span>
          </p>
          <p class={CSS.info}>
            <strong>{zone}</strong>
            <span>{description}</span>
            <span hidden={firm === ''}>
              <calcite-link href="#">FIRM Panel {firm}</calcite-link>
            </span>
          </p>
          <p class={CSS.info}>
            <strong>Floodplain Management</strong>
            <span>
              <calcite-link href="#">{jurisdiction}</calcite-link>
            </span>
          </p>
          <calcite-button
            hidden={_printState !== 'ready'}
            width="full"
            appearance="outline"
            icon-start="print"
            afterCreate={(button: HTMLCalciteButtonElement): void => {
              button.addEventListener('click', this._print.bind(this));
            }}
          >
            Print FIRMette
          </calcite-button>
          <calcite-button hidden={_printState !== 'printing'} width="full" appearance="outline" loading="">
            Printing FIRMette
          </calcite-button>
          <calcite-button
            hidden={_printState !== 'printed'}
            width="full"
            appearance="outline"
            icon-start="download"
            afterCreate={(button: HTMLCalciteButtonElement): void => {
              button.addEventListener('click', this._printDownload.bind(this));
            }}
          >
            Download FIRMette
          </calcite-button>
        </div>
      </calcite-block>
    );
  }

  private _print(): void {
    const { point, _printState } = this;

    if (!point || _printState !== 'ready') return;

    this.state = 'printing';
    this._printState = 'printing';

    esriRequest(
      'https://msc.fema.gov/arcgis/rest/services/NFHL_Print/AGOLPrintB/GPServer/Print%20FIRM%20or%20FIRMette/submitJob',
      {
        responseType: 'json',
        query: {
          f: 'json',
          FC: JSON.stringify({
            geometryType: 'esriGeometryPoint',
            features: [{ geometry: { x: point.x, y: point.y, spatialReference: { wkid: 102100 } } }],
            sr: { wkid: 102100 },
          }),
          Print_Type: 'FIRMETTE',
          graphic: 'PDF',
          input_lat: 29.877,
          input_lon: -81.2837,
        },
      },
    )
      .then(this._printCheck.bind(this))
      .catch((error: esri.Error): void => {
        console.log('submit job error', error);
        // TODO: inform user
      });
  }

  private _printCheck(response: any): void {
    const data: { jobId: string; jobStatus: string } = response.data;

    if (data.jobStatus === 'esriJobSubmitted' || data.jobStatus === 'esriJobExecuting') {
      esriRequest(
        `https://msc.fema.gov/arcgis/rest/services/NFHL_Print/AGOLPrintB/GPServer/Print%20FIRM%20or%20FIRMette/jobs/${data.jobId}`,
        {
          responseType: 'json',
          query: {
            f: 'json',
          },
        },
      )
        .then((response: any): void => {
          setTimeout(this._printCheck.bind(this, response), 1000);
        })
        .catch((error: esri.Error): void => {
          console.log('check job error', error);
          // TODO: inform user
        });
    } else if (data.jobStatus === 'esriJobSucceeded') {
      this._printComplete(response);
    } else {
      console.log('server job error', response);
      // TODO: inform user
    }
  }

  private _printComplete(response: any): void {
    const data: { jobId: string; jobStatus: string; results: { OutputFile: { paramUrl: string } } } = response.data;

    esriRequest(
      `https://msc.fema.gov/arcgis/rest/services/NFHL_Print/AGOLPrintB/GPServer/Print%20FIRM%20or%20FIRMette/jobs/${data.jobId}/${data.results.OutputFile.paramUrl}`,
      {
        responseType: 'json',
        query: {
          f: 'json',
        },
      },
    )
      .then((response: any): void => {
        this._printUrl = response.data.value.url.replace('http://', 'https://');
        this.state = 'info';
        this._printState = 'printed';
      })
      .catch((error: esri.Error): void => {
        console.log('get job error', error);
        // TODO: inform user
      });
  }

  private _printDownload(): void {
    const { _printUrl } = this;

    if (_printUrl) window.open(_printUrl, '_blank');
  }
}
