import { Component, ElementRef, AfterViewInit, OnDestroy, ViewChild, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MapService } from '../../services/map.service';
import { CoordinateTransformService } from '../../services/coordinate-transform.service';
import { RoadDataService } from '../../services/road-data.service';
import { PROJECT_LOCATION } from '../../core/constants/map.constants';

@Component({
  selector: 'app-map',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './map.component.html',
  styleUrl: './map.component.scss'
})
export class MapComponent implements AfterViewInit, OnDestroy {
  @ViewChild('mapContainer', { static: true }) mapContainer!: ElementRef<HTMLDivElement>;

  public readonly mapService = inject(MapService);
  public readonly transformService = inject(CoordinateTransformService);
  public readonly roadDataService = inject(RoadDataService);
  public readonly projectLocation = PROJECT_LOCATION;

  public showCalibrationPanel = true;

  ngAfterViewInit(): void {
    if (this.mapContainer?.nativeElement) {
      this.mapService.initializeMap(this.mapContainer.nativeElement);
    }
  }

  ngOnDestroy(): void {
    this.mapService.destroyMap();
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

  public onScaleChange(value: number): void {
    this.transformService.setScale(value);
    this.mapService.refreshCadRoadsOverlay();
  }

  public onRotationChange(value: number): void {
    this.transformService.setRotation(value);
    this.mapService.refreshCadRoadsOverlay();
  }

  public onResetCalibration(): void {
    this.transformService.resetCalibration();
    this.mapService.refreshCadRoadsOverlay();
  }
}
