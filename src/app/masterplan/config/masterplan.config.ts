/**
 * GVK Enclave Master Plan Configuration & Single Unified Coordinate Reference System
 * All Master Plan subsystems (Roads, Plots, Parks, Sites, Amenities) share this exact coordinate framework.
 */

export interface MasterPlanProjectAnchor {
  longitude: number;
  latitude: number;
  cadOriginX: number;
  cadOriginY: number;
  scaleMetersPerCad: number;
  rotationDegrees: number;
}

export const MASTERPLAN_ANCHOR: MasterPlanProjectAnchor = {
  // Real-world project anchor in Ballari, Karnataka
  longitude: 76.901774,
  latitude: 15.1267357,

  // Local CAD Coordinate System Origin (CAD center of extracted road network)
  cadOriginX: 27109.35,
  cadOriginY: 1721.155,

  // Baseline calibration parameters
  scaleMetersPerCad: 1.0,
  rotationDegrees: 0.0
};

export const MASTERPLAN_ROAD_STYLES = {
  // Professional real-estate master plan aesthetics
  asphaltSurfaceColor: '#232731', // Dark asphalt / slate (#232731 / #1e293b)
  asphaltOpacity: 0.98,
  curbBorderColor: '#94a3b8',    // Crisp lighter curb edge for clear master plan definition
  curbBorderWidth: 3.5,
  curbBorderOpacity: 0.98,
  centerlineColor: '#64748b',    // Pavement divider line
  centerlineWidth: 2.0,
  centerlineOpacity: 0.90,
  labelColor: '#ffffff',
  labelHaloColor: '#0f172a',
  labelHaloWidth: 3.0
};

export const MASTERPLAN_CANVAS_STYLES = {
  // Neutral architectural canvas for independent master plan verification
  neutralBackground: '#0f172a',
  gridLineColor: 'rgba(255, 255, 255, 0.08)',
  gridSpacingMeters: 20
};

export const MASTERPLAN_PLOT_ANCHOR: MasterPlanProjectAnchor = {
  // Real-world project anchor in Ballari, Karnataka (calibrated +12m East to match east_shift_12m alignment)
  longitude: 76.9007270,
  latitude: 15.1268214,

  // Local CAD Coordinate System Origin for the 318-plot master plan drawing
  cadOriginX: 26747.985,
  cadOriginY: 1547.750,

  // Baseline calibration parameters
  scaleMetersPerCad: 1.0,
  rotationDegrees: 0.0
};

export const MASTERPLAN_PLOT_STYLES = {
  // Warm cream / beige fill for master plan plots
  fillColor: '#fef3c7',
  fillOpacity: 0.88,

  // Thin dark boundary
  borderColor: '#334155',
  borderWidth: 1.2,
  borderOpacity: 0.95,

  // Selected plot highlighting
  selectedFillColor: '#bae6fd',
  selectedFillOpacity: 0.95,
  selectedBorderColor: '#0284c7',
  selectedBorderWidth: 2.5,

  // Dark plot number labels with white halo
  labelColor: '#0f172a',
  labelHaloColor: '#ffffff',
  labelHaloWidth: 2.5,
  labelSize: 11
};

