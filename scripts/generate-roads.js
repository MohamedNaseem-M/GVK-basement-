/**
 * GVK Enclave - Authoritative Road Master Plan Reconstruction Script
 * 
 * Reconstructs exact road corridors (9M, 12M), curbs, centerlines, labels,
 * and amenities matching Reference Image 2 and the DXF source data.
 * Outputs:
 * - src/app/masterplan/data/roads/gvk-roads.geojson
 * - src/app/masterplan/data/roads/gvk-roads.data.ts
 * - src/app/masterplan/data/roads/gvk-road-labels.data.ts
 * - public/data/roads/gvk-roads.geojson
 */

const fs = require('fs');
const path = require('path');

const DXF_ROAD_PATH = path.resolve(__dirname, '../src/assets/data/dxf-road-extraction.json');
const DXF_MASTERPLAN_PATH = path.resolve(__dirname, '../src/assets/data/dxf-masterplan-extraction.json');

const OUTPUT_ROADS_GEOJSON = path.resolve(__dirname, '../src/app/masterplan/data/roads/gvk-roads.geojson');
const OUTPUT_ROADS_TS = path.resolve(__dirname, '../src/app/masterplan/data/roads/gvk-roads.data.ts');
const OUTPUT_LABELS_TS = path.resolve(__dirname, '../src/app/masterplan/data/roads/gvk-road-labels.data.ts');
const PUBLIC_ROADS_GEOJSON = path.resolve(__dirname, '../public/data/roads/gvk-roads.geojson');

const dxfRoadData = JSON.parse(fs.readFileSync(DXF_ROAD_PATH, 'utf8'));

// Single Unified Master Plan Similarity Transformation
const PLOT_ANCHOR = {
  longitude: 76.9007270,
  latitude: 15.1268214,
  cadOriginX: 26747.985,
  cadOriginY: 1547.750,
  scaleMetersPerCad: 1.0,
  rotationDegrees: 0.0
};

function cadToWgs84(cadX, cadY) {
  const dx = cadX - PLOT_ANCHOR.cadOriginX;
  const dy = cadY - PLOT_ANCHOR.cadOriginY;
  const s = PLOT_ANCHOR.scaleMetersPerCad;
  const rotRad = (PLOT_ANCHOR.rotationDegrees * Math.PI) / 180;

  const eastMeters = s * (dx * Math.cos(rotRad) - dy * Math.sin(rotRad));
  const northMeters = s * (dx * Math.sin(rotRad) + dy * Math.cos(rotRad));

  const baseLatRad = (PLOT_ANCHOR.latitude * Math.PI) / 180;
  const metersPerDegLat = 110600.0;
  const metersPerDegLng = 111320.0 * Math.cos(baseLatRad);

  const lng = PLOT_ANCHOR.longitude + (eastMeters / metersPerDegLng);
  const lat = PLOT_ANCHOR.latitude + (northMeters / metersPerDegLat);

  return [Number(lng.toFixed(7)), Number(lat.toFixed(7))];
}

// Master Plan Columns from CAD
const COLUMNS = [
  { col: 1, leftX: 26638.87, rightX: 26650.87, width: 12.00, block: 'Block A' },
  { col: 2, leftX: 26659.87, rightX: 26671.87, width: 12.00, block: 'Block B' },
  { col: 3, leftX: 26671.87, rightX: 26683.87, width: 12.00, block: 'Block B' },
  { col: 4, leftX: 26692.87, rightX: 26704.87, width: 12.00, block: 'Block C' },
  { col: 5, leftX: 26704.87, rightX: 26718.07, width: 13.20, block: 'Block C' },
  { col: 6, leftX: 26730.07, rightX: 26742.07, width: 12.00, block: 'Block D' },
  { col: 7, leftX: 26742.07, rightX: 26754.07, width: 12.00, block: 'Block D' },
  { col: 8, leftX: 26763.07, rightX: 26775.07, width: 12.00, block: 'Block E' },
  { col: 9, leftX: 26775.07, rightX: 26787.07, width: 12.00, block: 'Block E' },
  { col: 10, leftX: 26796.07, rightX: 26808.07, width: 12.00, block: 'Block F' },
  { col: 11, leftX: 26808.07, rightX: 26820.07, width: 12.00, block: 'Block F' },
  { col: 12, leftX: 26829.07, rightX: 26840.97, width: 11.90, block: 'Block G' }
];

