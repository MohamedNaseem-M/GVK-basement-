import { Injectable, signal, WritableSignal } from '@angular/core';
import {
  DxfMasterPlanExtractionJson,
  MasterPlanRoadCorridor,
  MasterPlanSummary,
  ReconstructedPlot
} from '../core/models/masterplan.model';

import rawMasterPlanData from '../../assets/data/dxf-masterplan-extraction.json';

@Injectable({
  providedIn: 'root'
})
export class MasterPlanDataService {
  public readonly rawJsonData: DxfMasterPlanExtractionJson = (rawMasterPlanData as unknown) as DxfMasterPlanExtractionJson;

  public readonly summary: WritableSignal<MasterPlanSummary | null> = signal(null);
  public readonly testPlots: WritableSignal<ReconstructedPlot[]> = signal([]);
  public readonly roadCorridors: WritableSignal<MasterPlanRoadCorridor[]> = signal([]);
  public readonly selectedPlot: WritableSignal<ReconstructedPlot | null> = signal(null);
  public readonly isLoaded: WritableSignal<boolean> = signal(false);

  // Master Plan CAD Center Extents
  public readonly cadCenter: [number, number] = [26747.985, 1547.750];
  public readonly cadExtent: [number, number, number, number] = [
    26625.30378475205,
    1377.730929270862,
    26870.67179474037,
    1717.770578268116
  ];

  constructor() {
    this.parseAndReconstructTestDataset();
  }

  /**
   * Validates master plan extraction and reconstructs test plots (Plots 1 to 20)
   */
  private parseAndReconstructTestDataset(): void {
    if (this.rawJsonData.summary) {
      this.summary.set(this.rawJsonData.summary);
    }

    const plots = this.reconstructBlock1Plots();
    const corridors = this.constructBlock1RoadCorridors();

    this.testPlots.set(plots);
    this.roadCorridors.set(corridors);
    this.isLoaded.set(true);
  }

  /**
   * Reconstructs exact CAD boundary polygons for Plots 1–20 (Block 1)
   */
  private reconstructBlock1Plots(): ReconstructedPlot[] {
    const plots: ReconstructedPlot[] = [];

    // Block 1 East bounds (Plots 1–19)
    const xEastMin = 26808.07156526901;
    const xEastMax = 26820.07156526901;

    // Block 1 West bounds (Plot 20 & Plots 21–38)
    const xWestMin = 26796.07156526901;
    const xWestMax = 26808.07156526901;

    // Exact horizontal line Y boundaries for Block 1 East (Plots 1–19)
    const yDividers = [
      1690.932768879974, // North edge of Plot 1
      1678.332768879974, // Divider between 1 and 2
      1669.332768879974, // Divider between 2 and 3
      1660.332768879974, // Divider between 3 and 4
      1651.332768879974, // Divider between 4 and 5
      1642.332768879974, // Divider between 5 and 6
      1633.332768879974, // Divider between 6 and 7
      1624.332768879974, // Divider between 7 and 8
      1615.332768879974, // Divider between 8 and 9
      1606.332768879974, // Divider between 9 and 10
      1597.332768879974, // Divider between 10 and 11
      1588.332768879974, // Divider between 11 and 12
      1579.332768879974, // Divider between 12 and 13
      1570.332768879974, // Divider between 13 and 14
      1561.332768879974, // Divider between 14 and 15
      1552.332768879974, // Divider between 15 and 16
      1543.332768879974, // Divider between 16 and 17
      1534.332768879974, // Divider between 17 and 18
      1525.332768879974, // Divider between 18 and 19
      1513.332768879973  // South edge of Plot 19 (12m Road corridor divider)
    ];

    // Plots 1 to 19 (East facing)
    for (let i = 0; i < 19; i++) {
      const plotNum = i + 1;
      const yTop = yDividers[i];
      const yBottom = yDividers[i + 1];
      const width = xEastMax - xEastMin;
      const height = yTop - yBottom;
      const areaSqM = Number((width * height).toFixed(1));
      const areaSqFt = Number((areaSqM * 10.7639).toFixed(0));

      plots.push({
        plotNumber: plotNum,
        block: 'Block 1 East',
        dimensions: `${width.toFixed(1)}m × ${height.toFixed(1)}m`,
        areaSqM,
        areaSqFt,
        cadPolygon: [
          [xEastMin, yBottom],
          [xEastMax, yBottom],
          [xEastMax, yTop],
          [xEastMin, yTop],
          [xEastMin, yBottom]
        ],
        cadCenter: [(xEastMin + xEastMax) / 2, (yBottom + yTop) / 2],
        isTestSubset: true
      });
    }

    // Plot 20 (West facing, corner plot at south end of north section)
    const p20YBottom = 1513.332768879973;
    const p20YTop = 1525.332768879974;
    const p20Width = xWestMax - xWestMin;
    const p20Height = p20YTop - p20YBottom;
    const p20AreaSqM = Number((p20Width * p20Height).toFixed(1));
    const p20AreaSqFt = Number((p20AreaSqM * 10.7639).toFixed(0));

    plots.push({
      plotNumber: 20,
      block: 'Block 1 West',
      dimensions: `${p20Width.toFixed(1)}m × ${p20Height.toFixed(1)}m`,
      areaSqM: p20AreaSqM,
      areaSqFt: p20AreaSqFt,
      cadPolygon: [
        [xWestMin, p20YBottom],
        [xWestMax, p20YBottom],
        [xWestMax, p20YTop],
        [xWestMin, p20YTop],
        [xWestMin, p20YBottom]
      ],
      cadCenter: [(xWestMin + xWestMax) / 2, (p20YBottom + p20YTop) / 2],
      isTestSubset: true
    });

    return plots;
  }

