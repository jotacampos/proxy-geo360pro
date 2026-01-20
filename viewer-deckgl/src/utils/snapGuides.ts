/**
 * Snap Guides Utility
 *
 * Generates orthogonal guide lines during drawing operations.
 * Similar to ol-ext SnapGuides interaction.
 */

import type { SnapGuide } from '../types';

// Type for line segment
type LineSegment = [[number, number], [number, number]];

/**
 * Generate a unique ID for a guide
 */
function generateGuideId(type: string, index: number): string {
  return `guide-${type}-${index}-${Date.now()}`;
}

/**
 * Normalize a vector to unit length
 */
function normalize(dx: number, dy: number): [number, number] {
  const len = Math.sqrt(dx * dx + dy * dy);
  if (len === 0) return [0, 0];
  return [dx / len, dy / len];
}

/**
 * Calculate intersection point of two infinite lines
 * Each line is defined by an origin point and a direction vector
 * Returns null if lines are parallel
 */
export function lineIntersection(
  origin1: [number, number],
  dir1: [number, number],
  origin2: [number, number],
  dir2: [number, number]
): [number, number] | null {
  const det = dir1[0] * dir2[1] - dir1[1] * dir2[0];

  // Parallel lines (or same line)
  if (Math.abs(det) < 1e-10) {
    return null;
  }

  const dx = origin2[0] - origin1[0];
  const dy = origin2[1] - origin1[1];

  const t = (dx * dir2[1] - dy * dir2[0]) / det;

  return [
    origin1[0] + t * dir1[0],
    origin1[1] + t * dir1[1]
  ];
}

/**
 * Extend a guide line to cover the viewport
 * Returns a line segment that spans the visible area
 */
export function extendGuideToViewport(
  guide: SnapGuide,
  viewportBounds: { minLon: number; maxLon: number; minLat: number; maxLat: number }
): LineSegment {
  const { origin, direction } = guide;

  // Calculate a large enough distance to cover the viewport
  const viewWidth = viewportBounds.maxLon - viewportBounds.minLon;
  const viewHeight = viewportBounds.maxLat - viewportBounds.minLat;
  const maxDist = Math.sqrt(viewWidth * viewWidth + viewHeight * viewHeight) * 2;

  // Extend line in both directions
  const p1: [number, number] = [
    origin[0] - direction[0] * maxDist,
    origin[1] - direction[1] * maxDist
  ];
  const p2: [number, number] = [
    origin[0] + direction[0] * maxDist,
    origin[1] + direction[1] * maxDist
  ];

  return [p1, p2];
}

/**
 * Generate snap guides from a list of coordinates (current drawing)
 *
 * Creates:
 * - Horizontal guide through first point
 * - Vertical guide through first point
 * - Parallel guide along last segment
 * - Orthogonal guide perpendicular to last segment
 */
export function generateSnapGuides(
  coordinates: [number, number][],
  enableInitialGuides: boolean = true
): SnapGuide[] {
  const guides: SnapGuide[] = [];

  if (coordinates.length === 0) {
    return guides;
  }

  const firstPoint = coordinates[0];
  const lastPoint = coordinates[coordinates.length - 1];

  // Initial guides through first point (horizontal and vertical)
  if (enableInitialGuides && coordinates.length >= 1) {
    // Horizontal guide
    guides.push({
      id: generateGuideId('horizontal', 0),
      origin: firstPoint,
      direction: [1, 0],
      type: 'horizontal'
    });

    // Vertical guide
    guides.push({
      id: generateGuideId('vertical', 0),
      origin: firstPoint,
      direction: [0, 1],
      type: 'vertical'
    });
  }

  // If we have at least 2 points, add parallel and orthogonal guides
  if (coordinates.length >= 2) {
    const prevPoint = coordinates[coordinates.length - 2];

    const dx = lastPoint[0] - prevPoint[0];
    const dy = lastPoint[1] - prevPoint[1];

    // Skip if points are too close (avoid division by zero)
    if (Math.abs(dx) > 1e-10 || Math.abs(dy) > 1e-10) {
      const [nx, ny] = normalize(dx, dy);

      // Parallel guide (along the direction of last segment)
      guides.push({
        id: generateGuideId('parallel', 0),
        origin: lastPoint,
        direction: [nx, ny],
        type: 'parallel'
      });

      // Orthogonal guide (perpendicular to last segment - rotate 90 degrees)
      guides.push({
        id: generateGuideId('orthogonal', 0),
        origin: lastPoint,
        direction: [-ny, nx],  // Perpendicular
        type: 'orthogonal'
      });

      // Also add orthogonal guide through first point
      if (coordinates.length >= 2) {
        guides.push({
          id: generateGuideId('orthogonal', 1),
          origin: firstPoint,
          direction: [-ny, nx],
          type: 'orthogonal'
        });
      }
    }
  }

  return guides;
}

