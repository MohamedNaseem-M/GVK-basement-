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

    // 2. Extract vertical line extents
    const vLineMap: { [x: number]: Array<{ minY: number; maxY: number }> } = {};
    lines.forEach(l => {
      if (Math.abs(l.start[0] - l.end[0]) < 0.01) {
        const x = Number(l.start[0].toFixed(2));
        const minY = Number(Math.min(l.start[1], l.end[1]).toFixed(2));
        const maxY = Number(Math.max(l.start[1], l.end[1]).toFixed(2));
        if (!vLineMap[x]) vLineMap[x] = [];
        vLineMap[x].push({ minY, maxY });
      }
    });

    // 3. Reconstruct plots column by column
    const plots: ReconstructedCadPlot[] = [];

    MASTERPLAN_COLUMNS.forEach(cd => {
      // Collect all horizontal lines crossing or adjacent to this column strip
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
        const py = lbl.position[1];
        const below = allDivisionYs.filter(y => y <= py + 0.05);
        const above = allDivisionYs.filter(y => y >= py - 0.05);
        const yBottom = below.length > 0 ? below[below.length - 1] : py - 4.5;
        const yTop = above.length > 0 ? above[0] : py + 4.5;

        // Form closed 4-corner polygon
        const cadPolygon: Array<[number, number]> = [
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
        const centroid: [number, number] = [
          Number(((cd.leftX + cd.rightX) / 2).toFixed(2)),
          Number(((yBottom + yTop) / 2).toFixed(2))
        ];

        plots.push({
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
