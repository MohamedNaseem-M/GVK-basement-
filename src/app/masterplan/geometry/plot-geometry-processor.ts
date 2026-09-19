import {
  MasterPlanPlotFeature,
  MasterPlanPlotGeoJsonCollection,
  PlotFeatureProperties
} from '../models/plot-masterplan.model';

export interface ColumnDefinition {
  col: number;
  leftX: number;
  rightX: number;
  width: number;
  block: string;
}

export const MASTERPLAN_COLUMNS: ColumnDefinition[] = [
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

export interface ReconstructedCadPlot {
  plotNumber: number;
  handle: string;
  col: number;
  block: string;
  frontageM: number;
  depthM: number;
  areaSqM: number;
  areaSqFt: number;
  cadCenter: [number, number];
  cadPolygon: Array<[number, number]>;
  labelPosition: [number, number];
}

// Southern boundary line termination: y = m * x + c
// Mathematically determined by the 6 collinear termination points of the block dividing lines
export const SOUTH_BOUNDARY_SLOPE = -0.172856;
export const SOUTH_BOUNDARY_INTERCEPT = 6027.0307;

export function getSouthBoundaryY(x: number): number {
  return Number((SOUTH_BOUNDARY_SLOPE * x + SOUTH_BOUNDARY_INTERCEPT).toFixed(2));
}

// Authoritative block top terminations from CAD geometry:
// Blocks A, B, C (cols 1-5): terminate at y = 1659.93
// Blocks D, E, F (cols 6-11): terminate at y = 1690.93
// Block G (col 12): terminates at y = 1501.29
export const TOP_BOUNDS: { [col: number]: number } = {
  1: 1659.93,
  2: 1659.93,
  3: 1659.93,
  4: 1659.93,
  5: 1659.93,
  6: 1690.93,
  7: 1690.93,
  8: 1690.93,
  9: 1690.93,
  10: 1690.93,
  11: 1690.93,
  12: 1501.29
};

export const BOTTOM_PLOTS = new Set([318, 310, 293, 292, 273, 272, 253, 252, 231, 230, 207, 206]);

function computePolygonGeometry(pts: Array<[number, number]>): { areaSqM: number; centroid: [number, number] } {
  const n = pts.length - 1;
  let area = 0;
  let cx = 0;
  let cy = 0;
  for (let i = 0; i < n; i++) {
    const x0 = pts[i][0];
    const y0 = pts[i][1];
    const x1 = pts[i + 1][0];
    const y1 = pts[i + 1][1];
    const cross = x0 * y1 - x1 * y0;
    area += cross;
    cx += (x0 + x1) * cross;
    cy += (y0 + y1) * cross;
  }
  const signedArea = area / 2;
  const centroidX = Number((cx / (6 * (signedArea === 0 ? 1 : signedArea))).toFixed(2));
  const centroidY = Number((cy / (6 * (signedArea === 0 ? 1 : signedArea))).toFixed(2));
  return {
    areaSqM: Number(Math.abs(signedArea).toFixed(2)),
    centroid: [centroidX, centroidY]
  };
}

export class PlotGeometryProcessor {
  /**
   * Mathematically reconstructs all 318 plots from raw CAD extraction data.
   */
  public static reconstructCadPlots(dxfExtraction: any): ReconstructedCadPlot[] {
    const labels: Array<{ plotNumber: number; position: [number, number]; handle: string }> =
      dxfExtraction.plotLabels || [];
    const numberEntities: any[] = dxfExtraction.numberLayer?.entities || [];

    const lines = numberEntities.filter(e => e.entityType === 'LINE');
    const polylines = numberEntities.filter(e => e.entityType === 'LWPOLYLINE');

    // 1. Extract all horizontal lines from LINEs and LWPOLYLINEs
    const allHLines: Array<{ y: number; minX: number; maxX: number }> = [];
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

    // 2. Reconstruct plots column by column
    const plots: ReconstructedCadPlot[] = [];

    MASTERPLAN_COLUMNS.forEach(cd => {
      const topLimit = TOP_BOUNDS[cd.col];
      const colHL = allHLines
        .filter(hl => hl.minX <= cd.leftX + 1.0 && hl.maxX >= cd.rightX - 1.0)
        .map(hl => Number(hl.y.toFixed(2)))
        .filter(y => y <= topLimit + 0.05);

      const uniqueHL = Array.from(new Set(colHL)).sort((a, b) => a - b);
      if (!uniqueHL.includes(topLimit)) {
        uniqueHL.push(topLimit);
        uniqueHL.sort((a, b) => a - b);
      }

      // Find labels belonging to this column
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
        const pnum = lbl.plotNumber;
        const py = lbl.position[1];
        let cadPolygon: Array<[number, number]> = [];
        let depth = 0;
        let areaSqM = 0;
        let centroid: [number, number] = [0, 0];

        if (BOTTOM_PLOTS.has(pnum)) {
          // Southern boundary trapezoidal termination matching CAD linework
          const above = uniqueHL.filter(y => y >= py - 0.05);
          const yTop = above.length > 0 ? above[0] : py + 4.5;
          const yBottomLeft = getSouthBoundaryY(cd.leftX);
          const yBottomRight = getSouthBoundaryY(cd.rightX);

          cadPolygon = [
            [cd.leftX, yBottomLeft],
            [cd.rightX, yBottomRight],
            [cd.rightX, yTop],
            [cd.leftX, yTop],
            [cd.leftX, yBottomLeft]
          ];
          depth = Number((yTop - (yBottomLeft + yBottomRight) / 2).toFixed(2));
          const geom = computePolygonGeometry(cadPolygon);
          areaSqM = geom.areaSqM;
          centroid = geom.centroid;
        } else {
          // Standard rectangular plot
          const below = uniqueHL.filter(y => y <= py + 0.05);
          const above = uniqueHL.filter(y => y >= py - 0.05);
          const yBottom = below.length > 0 ? below[below.length - 1] : py - 4.5;
          const yTop = above.length > 0 ? above[0] : py + 4.5;

          cadPolygon = [
            [cd.leftX, yBottom],
            [cd.rightX, yBottom],
            [cd.rightX, yTop],
            [cd.leftX, yTop],
            [cd.leftX, yBottom]
          ];
          depth = Number((yTop - yBottom).toFixed(2));
          const geom = computePolygonGeometry(cadPolygon);
          areaSqM = geom.areaSqM;
          centroid = geom.centroid;
        }

        const areaSqFt = Number((areaSqM * 10.7639).toFixed(1));

        plots.push({
          plotNumber: pnum,
          handle: lbl.handle,
          col: cd.col,
          block: cd.block,
          frontageM: cd.width,
          depthM: depth,
          areaSqM,
          areaSqFt,
          cadCenter: centroid,
          cadPolygon,
          labelPosition: [Number(lbl.position[0].toFixed(2)), Number(lbl.position[1].toFixed(2))]
        });
      });
    });

    return plots.sort((a, b) => a.plotNumber - b.plotNumber);
  }

  /**
   * Converts reconstructed CAD plots into standard WGS84 GeoJSON FeatureCollection.
   */
  public static toGeoJson(
    cadPlots: ReconstructedCadPlot[],
    transformCoord: (cadX: number, cadY: number) => [number, number]
  ): MasterPlanPlotGeoJsonCollection {
    const features: MasterPlanPlotFeature[] = cadPlots.map(cp => {
      const wgs84Polygon = cp.cadPolygon.map(pt => transformCoord(pt[0], pt[1]));
      const centroidWgs84 = transformCoord(cp.cadCenter[0], cp.cadCenter[1]);

      const properties: PlotFeatureProperties = {
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
      };

      return {
        type: 'Feature',
        id: cp.plotNumber,
        geometry: {
          type: 'Polygon',
          coordinates: [wgs84Polygon]
        },
        properties
      };
    });

    return {
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
  }
}