// Southern boundary slope: y = m * x + c
function southY(x) {
  return Number((-0.172856 * x + 6027.0307).toFixed(2));
}

const Y_MID_UPPER = 1513.33; // North edge of horizontal 12m road
const Y_MID_LOWER = 1501.29; // South edge of horizontal 12m road
const Y_TOP_COLS_1_5 = 1659.93; // Top of cols 1-5
const Y_TOP_COLS_6_11 = 1690.93; // Top of cols 6-11
const Y_TOP_ROAD_NORTH = 1699.93; // North edge of top 9m road
const X_WEST_BOUNDARY = 26625.30;
const X_EAST_ENTRY = 26870.67;

// Build road corridor features
const roadFeatures = [];
const labelFeatures = [];

// 1. Central Horizontal 12 Meter Road
const central12mCad = [
  [X_WEST_BOUNDARY, Y_MID_LOWER],
  [X_EAST_ENTRY, Y_MID_LOWER],
  [X_EAST_ENTRY, Y_MID_UPPER],
  [X_WEST_BOUNDARY, Y_MID_UPPER],
  [X_WEST_BOUNDARY, Y_MID_LOWER]
];

roadFeatures.push({
  type: 'Feature',
  id: 'ROAD_12M_CENTRAL',
  geometry: {
    type: 'Polygon',
    coordinates: [central12mCad.map(p => cadToWgs84(p[0], p[1]))]
  },
  properties: {
    handle: 'ROAD_12M_CENTRAL',
    roadType: 'PROP_ROAD',
    width: '12M',
    label: '12 Meter Road',
    isCorridor: true,
    layer: 'PROP_ROAD'
  }
});

// Central 12M Road Label
labelFeatures.push({
  type: 'Feature',
  geometry: {
    type: 'Point',
    coordinates: cadToWgs84(26748.0, 1507.31)
  },
  properties: {
    handle: 'LBL_12M_CENTRAL',
    text: '12 Meter Road',
    width: '12M',
    rotationDeg: 0
  }
});

// 2. Top Horizontal 9 Meter Road
const top9mCad = [
  [COLUMNS[5].leftX, Y_TOP_COLS_6_11],
  [COLUMNS[10].rightX, Y_TOP_COLS_6_11],
  [COLUMNS[10].rightX, Y_TOP_ROAD_NORTH],
  [COLUMNS[5].leftX, Y_TOP_ROAD_NORTH],
  [COLUMNS[5].leftX, Y_TOP_COLS_6_11]
];

roadFeatures.push({
  type: 'Feature',
  id: 'ROAD_9M_TOP',
  geometry: {
    type: 'Polygon',
    coordinates: [top9mCad.map(p => cadToWgs84(p[0], p[1]))]
  },
  properties: {
    handle: 'ROAD_9M_TOP',
    roadType: 'ROAD_9MAB',
    width: '9M',
    label: '9 Meter Road',
    isCorridor: true,
    layer: 'Road_9MAB'
  }
});

labelFeatures.push({
  type: 'Feature',
  geometry: {
    type: 'Point',
    coordinates: cadToWgs84(26775.0, 1695.43)
  },
  properties: {
    handle: 'LBL_9M_TOP',
    text: '9 Meter Road',
    width: '9M',
    rotationDeg: 0
  }
});

