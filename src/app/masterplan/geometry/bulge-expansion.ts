/**
 * Pure mathematical geometry utilities for expanding CAD Bulges and ARCs
 * into continuous 2D coordinate paths.
 */

export interface DxfPoint {
  x: number;
  y: number;
  bulge?: number;
}

/**
 * Mathematically expands LWPOLYLINE vertices containing bulge arc parameters into smooth 2D points.
 * Bulge = tan(theta / 4) where theta is the included angle of the circular arc.
 */
export function expandPolylineBulges(vertices: DxfPoint[], closed: boolean): Array<[number, number]> {
  const points: Array<[number, number]> = [];
  const n = vertices.length;
  if (n === 0) return points;

  for (let i = 0; i < n; i++) {
    const v1 = vertices[i];
    const isLast = i === n - 1;
    if (isLast && !closed) {
      points.push([v1.x, v1.y]);
      break;
    }
    const v2 = isLast ? vertices[0] : vertices[i + 1];
    points.push([v1.x, v1.y]);

    const bulge = v1.bulge || 0;
    if (bulge !== 0) {
      const dx = v2.x - v1.x;
      const dy = v2.y - v1.y;
      const chord = Math.hypot(dx, dy);

      if (chord > 1e-6) {
        const radius = (chord * (1 + bulge * bulge)) / (4 * Math.abs(bulge));
        const sign = bulge > 0 ? 1 : -1;
        const midX = (v1.x + v2.x) / 2;
        const midY = (v1.y + v2.y) / 2;
        const sagitta = Math.abs(bulge) * (chord / 2);
        const distToCenter = radius - sagitta;

        const nx = -dy / chord;
        const ny = dx / chord;
        const centerX = midX + sign * distToCenter * nx;
        const centerY = midY + sign * distToCenter * ny;

        const startAngle = Math.atan2(v1.y - centerY, v1.x - centerX);
        let endAngle = Math.atan2(v2.y - centerY, v2.x - centerX);

        if (sign > 0 && endAngle < startAngle) endAngle += 2 * Math.PI;
        if (sign < 0 && endAngle > startAngle) endAngle -= 2 * Math.PI;

        const steps = Math.max(6, Math.ceil(Math.abs(endAngle - startAngle) / (Math.PI / 12)));
        for (let s = 1; s < steps; s++) {
          const t = s / steps;
          const angle = startAngle + t * (endAngle - startAngle);
          points.push([centerX + radius * Math.cos(angle), centerY + radius * Math.sin(angle)]);
        }
      }
    }
  }

  if (closed && points.length > 0) {
    points.push([points[0][0], points[0][1]]);
  }

  return points;
}

/**
 * Generates interpolated points along a 2D ARC entity.
 */
export function generateArcPoints(
  center: [number, number],
  radius: number,
  startAngleDeg: number,
  endAngleDeg: number
): Array<[number, number]> {
  const points: Array<[number, number]> = [];
  const [cx, cy] = center;

  let startRad = (startAngleDeg * Math.PI) / 180;
  let endRad = (endAngleDeg * Math.PI) / 180;

  if (endRad < startRad) endRad += 2 * Math.PI;

  const steps = Math.max(12, Math.ceil(Math.abs(endRad - startRad) / (Math.PI / 16)));
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const angle = startRad + t * (endRad - startRad);
    points.push([cx + radius * Math.cos(angle), cy + radius * Math.sin(angle)]);
  }

  return points;
}
