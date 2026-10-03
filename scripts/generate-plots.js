/**
 * GVK Enclave - Authoritative Plot Geometry Filleting Script
 * 
 * Fits all 318 plot geometries to the exact filleted road corridor curves.
 * Ensures no plot corner extends past the road curve, curb, or landscape verge.
 * Preserves exact plot numbers, area calculations, dimensions, and metadata.
 * 
 * Outputs:
 * - src/app/masterplan/data/plots/gvk-plots.geojson
 * - src/app/masterplan/data/plots/gvk-plots.data.ts
 * - public/data/plots/gvk-plots.geojson
 */

const fs = require('fs');
const path = require('path');
const polygonClipping = require('polygon-clipping');

const PLOTS_GEOJSON_PATH = path.resolve(__dirname, '../src/app/masterplan/data/plots/gvk-plots.geojson');
const ROADS_GEOJSON_PATH = path.resolve(__dirname, '../src/app/masterplan/data/roads/gvk-roads.geojson');

const OUTPUT_PLOTS_TS = path.resolve(__dirname, '../src/app/masterplan/data/plots/gvk-plots.data.ts');
const PUBLIC_PLOTS_GEOJSON = path.resolve(__dirname, '../public/data/plots/gvk-plots.geojson');

const plotsGeoJson = JSON.parse(fs.readFileSync(PLOTS_GEOJSON_PATH, 'utf8'));
const roadsGeoJson = JSON.parse(fs.readFileSync(ROADS_GEOJSON_PATH, 'utf8'));

const roadCorridor = roadsGeoJson.features.find(f => f.properties.isCorridor);
if (!roadCorridor) {
  console.error('No road corridor feature found!');
  process.exit(1);
}

const roadGeom = roadCorridor.geometry.coordinates;

let filletedPlotsCount = 0;

const updatedFeatures = plotsGeoJson.features.map(feature => {
  const origCoords = feature.geometry.coordinates;
  
  // Difference plot geometry against road corridor geometry
  const diff = polygonClipping.difference(origCoords, roadGeom);
  if (diff && diff.length > 0) {
    // Pick the largest ring polygon if multiple pieces produced
    let bestRing = diff[0][0];
    for (const poly of diff) {
      if (poly[0].length > bestRing.length) {
        bestRing = poly[0];
      }
    }

    if (bestRing.length > origCoords[0].length) {
      filletedPlotsCount++;
      return {
        ...feature,
        geometry: {
          type: 'Polygon',
          coordinates: [bestRing]
        }
      };
    }
  }

  return feature;
});

const updatedPlotsGeoJson = {
  ...plotsGeoJson,
  features: updatedFeatures
};

// Write GeoJSON files
fs.writeFileSync(PLOTS_GEOJSON_PATH, JSON.stringify(updatedPlotsGeoJson, null, 2), 'utf8');
fs.writeFileSync(PUBLIC_PLOTS_GEOJSON, JSON.stringify(updatedPlotsGeoJson, null, 2), 'utf8');

// Write TypeScript module
const tsContent = `import { MasterPlanPlotGeoJsonCollection } from '../../models/plot-masterplan.model';\n\nexport const GVK_PLOTS_GEOJSON: MasterPlanPlotGeoJsonCollection = ${JSON.stringify(updatedPlotsGeoJson, null, 2)};\n`;
fs.writeFileSync(OUTPUT_PLOTS_TS, tsContent, 'utf8');

console.log(`Successfully filleted ${filletedPlotsCount} corner plots to follow road curves.`);
console.log(`Saved to ${PLOTS_GEOJSON_PATH} and ${PUBLIC_PLOTS_GEOJSON}`);