// 3. Vertical Avenues
const avenues = [
  {
    id: 'AVE_WEST',
    name: 'West Access Road',
    leftX: X_WEST_BOUNDARY,
    rightX: COLUMNS[0].leftX,
    width: '9M',
    label: '9 Meter Road',
    yTop: Y_TOP_COLS_1_5
  },
  {
    id: 'AVE_1',
    name: 'Avenue 1',
    leftX: COLUMNS[0].rightX,
    rightX: COLUMNS[1].leftX,
    width: '9M',
    label: '9 Meter Road',
    yTop: Y_TOP_COLS_1_5
  },
  {
    id: 'AVE_2',
    name: 'Avenue 2',
    leftX: COLUMNS[2].rightX,
    rightX: COLUMNS[3].leftX,
    width: '9M',
    label: '9 Meter Road',
    yTop: Y_TOP_COLS_1_5
  },
  {
    id: 'AVE_3_CENTRAL',
    name: 'Avenue 3 (Central 12M)',
    leftX: COLUMNS[4].rightX,
    rightX: COLUMNS[5].leftX,
    width: '12M',
    label: '12 Meter Road',
    yTop: Y_TOP_ROAD_NORTH
  },
  {
    id: 'AVE_4',
    name: 'Avenue 4',
    leftX: COLUMNS[6].rightX,
    rightX: COLUMNS[7].leftX,
    width: '9M',
    label: '9 Meter Road',
    yTop: Y_TOP_COLS_6_11
  },
  {
    id: 'AVE_5',
    name: 'Avenue 5',
    leftX: COLUMNS[8].rightX,
    rightX: COLUMNS[9].leftX,
    width: '9M',
    label: '9 Meter Road',
    yTop: Y_TOP_COLS_6_11
  },
  {
    id: 'AVE_6',
    name: 'Avenue 6',
    leftX: COLUMNS[10].rightX,
    rightX: COLUMNS[11].leftX,
    width: '9M',
    label: '9 Meter Road',
    yTop: Y_TOP_COLS_6_11
  },
  {
    id: 'AVE_EAST',
    name: 'East Access Road',
    leftX: COLUMNS[11].rightX,
    rightX: 26849.97,
    width: '9M',
    label: '9 Meter Road',
    yTop: 1630.00
  }
];

avenues.forEach(ave => {
  const lx = ave.leftX;
  const rx = ave.rightX;
  const cx = (lx + rx) / 2;

  // Upper Corridor
  const upperCad = [
    [lx, Y_MID_UPPER],
    [rx, Y_MID_UPPER],
    [rx, ave.yTop],
    [lx, ave.yTop],
    [lx, Y_MID_UPPER]
  ];

  roadFeatures.push({
    type: 'Feature',
    id: `${ave.id}_UPPER`,
    geometry: {
      type: 'Polygon',
      coordinates: [upperCad.map(p => cadToWgs84(p[0], p[1]))]
    },
    properties: {
      handle: `${ave.id}_UPPER`,
      roadType: ave.width === '12M' ? 'PROP_ROAD' : 'ROAD_9MAB',
      width: ave.width,
      label: ave.label,
      isCorridor: true,
      layer: ave.width === '12M' ? 'PROP_ROAD' : 'Road_9MAB'
    }
  });

  // Upper Label
  if (ave.id !== 'AVE_WEST') {
    labelFeatures.push({
      type: 'Feature',
      geometry: {
        type: 'Point',
        coordinates: cadToWgs84(cx, (Y_MID_UPPER + ave.yTop) / 2)
      },
      properties: {
        handle: `LBL_${ave.id}_UPPER`,
        text: ave.label,
        width: ave.width,
        rotationDeg: 90
      }
    });
  }

  // Lower Corridor
  const syL = southY(lx) - 9.0;
  const syR = southY(rx) - 9.0;
  const lowerCad = [
    [lx, syL],
    [rx, syR],
    [rx, Y_MID_LOWER],
    [lx, Y_MID_LOWER],
    [lx, syL]
  ];

  roadFeatures.push({
    type: 'Feature',
    id: `${ave.id}_LOWER`,
    geometry: {
      type: 'Polygon',
      coordinates: [lowerCad.map(p => cadToWgs84(p[0], p[1]))]
    },
    properties: {
      handle: `${ave.id}_LOWER`,
      roadType: ave.width === '12M' ? 'PROP_ROAD' : 'ROAD_9MAB',
      width: ave.width,
      label: ave.label,
      isCorridor: true,
      layer: ave.width === '12M' ? 'PROP_ROAD' : 'Road_9MAB'
    }
  });

  // Lower Label
  if (ave.id !== 'AVE_WEST') {
    labelFeatures.push({
      type: 'Feature',
      geometry: {
        type: 'Point',
        coordinates: cadToWgs84(cx, (Y_MID_LOWER + (syL + syR) / 2) / 2)
      },
      properties: {
        handle: `LBL_${ave.id}_LOWER`,
        text: ave.label,
        width: ave.width,
        rotationDeg: 90
      }
    });
  }
});