/**
 * Find the nearest point on a guide line to a given coordinate
 */
export function nearestPointOnGuide(
  coord: [number, number],
  guide: SnapGuide
): [number, number] {
  const { origin, direction } = guide;

  // Project coord onto the line: p_proj = origin + t * direction
  // where t = dot(coord - origin, direction)
  const dx = coord[0] - origin[0];
  const dy = coord[1] - origin[1];

  const t = dx * direction[0] + dy * direction[1];

  return [
    origin[0] + t * direction[0],
    origin[1] + t * direction[1]
  ];
}

/**
 * Calculate distance from a point to a guide line
 */
export function distanceToGuide(
  coord: [number, number],
  guide: SnapGuide
): number {
  const nearest = nearestPointOnGuide(coord, guide);
  const dx = coord[0] - nearest[0];
  const dy = coord[1] - nearest[1];
  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Find all intersection points between guides
 */
export function findGuideIntersections(guides: SnapGuide[]): [number, number][] {
  const intersections: [number, number][] = [];

  for (let i = 0; i < guides.length; i++) {
    for (let j = i + 1; j < guides.length; j++) {
      const intersection = lineIntersection(
        guides[i].origin,
        guides[i].direction,
        guides[j].origin,
        guides[j].direction
      );

      if (intersection) {
        intersections.push(intersection);
      }
    }
  }

  return intersections;
}

/**
 * Snap result for guides
 */
export interface GuideSnapResult {
  point: [number, number];
  distance: number;
  type: 'guide' | 'intersection';
  guide?: SnapGuide;
}

/**
 * Find the best snap point from guides (either on a guide or at intersection)
 */
export function findGuideSnap(
  coord: [number, number],
  guides: SnapGuide[],
  thresholdDegrees: number
): GuideSnapResult | null {
  if (guides.length === 0) return null;

  let bestGuide: GuideSnapResult | null = null;
  let bestIntersection: GuideSnapResult | null = null;

  // Check guide lines
  for (const guide of guides) {
    const nearest = nearestPointOnGuide(coord, guide);
    const dist = Math.sqrt(
      Math.pow(coord[0] - nearest[0], 2) +
      Math.pow(coord[1] - nearest[1], 2)
    );

    if (dist < thresholdDegrees && (!bestGuide || dist < bestGuide.distance)) {
      bestGuide = {
        point: nearest,
        distance: dist,
        type: 'guide',
        guide
      };
    }
  }

  // Check intersections - they get ABSOLUTE priority when close enough
  const intersections = findGuideIntersections(guides);
  for (const intersection of intersections) {
    const dist = Math.sqrt(
      Math.pow(coord[0] - intersection[0], 2) +
      Math.pow(coord[1] - intersection[1], 2)
    );

    // Use a larger threshold for intersections (1.5x) since they're more valuable
    if (dist < thresholdDegrees * 1.5 && (!bestIntersection || dist < bestIntersection.distance)) {
      bestIntersection = {
        point: intersection,
        distance: dist,
        type: 'intersection'
      };
    }
  }

  // Intersections have priority over guide lines when within threshold
  // This ensures we snap to the precise intersection point
  if (bestIntersection && bestIntersection.distance < thresholdDegrees * 1.5) {
    return bestIntersection;
  }

  return bestGuide;
}

/**
 * Extract coordinates from a tentative feature during drawing
 */
export function extractTentativeCoordinates(geometry: any): [number, number][] {
  if (!geometry) return [];

  switch (geometry.type) {
    case 'Point':
      return [geometry.coordinates as [number, number]];
    case 'LineString':
      return geometry.coordinates as [number, number][];
    case 'Polygon':
      // Return outer ring (first ring) without the closing point
      const ring = geometry.coordinates[0] as [number, number][];
      // Remove last point if it's the same as first (closing point)
      if (ring.length > 1 &&
          ring[0][0] === ring[ring.length - 1][0] &&
          ring[0][1] === ring[ring.length - 1][1]) {
        return ring.slice(0, -1);
      }
      return ring;
    default:
      return [];
  }
}
