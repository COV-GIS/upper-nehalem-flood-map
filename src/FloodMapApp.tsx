import esri = __esri;
import { whenOnce } from '@arcgis/core/core/reactiveUtils';
import { subclass, property } from '@arcgis/core/core/accessorSupport/decorators';
import Widget from '@arcgis/core/widgets/Widget';
import { tsx } from '@arcgis/core/widgets/support/widget';

import Search from '@arcgis/core/widgets/Search';

import ViewControl from '@vernonia/core/dist/widgets/ViewControl';
import '@vernonia/core/dist/widgets/ViewControl.css';
import BasemapToggle from '@arcgis/core/widgets/BasemapToggle';

import esriRequest from '@arcgis/core/request';

const CSS = {
  base: 'flood-map-app',
  header: 'flood-map-app--header',
  view: 'flood-map-app--view',

  panelContent: 'flood-map-app--panel-content',
};

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
  }

  async postInitialize(): Promise<void> {
    const { container, view, nextBasemap, boundary } = this;

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

    const search = new Search({
      view,
      locationEnabled: false,
      popupEnabled: false,
      resultGraphicEnabled: false,
    });

    view.ui.add(search, 'top-right');

    whenOnce((): number => search.defaultSources.length).then((): void => {
      search.defaultSources.forEach((source) => {
        source.filter = {
          geometry: boundary,
        };
      });
    });

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
    // await view.when(); // nothing to do here...yet
  }

  container = document.createElement('calcite-shell');

  view!: esri.MapView;

  nextBasemap!: esri.Basemap;

  boundary!: esri.Polygon;

  baseLayer!: esri.MapImageLayer;

  @property()
  protected panelState: 'none' | 'info' | 'layers' | 'print' = 'info';

  private _baseSublayerVisibility(id: number, visible: boolean): void {
    const {
      baseLayer: { sublayers },
    } = this;

    sublayers.find((sublayer: esri.Sublayer): boolean => {
      return sublayer.id === id;
    }).visible = visible;
  }

  render(): tsx.JSX.Element {
    const { panelState } = this;

    return (
      <calcite-shell class={CSS.base}>
        {/* header */}
        {this._createHeader()}

        {/* widgets panel */}
        <calcite-shell-panel slot="primary-panel" position="start" collapsed={panelState === 'none'}>
          <calcite-action-bar slot="action-bar">
            <calcite-action-group>
              <calcite-action
                text="Info"
                icon="information"
                active={panelState === 'info'}
                afterCreate={(action: HTMLCalciteActionElement) => {
                  action.addEventListener('click', (): void => {
                    this.panelState = this.panelState === 'info' ? 'none' : 'info';
                  });
                }}
              ></calcite-action>
              <calcite-action
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
                text="Print"
                icon="print"
                active={panelState === 'print'}
                afterCreate={(action: HTMLCalciteActionElement) => {
                  action.addEventListener('click', (): void => {
                    this.panelState = this.panelState === 'print' ? 'none' : 'print';
                  });
                }}
              ></calcite-action>
            </calcite-action-group>
          </calcite-action-bar>

          <calcite-panel heading="Info" hidden={panelState !== 'info'}></calcite-panel>

          <calcite-panel heading="Layers" hidden={panelState !== 'layers'}>
            {this._createLayers()}
          </calcite-panel>

          <calcite-panel heading="Print" hidden={panelState !== 'print'}>
            <calcite-block
              afterCreate={(container: HTMLCalciteBlockElement): void => {
                new Print({ view: this.view, container });
              }}
            ></calcite-block>
          </calcite-panel>
        </calcite-shell-panel>

        {/* view */}
        <div class={CSS.view} data-view-container=""></div>
      </calcite-shell>
    );
  }

  private _createHeader(): tsx.JSX.Element {
    return (
      <div class={CSS.header} slot="header">
        <div class="px-3 py-2 navbar-dark bg-dark text-white">
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

        <calcite-block heading="FIRM Panels" open="" collapsible="">
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
      </div>
    );
  }
}

@subclass('Print')
export class Print extends Widget {
  constructor(
    properties: esri.WidgetProperties & {
      view: esri.MapView;
      // layer: esri.FeatureLayer;
    },
  ) {
    super(properties);
  }

  view!: esri.MapView;

  // layer!: esri.FeatureLayer;

  private _printFIRMette(): void {
    const { view } = this;
    esriRequest(
      'https://msc.fema.gov/arcgis/rest/services/NFHL_Print/AGOLPrintB/GPServer/Print%20FIRM%20or%20FIRMette/submitJob',
      {
        responseType: 'json',
        query: {
          f: 'json',
          FC: JSON.stringify({
            geometryType: 'esriGeometryPoint',
            features: [
              { geometry: { x: view.center.x, y: view.center.y, spatialReference: { wkid: 102100 } } },
            ],
            sr: { wkid: 102100 },
          }),
          Print_Type: 'FIRMETTE',
          graphic: 'PDF',
          input_lat: 29.877,
          input_lon: -81.2837,
        },
      },
    )
      .then(this._printFIRMetteCheckJob.bind(this))
      .catch(event => console.log('error', event));

    // fetch()
  }

  private _printFIRMetteCheckJob(response: any): void {
    const data: { jobId: string, jobStatus: string, results: { OutputFile: { paramUrl: string } } } = response.data;

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
          setTimeout(
            this._printFIRMetteCheckJob.bind(this, response),
            2000,
          );
        })
        .catch(error => console.log('error', error));


    } else if (data.jobStatus === 'esriJobSucceeded') {

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
          console.log(response);

          window.open(response.data.value.url.replace('http', 'https'), '_blank');

        })
        .catch(error => console.log('error', error));

    } else {
      // handle error
    }

  }

  render(): tsx.JSX.Element {
    return (
      <calcite-block open="" style="margin: 0;">
        {/* <p>Zoom to and position the map to the area you wish to print. Click the <i>Print FIRMette</i> button to generate a FIRMette from the FEMA Map Service Center. Click the <i>Print</i> button to generate a PDF of any location and scale of the map.</p> */}

        <p>
          <calcite-button width="full" appearance="outline" onclick={this._printFIRMette.bind(this)}>
            Print FIRMette
          </calcite-button>
        </p>
        <p>
          <calcite-button width="full">Print PDF</calcite-button>
        </p>
        <p>Print Results</p>
      </calcite-block>
    );
  }
}