// 4. Southern Boundary Corridor
const southRoadCad = [
  [X_WEST_BOUNDARY, southY(X_WEST_BOUNDARY) - 9.0],
  [26849.97, southY(26849.97) - 9.0],
  [26849.97, southY(26849.97)],
  [X_WEST_BOUNDARY, southY(X_WEST_BOUNDARY)],
  [X_WEST_BOUNDARY, southY(X_WEST_BOUNDARY) - 9.0]
];

roadFeatures.push({
  type: 'Feature',
  id: 'ROAD_SOUTH_CONNECTION',
  geometry: {
    type: 'Polygon',
    coordinates: [southRoadCad.map(p => cadToWgs84(p[0], p[1]))]
  },
  properties: {
    handle: 'ROAD_SOUTH_CONNECTION',
    roadType: 'ROAD_9MAB',
    width: '9M',
    label: '9 Meter Road',
    isCorridor: true,
    layer: 'Road_9MAB'
  }
});

// 5. Master Plan Amenities: Parks, CA Site, ENTRY
const amenities = [
  {
    id: 'PARK_TOP_LEFT',
    name: 'Park',
    type: 'PARK',
    cadPolygon: [
      [X_WEST_BOUNDARY, Y_TOP_COLS_1_5],
      [COLUMNS[4].rightX, Y_TOP_COLS_1_5],
      [26748.00, 1720.00],
      [X_WEST_BOUNDARY, 1715.00],
      [X_WEST_BOUNDARY, Y_TOP_COLS_1_5]
    ],
    labelPos: [26675.0, 1685.0],
    rotation: 0
  },
  {
    id: 'PARK_TOP_CENTER',
    name: 'Park',
    type: 'PARK',
    cadPolygon: [
      [COLUMNS[5].leftX, Y_TOP_ROAD_NORTH],
      [COLUMNS[10].rightX, Y_TOP_ROAD_NORTH],
      [COLUMNS[10].rightX, 1735.00],
      [26748.00, 1720.00],
      [COLUMNS[5].leftX, Y_TOP_ROAD_NORTH]
    ],
    labelPos: [26785.0, 1718.0],
    rotation: 0
  },
  {
    id: 'PARK_TOP_RIGHT',
    name: 'Park',
    type: 'PARK',
    cadPolygon: [
      [26849.97, 1630.00],
      [X_EAST_ENTRY, 1630.00],
      [X_EAST_ENTRY, 1730.00],
      [26849.97, 1735.00],
      [26849.97, 1630.00]
    ],
    labelPos: [26860.0, 1680.0],
    rotation: 90
  },
  {
    id: 'CA_SITE',
    name: 'CA Site',
    type: 'CA_SITE',
    cadPolygon: [
      [COLUMNS[11].leftX, Y_MID_UPPER],
      [X_EAST_ENTRY, Y_MID_UPPER],
      [X_EAST_ENTRY, 1630.00],
      [COLUMNS[11].leftX, 1630.00],
      [COLUMNS[11].leftX, Y_MID_UPPER]
    ],
    labelPos: [26849.87, 1571.66],
    rotation: 90
  },
  {
    id: 'ENTRY',
    name: 'ENTRY',
    type: 'ENTRY',
    cadPolygon: [
      [26858.67, Y_MID_LOWER],
      [X_EAST_ENTRY, Y_MID_LOWER],
      [X_EAST_ENTRY, Y_MID_UPPER],
      [26858.67, Y_MID_UPPER],
      [26858.67, Y_MID_LOWER]
    ],
    labelPos: [26864.67, 1507.31],
    rotation: 0
  },
  {
    id: 'PARK_BOTTOM_RIGHT',
    name: 'Park',
    type: 'PARK',
    cadPolygon: [
      [26849.97, southY(26849.97)],
      [X_EAST_ENTRY, southY(26849.97)],
      [X_EAST_ENTRY, Y_MID_LOWER],
      [26849.97, Y_MID_LOWER],
      [26849.97, southY(26849.97)]
    ],
    labelPos: [26860.0, 1430.0],
    rotation: 90
  }
];

