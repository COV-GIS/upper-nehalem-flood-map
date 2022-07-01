import { subclass, property } from '@arcgis/core/core/accessorSupport/decorators';
import Widget from '@arcgis/core/widgets/Widget';
import { tsx } from '@arcgis/core/widgets/support/widget';

const CSS = {
  info: 'flood-info--info',
  progress: 'flood-info--progress',
};

@subclass('FloodInfo')
export default class FloodInfo extends Widget {
  @property()
  state: 'ready' | 'querying' | 'info' = 'ready';

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

  render(): tsx.JSX.Element {
    const {
      state,
      info: { latitude, longitude, elevation, section, county, zone, description, firm, jurisdiction },
    } = this;

    return (
      <calcite-panel heading="Flood Info" show-back-button="">
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
            <calcite-button
              width="full"
              appearance="outline"
              icon-start="print"
              afterCreate={(button: HTMLCalciteButtonElement): void => {
                button.addEventListener('click', () => {
                  this.emit('print-firmette');
                });
              }}
            >
              FIRMette
            </calcite-button>
          </div>
        </calcite-block>
      </calcite-panel>
    );
  }
}