  /**
   * Constructs the authentic CAD road corridors framing Block 1
   */
  private constructBlock1RoadCorridors(): MasterPlanRoadCorridor[] {
    const corridors: MasterPlanRoadCorridor[] = [];

    // East 9M Road Corridor (along east side of Plots 1–19)
    // X from 26820.07 to 26829.07 (width = 9.00m)
    corridors.push({
      name: '9M Road (East Corridor)',
      widthMeters: 9.0,
      type: 'corridor',
      cadPolygon: [
        [26820.07156526901, 1501.29],
        [26829.07156526901, 1501.29],
        [26829.07156526901, 1699.93],
        [26820.07156526901, 1699.93],
        [26820.07156526901, 1501.29]
      ]
    });

    // West 9M Road Corridor (along west side of Block 1)
    // X from 26787.07 to 26796.07 (width = 9.00m)
    corridors.push({
      name: '9M Road (West Corridor)',
      widthMeters: 9.0,
      type: 'corridor',
      cadPolygon: [
        [26787.07156526901, 1501.29],
        [26796.07156526901, 1501.29],
        [26796.07156526901, 1699.93],
        [26787.07156526901, 1699.93],
        [26787.07156526901, 1501.29]
      ]
    });

    // South 12M Main Cross-Road Corridor (dividing North and South halves)
    // Y from 1501.29 to 1513.33 (width = 12.04m)
    corridors.push({
      name: '12M Main Road (Central Corridor)',
      widthMeters: 12.04,
      type: 'corridor',
      cadPolygon: [
        [26787.07156526901, 1501.292768879973],
        [26829.07156526901, 1501.292768879973],
        [26829.07156526901, 1513.332768879973],
        [26787.07156526901, 1513.332768879973],
        [26787.07156526901, 1501.292768879973]
      ]
    });

    // North 9M Road Corridor (along north side of Block 1)
    // Y from 1690.93 to 1699.93 (width = 9.00m)
    corridors.push({
      name: '9M Road (North Corridor)',
      widthMeters: 9.0,
      type: 'corridor',
      cadPolygon: [
        [26787.07156526901, 1690.932768879974],
        [26829.07156526901, 1690.932768879974],
        [26829.07156526901, 1699.932768879974],
        [26787.07156526901, 1699.932768879974],
        [26787.07156526901, 1690.932768879974]
      ]
    });

    return corridors;
  }

  public selectPlot(plotNumber: number | null): void {
    if (plotNumber === null) {
      this.selectedPlot.set(null);
      return;
    }
    const plot = this.testPlots().find(p => p.plotNumber === plotNumber) || null;
    this.selectedPlot.set(plot);
  }

  public getPlotByNumber(plotNumber: number): ReconstructedPlot | null {
    return this.testPlots().find(p => p.plotNumber === plotNumber) || null;
  }
}