amenities.forEach(am => {
  roadFeatures.push({
    type: 'Feature',
    id: am.id,
    geometry: {
      type: 'Polygon',
      coordinates: [am.cadPolygon.map(p => cadToWgs84(p[0], p[1]))]
    },
    properties: {
      handle: am.id,
      roadType: am.type,
      width: 'N/A',
      label: am.name,
      isAmenity: true,
      amenityType: am.type,
      layer: am.type
    }
  });

  labelFeatures.push({
    type: 'Feature',
    geometry: {
      type: 'Point',
      coordinates: cadToWgs84(am.labelPos[0], am.labelPos[1])
    },
    properties: {
      handle: `LBL_${am.id}`,
      text: am.name,
      width: am.type,
      isAmenityLabel: true,
      rotationDeg: am.rotation
    }
  });
});

// Also include the 67 DXF entities from dxf-road-extraction.json
// transformed to WGS84 so all DXF linework is preserved
const rawEntities = dxfRoadData.entities || [];
rawEntities.forEach(ent => {
  const pts = ent.vertices || [];
  if (pts.length < 2) return;
  const wgsCoords = pts.map(p => cadToWgs84(p.x, p.y));
  
  if (ent.closed && wgsCoords.length >= 4) {
    roadFeatures.push({
      type: 'Feature',
      id: `DXF_${ent.handle}`,
      geometry: {
        type: 'Polygon',
        coordinates: [wgsCoords]
      },
      properties: {
        handle: ent.handle,
        roadType: ent.layer,
        width: '9M',
        label: ent.handle,
        isDxfEntity: true,
        layer: ent.layer
      }
    });
  } else {
    roadFeatures.push({
      type: 'Feature',
      id: `DXF_${ent.handle}`,
      geometry: {
        type: 'LineString',
        coordinates: wgsCoords
      },
      properties: {
        handle: ent.handle,
        roadType: ent.layer,
        width: '9M',
        label: ent.handle,
        isDxfEntity: true,
        layer: ent.layer
      }
    });
  }
});

const finalRoadGeoJson = {
  type: 'FeatureCollection',
  name: 'GVK_Enclave_Road_Masterplan',
  crs: {
    type: 'name',
    properties: {
      name: 'urn:ogc:def:crs:OGC:1.3:CRS84'
    }
  },
  features: roadFeatures
};

const finalLabelsGeoJson = {
  type: 'FeatureCollection',
  features: labelFeatures
};

// Write GeoJSON files
fs.writeFileSync(OUTPUT_ROADS_GEOJSON, JSON.stringify(finalRoadGeoJson, null, 2), 'utf8');
fs.writeFileSync(PUBLIC_ROADS_GEOJSON, JSON.stringify(finalRoadGeoJson, null, 2), 'utf8');

// Write TypeScript modules
const tsContent = `import { MasterPlanRoadGeoJsonCollection } from '../../models/road-masterplan.model';\n\nexport const GVK_ROADS_GEOJSON: MasterPlanRoadGeoJsonCollection = ${JSON.stringify(finalRoadGeoJson, null, 2)};\n`;
fs.writeFileSync(OUTPUT_ROADS_TS, tsContent, 'utf8');

const labelsTsContent = `import { MasterPlanRoadLabelCollection } from '../../models/road-masterplan.model';\n\nexport const GVK_ROAD_LABELS_GEOJSON: MasterPlanRoadLabelCollection = ${JSON.stringify(finalLabelsGeoJson, null, 2)};\n`;
fs.writeFileSync(OUTPUT_LABELS_TS, labelsTsContent, 'utf8');

console.log(`Generated ${roadFeatures.length} road & amenity features and ${labelFeatures.length} road labels.`);
console.log(`Saved to ${OUTPUT_ROADS_GEOJSON} and ${PUBLIC_ROADS_GEOJSON}`);
