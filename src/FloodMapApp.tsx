import esri = __esri;
import { whenOnce } from '@arcgis/core/core/reactiveUtils';
import { subclass, property } from '@arcgis/core/core/accessorSupport/decorators';
import Widget from '@arcgis/core/widgets/Widget';
import { tsx } from '@arcgis/core/widgets/support/widget';

import Search from '@arcgis/core/widgets/Search';

import ViewControl from '@vernonia/core/dist/widgets/ViewControl';
import '@vernonia/core/dist/widgets/ViewControl.css';
import BasemapToggle from '@arcgis/core/widgets/BasemapToggle';

const CSS = {
  base: 'flood-map-app',
  header: 'flood-map-app--header',
  view: 'flood-map-app--view',
};

@subclass('FloodMapApp')
export default class FloodMapApp extends Widget {
  constructor(
    properties: esri.WidgetProperties & {
      view: esri.MapView;
      nextBasemap: esri.Basemap;
      boundary: esri.Polygon;
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

  @property()
  protected panelState: 'none' | 'info' | 'layers' | 'print' = 'info';

  render(): tsx.JSX.Element {
    const { panelState } = this;

    return (
      <calcite-shell class={CSS.base}>
        {/* header */}
        {this._createHeader()}

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

          <calcite-panel heading="Layers" hidden={panelState !== 'layers'}></calcite-panel>

          <calcite-panel heading="Print" hidden={panelState !== 'print'}></calcite-panel>
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
}
