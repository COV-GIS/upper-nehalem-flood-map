import esri = __esri;
import { subclass } from '@arcgis/core/core/accessorSupport/decorators';
import Widget from '@arcgis/core/widgets/Widget';
import { tsx } from '@arcgis/core/widgets/support/widget';

@subclass('FloodLayers')
export default class FloodLayers extends Widget {
  constructor(
    properties: esri.WidgetProperties & {
      layer: esri.MapImageLayer;
    },
  ) {
    super(properties);
  }

  layer!: esri.MapImageLayer;

  private _baseSublayerVisibility(id: number, visible: boolean): void {
    const {
      layer: { sublayers },
    } = this;

    sublayers.find((sublayer: esri.Sublayer): boolean => {
      return sublayer.id === id;
    }).visible = visible;
  }

  private _checkboxAfterCreate(id: number, checkbox: HTMLCalciteCheckboxElement): void {
    checkbox.addEventListener('calciteCheckboxChange', (event: Event): void => {
      this._baseSublayerVisibility(id, (event.target as HTMLCalciteCheckboxElement).checked);
    });
  }

  render(): tsx.JSX.Element {
    return (
      <calcite-panel heading="Layers">
        {/* flood layers */}
        <calcite-block heading="Flood Layers" open="" collapsible="">
          <calcite-label layout="inline">
            <calcite-checkbox afterCreate={this._checkboxAfterCreate.bind(this, 10)}></calcite-checkbox>
            Base Flood Elevations
          </calcite-label>
          <calcite-label layout="inline">
            <calcite-checkbox afterCreate={this._checkboxAfterCreate.bind(this, 11)}></calcite-checkbox>
            Cross Sections
          </calcite-label>
          <calcite-label layout="inline">
            <calcite-checkbox afterCreate={this._checkboxAfterCreate.bind(this, 12)}></calcite-checkbox>
            Stream Profiles
          </calcite-label>
        </calcite-block>
        {/* firm panels */}
        <calcite-block heading="FIRM Panels" collapsible="">
          <calcite-label layout="inline">
            <calcite-checkbox afterCreate={this._checkboxAfterCreate.bind(this, 5)}></calcite-checkbox>
            Clatsop County FIRM Panels
          </calcite-label>
          <calcite-label layout="inline">
            <calcite-checkbox afterCreate={this._checkboxAfterCreate.bind(this, 6)}></calcite-checkbox>
            Columbia County FIRM Panels
          </calcite-label>
        </calcite-block>
        {/* reference layers */}
        <calcite-block heading="Reference Layers" collapsible="">
          <calcite-label layout="inline">
            <calcite-checkbox afterCreate={this._checkboxAfterCreate.bind(this, 20)}></calcite-checkbox>
            County Boundaries
          </calcite-label>
          <calcite-label layout="inline">
            <calcite-checkbox afterCreate={this._checkboxAfterCreate.bind(this, 21)}></calcite-checkbox>
            Sections
          </calcite-label>
          <calcite-label layout="inline">
            <calcite-checkbox afterCreate={this._checkboxAfterCreate.bind(this, 22)}></calcite-checkbox>
            Floodplain Jurisdiction
          </calcite-label>
        </calcite-block>
      </calcite-panel>
    );
  }
}
