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
  // Deep charcoal with subtle blue/navy undertone matching IMAGE 2
  asphaltSurfaceColor: '#171d28',
  asphaltOpacity: 0.98,
  curbBorderColor: '#cbd5e1',    // Crisp light gray/silver curb border
  curbBorderWidth: 3.5,
  curbBorderOpacity: 0.98,
  centerlineColor: '#cbd5e1',
  centerlineWidth: 1.5,
  centerlineOpacity: 0.85,
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
  // Warm cream / golden-beige tone matching IMAGE 2 (Target Masterplan Color)
  fillColor: '#fdf3e3',
  fillOpacity: 0.98,

  // Subtle dark boundary line
  borderColor: '#1e293b',
  borderWidth: 1.3,
  borderOpacity: 1.0,

  // Selected plot highlighting (Warm golden/amber transparent overlay & glowing border)
  selectedFillColor: '#fef08a',
  selectedFillOpacity: 0.35,
  selectedBorderColor: '#d97706',
  selectedBorderWidth: 3.2,

  // Dark navy/charcoal plot numbers with white contrast halo
  labelColor: '#0f172a',
  labelHaloColor: '#ffffff',
  labelHaloWidth: 1.8,
  labelSize: 13
};

export const MASTERPLAN_AMENITY_STYLES = {
  parkFill: '#15803d',           // Rich natural green
  parkBorder: '#14532d',         // Deep dark green border
  caSiteFill: '#ecdba8',         // Warm natural sandy/cream tone
  caSiteBorder: '#a39063',       // Crisp subtle sand border
  entryFill: '#0284c7',          // Vibrant cyan/blue portal accent
  entryBorder: '#0369a1'         // Crisp dark blue border
};

