/**
 * GVK Enclave - 318-Plot Master Plan Validation & Generation Script
 * Reads CAD linework and labels from src/assets/data/dxf-masterplan-extraction.json,
 * reconstructs the CAD topology, generates src/app/masterplan/data/plots/gvk-plots.geojson,
 * and validates geometry, numbering, areas, and label containment.
 */

const fs = require('fs');
const path = require('path');

const MASTERPLAN_EXTRACTION_PATH = path.resolve(__dirname, '../src/assets/data/dxf-masterplan-extraction.json');
const OUTPUT_GEOJSON_PATH = path.resolve(__dirname, '../src/app/masterplan/data/plots/gvk-plots.geojson');

// Ensure output directory exists
const outputDir = path.dirname(OUTPUT_GEOJSON_PATH);
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

// Calibration anchor for 318 plots (calibrated +12m East to match user approved east_shift_12m alignment)
const PLOT_ANCHOR = {
  longitude: 76.9007270,
  latitude: 15.1268214,
  cadOriginX: 26747.985,
  cadOriginY: 1547.750,
  scaleMetersPerCad: 1.0,
  rotationDegrees: 0.0
};

function cadPlotToWgs84(cadX, cadY) {
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

const MASTERPLAN_COLUMNS = [
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

console.log('====================================================');
console.log('GVK ENCLAVE 318-PLOT MASTER PLAN VALIDATION');
console.log('====================================================');

if (!fs.existsSync(MASTERPLAN_EXTRACTION_PATH)) {
  console.error('ERROR: Source file not found:', MASTERPLAN_EXTRACTION_PATH);
  process.exit(1);
}

const dxfData = JSON.parse(fs.readFileSync(MASTERPLAN_EXTRACTION_PATH, 'utf8'));
const labels = dxfData.plotLabels || [];
const entities = dxfData.numberLayer?.entities || [];
const lines = entities.filter(e => e.entityType === 'LINE');
const polylines = entities.filter(e => e.entityType === 'LWPOLYLINE');

console.log(`Source loaded: ${MASTERPLAN_EXTRACTION_PATH}`);
console.log(`- Plot labels: ${labels.length}`);
console.log(`- LINE entities: ${lines.length}`);
console.log(`- LWPOLYLINE entities: ${polylines.length}`);

// Extract all horizontal dividing lines
const allHLines = [];
lines.forEach(l => {
  if (Math.abs(l.start[1] - l.end[1]) < 0.01) {
    allHLines.push({
      y: l.start[1],
      minX: Math.min(l.start[0], l.end[0]),
      maxX: Math.max(l.start[0], l.end[0])
    });
  }
});

polylines.forEach(p => {
  if (!p.vertices || p.vertices.length < 2) return;
  for (let i = 0; i < p.vertices.length - 1; i++) {
    const y1 = p.vertices[i].y;
    const y2 = p.vertices[i + 1].y;
    if (Math.abs(y1 - y2) < 0.01) {
      allHLines.push({
        y: y1,
        minX: Math.min(p.vertices[i].x, p.vertices[i + 1].x),
        maxX: Math.max(p.vertices[i].x, p.vertices[i + 1].x)
      });
    }
  }
});

// Extract vertical line bounds
const vLineMap = {};
lines.forEach(l => {
  if (Math.abs(l.start[0] - l.end[0]) < 0.01) {
    const x = Number(l.start[0].toFixed(2));
    const minY = Number(Math.min(l.start[1], l.end[1]).toFixed(2));
    const maxY = Number(Math.max(l.start[1], l.end[1]).toFixed(2));
    if (!vLineMap[x]) vLineMap[x] = [];
    vLineMap[x].push({ minY, maxY });
  }
});

// Reconstruct 318 plots
const cadPlots = [];

MASTERPLAN_COLUMNS.forEach(cd => {
  const colHL = allHLines
    .filter(hl => hl.minX <= cd.leftX + 1.0 && hl.maxX >= cd.rightX - 1.0)
    .map(hl => Number(hl.y.toFixed(2)));

  const uniqueHL = Array.from(new Set(colHL)).sort((a, b) => a - b);

  const leftV = vLineMap[cd.leftX] || [];
  const rightV = vLineMap[cd.rightX] || [];
  const allV = [...leftV, ...rightV];
  const vMinYs = allV.map(v => v.minY);
  const vMaxYs = allV.map(v => v.maxY);

  if (vMinYs.length > 0) uniqueHL.push(Math.min(...vMinYs));
  if (vMaxYs.length > 0) uniqueHL.push(Math.max(...vMaxYs));

  if (cd.col === 1) {
    const v56 = vLineMap[26650.87];
    if (v56) v56.forEach(v => { uniqueHL.push(v.minY); uniqueHL.push(v.maxY); });
  }

  const allDivisionYs = Array.from(new Set(uniqueHL.map(y => Number(y.toFixed(2))))).sort((a, b) => a - b);

  const colPlots = labels.filter(l => {
    let bestCol = null;
    let minD = Infinity;
    MASTERPLAN_COLUMNS.forEach(c => {
      const center = (c.leftX + c.rightX) / 2;
      const d = Math.abs(l.position[0] - center);
      if (d < minD) {
        minD = d;
        bestCol = c.col;
      }
    });
    return bestCol === cd.col;
  }).sort((a, b) => a.position[1] - b.position[1]);

  colPlots.forEach(lbl => {
    const py = lbl.position[1];
    const below = allDivisionYs.filter(y => y <= py + 0.05);
    const above = allDivisionYs.filter(y => y >= py - 0.05);
    const yBottom = below.length > 0 ? below[below.length - 1] : py - 4.5;
    const yTop = above.length > 0 ? above[0] : py + 4.5;

    const cadPolygon = [
      [cd.leftX, yBottom],
      [cd.rightX, yBottom],
      [cd.rightX, yTop],
      [cd.leftX, yTop],
      [cd.leftX, yBottom]
    ];

    const frontage = cd.width;
    const depth = Number((yTop - yBottom).toFixed(2));
    const areaSqM = Number((frontage * depth).toFixed(2));
    const areaSqFt = Number((areaSqM * 10.7639).toFixed(1));
    const centroid = [
      Number(((cd.leftX + cd.rightX) / 2).toFixed(2)),
      Number(((yBottom + yTop) / 2).toFixed(2))
    ];

    cadPlots.push({
      plotNumber: lbl.plotNumber,
      handle: lbl.handle,
      col: cd.col,
      block: cd.block,
      frontageM: frontage,
      depthM: depth,
      areaSqM,
      areaSqFt,
      cadCenter: centroid,
      cadPolygon,
      labelPosition: [Number(lbl.position[0].toFixed(2)), Number(lbl.position[1].toFixed(2))]
    });
  });
});

cadPlots.sort((a, b) => a.plotNumber - b.plotNumber);

// Convert to GeoJSON FeatureCollection
const features = cadPlots.map(cp => {
  const wgs84Polygon = cp.cadPolygon.map(pt => cadPlotToWgs84(pt[0], pt[1]));
  const centroidWgs84 = cadPlotToWgs84(cp.cadCenter[0], cp.cadCenter[1]);

  return {
    type: 'Feature',
    id: cp.plotNumber,
    geometry: {
      type: 'Polygon',
      coordinates: [wgs84Polygon]
    },
    properties: {
      plotNumber: cp.plotNumber,
      block: cp.block,
      areaSqM: cp.areaSqM,
      areaSqFt: cp.areaSqFt,
      frontageM: cp.frontageM,
      depthM: cp.depthM,
      dimensions: `${cp.frontageM}m x ${cp.depthM}m`,
      centroidCad: cp.cadCenter,
      centroidWgs84: centroidWgs84,
      sourceHandle: cp.handle,
      geometrySource: 'CAD-DXF-EXTRACT-NUMBER-LAYER',
      status: 'UNKNOWN'
    }
  };
});

const geoJsonCollection = {
  type: 'FeatureCollection',
  name: 'GVK_Enclave_318_Plots',
  crs: {
    type: 'name',
    properties: {
      name: 'urn:ogc:def:crs:OGC:1.3:CRS84'
    }
  },
  features
};

// Write GeoJSON file to src/app/masterplan/data/plots/gvk-plots.geojson
fs.writeFileSync(OUTPUT_GEOJSON_PATH, JSON.stringify(geoJsonCollection, null, 2), 'utf8');
console.log(`Generated GeoJSON saved to: ${OUTPUT_GEOJSON_PATH}`);

// Also ensure public/data/plots/gvk-plots.geojson is synced for static web serving
const publicGeoJsonPath = path.resolve(__dirname, '../public/data/plots/gvk-plots.geojson');
const publicDir = path.dirname(publicGeoJsonPath);
if (!fs.existsSync(publicDir)) {
  fs.mkdirSync(publicDir, { recursive: true });
}
fs.writeFileSync(publicGeoJsonPath, JSON.stringify(geoJsonCollection, null, 2), 'utf8');
console.log(`Synced GeoJSON to public: ${publicGeoJsonPath}`);


// ==========================================
// COMPREHENSIVE VALIDATION SUITE
// ==========================================
console.log('\n--- RUNNING VALIDATION CHECKS ---');

// 1. Total Count
const totalPlots = features.length;
console.log(`Total plots reconstructed: ${totalPlots} (Expected: 318)`);
const countValid = totalPlots === 318;

// 2. Plot Number Range & Missing Numbers
const plotNumbers = features.map(f => f.properties.plotNumber).sort((a, b) => a - b);
const missingNumbers = [];
for (let i = 1; i <= 318; i++) {
  if (!plotNumbers.includes(i)) {
    missingNumbers.push(i);
  }
}
console.log(`Missing numbers count: ${missingNumbers.length}`);
if (missingNumbers.length > 0) {
  console.log(`Missing plot numbers: ${missingNumbers.join(', ')}`);
}

// 3. Duplicate Numbers
const numberOccurrences = {};
plotNumbers.forEach(n => {
  numberOccurrences[n] = (numberOccurrences[n] || 0) + 1;
});
const duplicateNumbers = Object.keys(numberOccurrences).filter(k => numberOccurrences[k] > 1);
console.log(`Duplicate numbers count: ${duplicateNumbers.length}`);
if (duplicateNumbers.length > 0) {
  console.log(`Duplicate numbers: ${duplicateNumbers.join(', ')}`);
}

// 4. Invalid Polygons (Closed ring check & minimum vertices)
let invalidPolygons = 0;
features.forEach(f => {
  const coords = f.geometry.coordinates[0];
  if (!coords || coords.length < 4) {
    invalidPolygons++;
    return;
  }
  const first = coords[0];
  const last = coords[coords.length - 1];
  if (Math.abs(first[0] - last[0]) > 1e-7 || Math.abs(first[1] - last[1]) > 1e-7) {
    invalidPolygons++;
  }
});
console.log(`Invalid polygons count: ${invalidPolygons}`);

// 5. Self-intersections check (using cross product direction changes on 4-sided polygon)
let selfIntersections = 0;
features.forEach(f => {
  const coords = f.geometry.coordinates[0];
  // 4 unique vertices (5 points with closing point)
  if (coords.length !== 5) {
    selfIntersections++;
    return;
  }
  // Check that edges don't cross diagonally
  function ccw(p1, p2, p3) {
    return (p3[1] - p1[1]) * (p2[0] - p1[0]) > (p2[1] - p1[1]) * (p3[0] - p1[0]);
  }
  function intersect(p1, p2, p3, p4) {
    return ccw(p1, p3, p4) !== ccw(p2, p3, p4) && ccw(p1, p2, p3) !== ccw(p1, p2, p4);
  }
  // Edges (0-1) and (2-3) should not intersect; edges (1-2) and (3-4) should not intersect
  if (intersect(coords[0], coords[1], coords[2], coords[3])) selfIntersections++;
  if (intersect(coords[1], coords[2], coords[3], coords[4])) selfIntersections++;
});
console.log(`Self-intersections count: ${selfIntersections}`);

// 6. Zero or negative area plots
const zeroAreaPlots = features.filter(f => f.properties.areaSqM <= 0);
console.log(`Zero or negative area plots: ${zeroAreaPlots.length}`);

// 7. Area statistics
const areasSqM = features.map(f => f.properties.areaSqM).sort((a, b) => a - b);
const minArea = areasSqM[0];
const maxArea = areasSqM[areasSqM.length - 1];
const totalAreaSqM = Number(areasSqM.reduce((sum, a) => sum + a, 0).toFixed(2));
const totalAreaSqFt = Number((totalAreaSqM * 10.7639).toFixed(1));
console.log(`Min Area: ${minArea} m² (${(minArea * 10.7639).toFixed(1)} sq.ft)`);
console.log(`Max Area: ${maxArea} m² (${(maxArea * 10.7639).toFixed(1)} sq.ft)`);
console.log(`Total Area: ${totalAreaSqM} m² (${totalAreaSqFt} sq.ft)`);

// 8. Bounding Box
let minLng = Infinity, maxLng = -Infinity, minLat = Infinity, maxLat = -Infinity;
features.forEach(f => {
  f.geometry.coordinates[0].forEach(([lng, lat]) => {
    if (lng < minLng) minLng = lng;
    if (lng > maxLng) maxLng = lng;
    if (lat < minLat) minLat = lat;
    if (lat > maxLat) maxLat = lat;
  });
});
console.log(`Geographic BBox: [${minLng}, ${minLat}, ${maxLng}, ${maxLat}]`);
console.log(`BBox Width (meters approx): ${((maxLng - minLng) * 107462.6).toFixed(1)} m`);
console.log(`BBox Height (meters approx): ${((maxLat - minLat) * 110600.0).toFixed(1)} m`);

// 9. Label Containment check
let labelsContained = 0;
cadPlots.forEach(cp => {
  const lx = cp.labelPosition[0];
  const ly = cp.labelPosition[1];
  const minX = Math.min(...cp.cadPolygon.map(p => p[0]));
  const maxX = Math.max(...cp.cadPolygon.map(p => p[0]));
  const minY = Math.min(...cp.cadPolygon.map(p => p[1]));
  const maxY = Math.max(...cp.cadPolygon.map(p => p[1]));

  if (lx >= minX - 0.5 && lx <= maxX + 0.5 && ly >= minY - 0.5 && ly <= maxY + 0.5) {
    labelsContained++;
  }
});
console.log(`Labels contained inside polygon: ${labelsContained} / ${totalPlots}`);

// Final Result Summary
const isValid =
  countValid &&
  missingNumbers.length === 0 &&
  duplicateNumbers.length === 0 &&
  invalidPolygons === 0 &&
  selfIntersections === 0 &&
  zeroAreaPlots.length === 0 &&
  labelsContained === 318;

console.log('====================================================');
if (isValid) {
  console.log('✅ ALL VALIDATIONS PASSED: 318 PLOTS AUTHORITATIVE DATASET READY');
  console.log('====================================================');
  process.exit(0);
} else {
  console.error('❌ VALIDATION FAILED');
  console.log('====================================================');
  process.exit(1);
}
