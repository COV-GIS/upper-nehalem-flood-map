import './main.scss';

import esri = __esri;
import esriConfig from '@arcgis/core/config';
import Map from '@arcgis/core/Map';
import MapView from '@arcgis/core/views/MapView';
import Basemap from '@arcgis/core/Basemap';
import MapImageLayer from '@arcgis/core/layers/MapImageLayer';
import FeatureLayer from '@arcgis/core/layers/FeatureLayer';
import FloodMapApp from './FloodMapApp';

// config portal and auth
esriConfig.portalUrl = 'https://gis.vernonia-or.gov/portal';

const load = async () => {
  const base = new MapImageLayer({
    portalItem: {
      id: 'c74b5bf6a1cb4be881abe4fc811909bd',
    },
    title: 'Upper Nehalem Flood',
  });

  const boundary = new FeatureLayer({
    url: 'https://gis.vernonia-or.gov/server/rest/services/UpperNehalemFlood/UNF_Base/MapServer/15',
  });

  await boundary.load();

  const boundaryGeometry = (await boundary.queryFeatures({
    where: '1 = 1',
    returnGeometry: true,
    num: 1,
  })).features[0].geometry as esri.Polygon;

  // view
  const view = new MapView({
    map: new Map({
      basemap: new Basemap({
        portalItem: {
          id: '6e9f78f3a26f48c89575941141fd4ac3',
        },
      }),
      layers: [base],
      ground: 'world-elevation',
    }),
    extent: boundary.fullExtent,
    padding: {
      left: 48,
    },
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

  new FloodMapApp({
    view,
    nextBasemap: new Basemap({
      portalItem: {
        id: '2622b9aecacd401583981410e07d5bb9',
      },
    }),
    boundary: boundaryGeometry,
    baseLayer: base,
  });
};

load();
