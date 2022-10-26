import './main.scss';

import esri = __esri;

// esri config and auth
import esriConfig from '@arcgis/core/config';

// map, view and layers
import { whenOnce } from '@arcgis/core/core/reactiveUtils';
import Map from '@arcgis/core/Map';
import MapView from '@arcgis/core/views/MapView';
import Basemap from '@arcgis/core/Basemap';
import MapImageLayer from '@arcgis/core/layers/MapImageLayer';
import FeatureLayer from '@arcgis/core/layers/FeatureLayer';
import SearchViewModel from '@arcgis/core/widgets/Search/SearchViewModel';

import MapApplication, { setCopyright, setDisclaimer, setLogo } from '@vernonia/map-application/dist/MapApplication';

import FloodInfo from './widgets/FloodInfo';
import FloodLayers from './widgets/FloodLayers';
import Legend from '@arcgis/core/widgets/Legend';

import { contains } from '@arcgis/core/geometry/geometryEngine';
import Graphic from '@arcgis/core/Graphic';
import { SimpleMarkerSymbol } from '@arcgis/core/symbols';

import PrintFIRMetteModal from './widgets/PrintFIRMetteModal';

// import { init, queryLocation } from './logic';

// config portal and auth
esriConfig.portalUrl = 'https://gis.vernonia-or.gov/portal';

const load = async (): Promise<void> => {
  const layer = new MapImageLayer({
    portalItem: {
      id: 'c74b5bf6a1cb4be881abe4fc811909bd',
    },
    title: 'Upper Nehalem Flood',
  });

  await layer.load();

  layer.sublayers.forEach((sublayer: esri.Sublayer): void => {
    if (sublayer.title === 'Places') sublayer.legendEnabled = false;
  });

  const boundary = new FeatureLayer({
    url: 'https://gis.vernonia-or.gov/server/rest/services/UpperNehalemFlood/UNF_Base/MapServer/15',
  });

  await boundary.load();

  const query = await boundary.queryFeatures({
    where: '1 = 1',
    returnGeometry: true,
    num: 1,
  });

  const boundaryGeometry = query.features[0].geometry as esri.Polygon;

  // view
  const view = new MapView({
    map: new Map({
      basemap: new Basemap({
        portalItem: {
          id: '6e9f78f3a26f48c89575941141fd4ac3',
        },
      }),
      layers: [layer],
      ground: 'world-elevation',
    }),
    extent: boundary.fullExtent,
    constraints: {
      rotationEnabled: false,
    },
    popup: {
      dockEnabled: true,
      dockOptions: {
        position: 'bottom-left',
        breakpoint: false,
      },
    },
  });

  setCopyright('Upper Nehalem Flood');

  setDisclaimer({
    text: `The purpose of this application is to help the citizens of the Upper Nehalem basin be informed of flood hazards and to be prepared for flood events. Any information herein is for reference only. Upper Nehalem Flood makes every effort to keep this information current and accurate. However, Upper Nehalem Flood is not responsible for errors, misuse, omissions, or misinterpretations. There are no warranties, expressed or implied, including the warranty of merchantability or fitness for a particular purpose, accompanying this application.`,
  });

  setLogo(null);

  const floodInfo = new FloodInfo();

  const searchViewModel = new SearchViewModel({
    view,
    locationEnabled: false,
    popupEnabled: false,
    resultGraphicEnabled: false,
  });

  whenOnce((): number => searchViewModel.defaultSources.length).then((): void => {
    searchViewModel.defaultSources.forEach((source: esri.LayerSearchSource | esri.LocatorSearchSource) => {
      source.placeholder = 'Find address';
      source.filter = {
        geometry: boundaryGeometry,
      };
    });
  });

  const app = new MapApplication({
    contentBehind: true,
    title: 'Upper Nehalem Flood',
    nextBasemap: new Basemap({
      portalItem: {
        id: '2622b9aecacd401583981410e07d5bb9',
      },
    }),
    panelPosition: 'end',
    panelWidgets: [
      {
        widget: floodInfo,
        text: 'Info',
        icon: 'information',
        type: 'calcite-panel',
        open: true,
      },
      {
        widget: new FloodLayers({ layer }),
        text: 'Layers',
        icon: 'layers',
        type: 'calcite-panel',
      },
      {
        widget: new Legend({ view }),
        text: 'Legend',
        icon: 'legend',
        type: 'div',
      },
    ],
    searchViewModel,
    view,
  });

  view.when(() => {
    const printFIRMetteModal = new PrintFIRMetteModal();
    const graphics = view.graphics;
    const ground = view.map.ground;
    let location: esri.Point;

    const queryLocation = async (point: esri.Point): Promise<void> => {
      if (floodInfo.state === 'querying') return;

      floodInfo.state = 'querying';

      graphics.removeAll();

      if (!contains(boundaryGeometry, point)) {
        floodInfo.state = 'ready';
        return;
      }

      location = point;

      graphics.add(
        new Graphic({
          geometry: point,
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

      const queries = layer.sublayers.map(
        (sublayer: esri.Sublayer): Promise<esri.FeatureSet | esri.ElevationQueryResult> => {
          return sublayer.queryFeatures({
            geometry: point,
            outFields: ['*'],
            returnGeometry: false,
          });
        },
      );

      queries.push(ground.queryElevation(point));

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

      const info = {
        latitude: point.latitude.toFixed(5),
        longitude: point.longitude.toFixed(5),
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
        info.zone = `Flood ${zone}`;
        info.description = desc;

        if (county === 'Clatsop County') info.firm = (clatsopFirm as esri.FeatureSet).features[0].attributes.FIRM_PAN;

        if (county === 'Columbia County') info.firm = (columbiaFirm as esri.FeatureSet).features[0].attributes.FIRM_PAN;
      }

      floodInfo.info = info;

      app.showWidget(floodInfo.id);

      setTimeout((): void => {
        floodInfo.state = 'info';
      }, 2000);
    };

    view.on('click', (event: esri.ViewClickEvent): void => {
      queryLocation(event.mapPoint);
    });

    searchViewModel.on('select-result', (event: esri.SearchSelectResultEvent): void => {
      queryLocation(event.result.feature.geometry as esri.Point);
    });

    floodInfo.on('print-firmette', (): void => {
      printFIRMetteModal.print(location);
    });
  });
};

load();
