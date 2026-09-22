import { Component, ElementRef, AfterViewInit, OnDestroy, ViewChild, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MapService } from '../../services/map.service';
import { MasterPlanRoadService } from '../../masterplan/services/masterplan-road.service';
import { MasterPlanPlotService } from '../../masterplan/services/masterplan-plot.service';
import { PROJECT_LOCATION } from '../../core/constants/map.constants';

@Component({
  selector: 'app-map',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './map.component.html',
  styleUrl: './map.component.scss'
})
export class MapComponent implements AfterViewInit, OnDestroy {
  @ViewChild('mapContainer', { static: true }) mapContainer!: ElementRef<HTMLDivElement>;

  public readonly mapService = inject(MapService);
  public readonly masterPlanRoadService = inject(MasterPlanRoadService);
  public readonly masterPlanPlotService = inject(MasterPlanPlotService);
  public readonly projectLocation = PROJECT_LOCATION;

  ngAfterViewInit(): void {
    if (this.mapContainer?.nativeElement) {
      this.mapService.initializeMap(this.mapContainer.nativeElement);
    }
  }

  ngOnDestroy(): void {
    this.mapService.destroyMap();
  }

  public onToggleViewMode(): void {
    this.mapService.toggleMasterPlanViewMode();
  }

  public onFitMasterPlanRoads(): void {
    this.mapService.fitMasterPlanRoads();
  }

  public onFitMasterPlanPlots(): void {
    this.mapService.fitMasterPlanPlots();
  }

  public onDismissPlotCard(): void {
    this.masterPlanPlotService.clearSelection();
  }

  public onToggle3D(): void {
    this.mapService.toggle3DView();
  }

  public onRecenter(): void {
    this.mapService.flyToProjectLocation();
  }

  public onZoomIn(): void {
    this.mapService.zoomIn();
  }

  public onZoomOut(): void {
    this.mapService.zoomOut();
  }

  public onRetryMap(): void {
    if (this.mapContainer?.nativeElement) {
      this.mapService.initializeMap(this.mapContainer.nativeElement);
    }
  }
}
