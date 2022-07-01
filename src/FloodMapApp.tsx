import esri = __esri;

interface props extends Object {
  panelState: 'none' | 'info' | 'layers' | 'legend' | 'print';
}

// core
import { whenOnce } from '@arcgis/core/core/reactiveUtils';
// widget
import { subclass, property } from '@arcgis/core/core/accessorSupport/decorators';
import Widget from '@arcgis/core/widgets/Widget';
import { tsx } from '@arcgis/core/widgets/support/widget';
// graphic and geometry
import { contains } from '@arcgis/core/geometry/geometryEngine';
import Graphic from '@arcgis/core/Graphic';
import { SimpleMarkerSymbol } from '@arcgis/core/symbols';
// widgets
import Search from '@arcgis/core/widgets/Search';
import BasemapToggle from '@arcgis/core/widgets/BasemapToggle';
import Legend from '@arcgis/core/widgets/Legend';
import ViewControl from '@vernonia/core/dist/widgets/ViewControl';
import '@vernonia/core/dist/widgets/ViewControl.css';
import Loader from '@vernonia/core/dist/widgets/Loader';
import '@vernonia/core/dist/widgets/Loader.css';
import Disclaimer from '@vernonia/core/dist/widgets/Disclaimer';

import FloodInfo from './widgets/FloodInfo';
import './widgets/FloodInfo.scss';

import PrintFIRMetteModal from './widgets/PrintFIRMetteModal';
import './widgets/PrintFIRMetteModal.scss';

// styles
const CSS = {
  base: 'flood-map-app',
  header: 'flood-map-app--header',
  view: 'flood-map-app--view',
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

    const floodInfo = (this.floodInfo = new FloodInfo());

    const printFIRMette = floodInfo.on('print-firmette', (): void => {
      this.printFIRMetteModal.print(this._infoPoint);
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
    await view.when();

    const viewClick = view.on('click', this._viewClickHandler.bind(this));

    this.own([selectResult, viewClick, printFIRMette]);
  }

  container = document.createElement('calcite-shell');

  view!: esri.MapView;

  nextBasemap!: esri.Basemap;

  boundary!: esri.Polygon;

  baseLayer!: esri.MapImageLayer;

  protected search!: Search;

  protected floodInfo!: FloodInfo;

  protected printFIRMetteModal = new PrintFIRMetteModal();

  @property()
  protected panelState: props['panelState'] = 'info';

  private _infoPoint!: esri.Point;

  private async _viewClickHandler(event: esri.ViewClickEvent): Promise<void> {
    const {
      view: {
        graphics,
        map: { ground },
      },
      baseLayer,
      boundary,
      floodInfo,
    } = this;
    const { mapPoint } = event;

    if (floodInfo.state === 'querying') return;

    floodInfo.state = 'querying';

    // remove graphics
    graphics.removeAll();

    // check map point is in boundary
    if (!contains(boundary, mapPoint)) {
      floodInfo.state = 'ready';
      return;
    }

    this._infoPoint = mapPoint;

    graphics.add(
      new Graphic({
        geometry: mapPoint,
        symbol: new SimpleMarkerSymbol({
          color: '#ed5151',
          style: 'circle',
          size: 10,
          outline: {
            width: 1.2,
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

    floodInfo.info = _info;

    this.panelState = 'info';

    setTimeout((): void => {
      floodInfo.state = 'info';
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
                text="Flood Info"
                icon="information"
                active={panelState === 'info'}
                afterCreate={this._actionAfterCreate.bind(this, 'info')}
              ></calcite-action>
              <calcite-action
                id={tooltips[1]}
                text="Layers"
                icon="layers"
                active={panelState === 'layers'}
                afterCreate={this._actionAfterCreate.bind(this, 'layers')}
              ></calcite-action>
              <calcite-action
                id={tooltips[2]}
                text="Legend"
                icon="legend"
                active={panelState === 'legend'}
                afterCreate={this._actionAfterCreate.bind(this, 'legend')}
              ></calcite-action>
            </calcite-action-group>
            <calcite-action-group slot="bottom-actions">
              <calcite-action text="About" icon="question"></calcite-action>
            </calcite-action-group>
          </calcite-action-bar>

          {/* info panel */}
          <calcite-panel
            hidden={panelState !== 'info'}
            afterCreate={(container: HTMLCalcitePanelElement): void => {
              this._closePanel(container);
              this.floodInfo.container = container;
            }}
          ></calcite-panel>

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

  private _actionAfterCreate(panelState: props['panelState'], action: HTMLCalciteActionElement): void {
    // wire click event to effect panel state
    action.addEventListener('click', (): void => {
      this.panelState = this.panelState === panelState ? 'none' : panelState;
    });
    // create tooltip
    const id = `action_tt_${this.id}_${KEY++}`;
    action.id = id;
    const tooltip = document.createElement('calcite-tooltip');
    tooltip.referenceElement = id;
    tooltip.overlayPositioning = 'fixed';
    tooltip.closeOnClick = true;
    tooltip.innerHTML = action.text;
    document.body.append(tooltip);
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
