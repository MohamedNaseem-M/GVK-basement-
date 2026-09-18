import { Component, ElementRef, AfterViewInit, OnDestroy, ViewChild, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MapService } from '../../services/map.service';
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
  public readonly projectLocation = PROJECT_LOCATION;

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
}
