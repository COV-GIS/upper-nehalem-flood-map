// imports
import esri = __esri;
import esriRequest from '@arcgis/core/request';
import { subclass, property } from '@arcgis/core/core/accessorSupport/decorators';
import Widget from '@arcgis/core/widgets/Widget';
import { tsx } from '@arcgis/core/widgets/support/widget';

// styles
const CSS = {
  content: 'print-firmette-modal--content',
};

/**
 * Print a FIRMette with a modal UI.
 */
@subclass('PrintFIRMetteModal')
export default class PrintFIRMetteModal extends Widget {
  constructor(properties?: esri.WidgetProperties) {
    super(properties);
    // append to body
    document.body.append(this.container);
  }

  container = document.createElement('calcite-modal') as HTMLCalciteModalElement;

  /**
   * Initiate printing
   * @param point esri.Point
   */
  print(point: esri.Point): void {
    const { container, state } = this;
    if (state !== 'printing') this.state = 'printing';
    this._point = point;
    this._print(point);
    container.active = true;
  }

  @property()
  protected state: 'printing' | 'printed' | 'error' = 'printing';

  private _point!: esri.Point;

  private _printUrl!: string;

  private _print(point: esri.Point): void {
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
        this.state = 'error';
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
          this.state = 'error';
        });
    } else if (data.jobStatus === 'esriJobSucceeded') {
      this._printComplete(response);
    } else {
      console.log('server job error', response);
      this.state = 'error';
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
        this.state = 'printed';
      })
      .catch((error: esri.Error): void => {
        console.log('get job error', error);
        this.state = 'error';
      });
  }

  private _close(): void {
    const { container } = this;
    container.active = false;
    this.state = 'printing';
  }

  render(): tsx.JSX.Element {
    const { state, _printUrl } = this;
    return (
      <calcite-modal width="300" disable-close-button="" disable-escape="" disable-outside-close="">
        <div slot="header">FIRMette</div>
        <div slot="content">
          {/* printing */}
          <div class={CSS.content} hidden={state !== 'printing'}>
            <span>Just one moment while your FIRMette is printing.</span>
            <calcite-loader active="" scale="s"></calcite-loader>
          </div>
          {/* printed */}
          <div class={CSS.content} hidden={state !== 'printed'}>
            <span>Your FIRMette is ready.</span>
            <calcite-button width="full" icon-start="download" href={_printUrl} target="_blank">
              FIRMette
            </calcite-button>
            <calcite-button width="full" appearance="outline" onclick={this._close.bind(this)}>
              Close
            </calcite-button>
          </div>
          {/* error */}
          <div class={CSS.content} hidden={state !== 'error'}>
            <span>An error has occurred.</span>
            <calcite-button width="full" onclick={this.print.bind(this, this._point)}>
              Try Again
            </calcite-button>
            <calcite-button width="full" appearance="outline" onclick={this._close.bind(this)}>
              Close
            </calcite-button>
          </div>
        </div>
      </calcite-modal>
    );
  }
}
