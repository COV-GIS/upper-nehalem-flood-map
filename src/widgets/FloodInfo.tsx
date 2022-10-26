import { subclass, property } from '@arcgis/core/core/accessorSupport/decorators';
import Widget from '@arcgis/core/widgets/Widget';
import { tsx } from '@arcgis/core/widgets/support/widget';

const CSS = {
  content: 'flood-info_content',
  info: 'flood-info_info',
};

@subclass('FloodInfo')
export default class FloodInfo extends Widget {
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

  @property()
  state: 'ready' | 'querying' | 'info' = 'ready';

  render(): tsx.JSX.Element {
    const {
      info: { latitude, longitude, elevation, section, county, zone, description, firm, jurisdiction },
      state,
    } = this;
    return (
      <calcite-panel heading="Flood Info">
        <calcite-button
          width="full"
          appearance="outline"
          hidden={state !== 'info'}
          icon-start="print"
          slot={state === 'info' ? 'footer-actions' : ''}
          afterCreate={(button: HTMLCalciteButtonElement): void => {
            button.addEventListener('click', () => {
              this.emit('print-firmette');
            });
          }}
        >
          FIRMette
        </calcite-button>

        <div class={CSS.content}>
          <calcite-notice open="" icon="cursor" hidden={state !== 'ready'}>
            <div slot="message">
              Click on a point of interest in the map or search for an address to display flood hazard information at
              that location
            </div>
          </calcite-notice>

          <calcite-loader
            active={state === 'querying'}
            hidden={state !== 'querying'}
            scale="s"
            text="Querying flood info"
            type="indeterminate"
          ></calcite-loader>

          <div hidden={state !== 'info'}>
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
          </div>
        </div>
      </calcite-panel>
    );
  }
}
