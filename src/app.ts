import './main.scss';

import esri = __esri;

// esri config and auth
import esriConfig from '@arcgis/core/config';

// map, view and layers
import Map from '@arcgis/core/Map';
import MapView from '@arcgis/core/views/MapView';
import Basemap from '@arcgis/core/Basemap';
import MapImageLayer from '@arcgis/core/layers/MapImageLayer';
import FeatureLayer from '@arcgis/core/layers/FeatureLayer';

// // layout
// import Layout from '@vernonia/core/dist/Layout';
// import '@vernonia/core/dist/Layout.css';

// // widgets
// import Measure from '@vernonia/core/dist/widgets/Measure';
// import '@vernonia/core/dist/widgets/Measure.css';

// import PrintSnapshot from '@vernonia/core/dist/widgets/PrintSnapshot';
// import '@vernonia/core/dist/widgets/Snapshot.css';

import FloodMapApp from './FloodMapApp';

// config portal and auth
esriConfig.portalUrl = 'https://gis.vernonia-or.gov/portal';

// app config and init loading screen
const title = 'Vernonia';

const load = async () => {
  const base = new MapImageLayer({
    url: 'https://gis.vernonia-or.gov/server/rest/services/UpperNehalemFlood/UNF_Base/MapServer',
  });

  const boundary = new FeatureLayer({
    url: 'https://gis.vernonia-or.gov/server/rest/services/UpperNehalemFlood/UNF_Base/MapServer/1',
  });

  await boundary.load();

  const query = await boundary.queryFeatures({
    where: '1 = 1',
    returnGeometry: true,
    num: 1,
  });

  const boundaryGeometry = query.features[0].geometry;

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
    boundary: boundaryGeometry as esri.Polygon,
  });
};

load();

// new Layout({
//   view,
//   loaderOptions: {
//     title,
//   },
//   mapHeadingOptions: {
//     title,
//     logoUrl: 'city_logo_small_white.svg',
//   },
//   uiWidgets: [
//     {
//       widget: new Measure({ view }),
//       text: 'Measure',
//       icon: 'measure',
//     },
//     {
//       widget: new PrintSnapshot({ view, printServiceUrl: '' }),
//       text: 'Print',
//       icon: 'print',
//     },
//   ],
// });

// view.when(() => { });
