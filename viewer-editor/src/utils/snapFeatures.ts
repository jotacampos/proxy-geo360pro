/**
 * Snap Features Utility
 *
 * Functions for snapping to existing feature vertices and edges.
 */

import type { Feature, Geometry } from 'geojson';
import type { Edge, SnapResult, SnapMode } from '../types/snap';

/**
 * Extract all vertices from a geometry
 */
export function extractVertices(geometry: Geometry | null): [number, number][] {
  const vertices: [number, number][] = [];

  if (!geometry) return vertices;

  switch (geometry.type) {
    case 'Point':
      vertices.push(geometry.coordinates as [number, number]);
      break;
    case 'MultiPoint':
    case 'LineString':
      vertices.push(...(geometry.coordinates as [number, number][]));
      break;
    case 'MultiLineString':
    case 'Polygon':
      for (const ring of geometry.coordinates) {
        vertices.push(...(ring as [number, number][]));
      }
      break;
    case 'MultiPolygon':
      for (const polygon of geometry.coordinates) {
        for (const ring of polygon) {
          vertices.push(...(ring as [number, number][]));
        }
      }
      break;
    case 'GeometryCollection':
      for (const geom of geometry.geometries) {
        vertices.push(...extractVertices(geom));
      }
      break;
  }

  return vertices;
}

/**
 * Extract all edges (line segments) from a geometry
 */
export function extractEdges(geometry: Geometry | null): Edge[] {
  const edges: Edge[] = [];

  if (!geometry) return edges;

  const addEdgesFromRing = (ring: [number, number][]) => {
    for (let i = 0; i < ring.length - 1; i++) {
      edges.push([ring[i], ring[i + 1]]);
    }
  };

  switch (geometry.type) {
    case 'LineString':
      addEdgesFromRing(geometry.coordinates as [number, number][]);
      break;
    case 'MultiLineString':
      for (const line of geometry.coordinates) {
        addEdgesFromRing(line as [number, number][]);
      }
      break;
    case 'Polygon':
      for (const ring of geometry.coordinates) {
        addEdgesFromRing(ring as [number, number][]);
      }
      break;
    case 'MultiPolygon':
      for (const polygon of geometry.coordinates) {
        for (const ring of polygon) {
          addEdgesFromRing(ring as [number, number][]);
        }
      }
      break;
    case 'GeometryCollection':
      for (const geom of geometry.geometries) {
        edges.push(...extractEdges(geom));
      }
      break;
  }

  return edges;
}

/**
 * Extract vertices from multiple features
 */
export function extractVerticesFromFeatures(features: Feature[]): [number, number][] {
  const vertices: [number, number][] = [];
  for (const feature of features) {
    if (feature?.geometry) {
      vertices.push(...extractVertices(feature.geometry));
    }
  }
  return vertices;
}

/**
 * Extract edges from multiple features
 */
export function extractEdgesFromFeatures(features: Feature[]): Edge[] {
  const edges: Edge[] = [];
  for (const feature of features) {
    if (feature?.geometry) {
      edges.push(...extractEdges(feature.geometry));
    }
  }
  return edges;
}

/**
 * Calculate distance between two points
 */
export function distance(p1: [number, number], p2: [number, number]): number {
  return Math.sqrt(
    Math.pow(p1[0] - p2[0], 2) + Math.pow(p1[1] - p2[1], 2)
  );
}

/**
 * Find nearest point on a line segment
 * Returns the closest point on segment [p1, p2] to point p
 */
export function nearestPointOnSegment(
  p: [number, number],
  p1: [number, number],
  p2: [number, number]
): [number, number] {
  const dx = p2[0] - p1[0];
  const dy = p2[1] - p1[1];

  // If segment is a point
  if (dx === 0 && dy === 0) {
    return p1;
  }

  // Calculate projection parameter t
  // t = 0 -> closest to p1, t = 1 -> closest to p2
  const t = Math.max(0, Math.min(1,
    ((p[0] - p1[0]) * dx + (p[1] - p1[1]) * dy) / (dx * dx + dy * dy)
  ));

  return [
    p1[0] + t * dx,
    p1[1] + t * dy
  ];
}

/**
 * Find nearest snap point (vertex or edge) based on mode
 */
export function findNearestSnap(
  coord: [number, number],
  vertices: [number, number][],
  edges: Edge[],
  thresholdDegrees: number,
  mode: SnapMode = 'both'
): SnapResult | null {
  let best: SnapResult | null = null;

  // Check vertices if mode allows
  if (mode === 'vertex' || mode === 'both') {
    for (const vertex of vertices) {
      const dist = distance(coord, vertex);
      if (dist < thresholdDegrees && (!best || dist < best.distance)) {
        best = {
          point: vertex,
          distance: dist,
          type: 'vertex',
        };
      }
    }
  }

  // Check edges if mode allows
  if (mode === 'edge' || mode === 'both') {
    for (const edge of edges) {
      const nearestOnEdge = nearestPointOnSegment(coord, edge[0], edge[1]);
      const dist = distance(coord, nearestOnEdge);

      // Skip if this point is too close to a vertex (vertex takes priority when mode is 'both')
      if (mode === 'both') {
        const distToV1 = distance(nearestOnEdge, edge[0]);
        const distToV2 = distance(nearestOnEdge, edge[1]);
        const vertexThreshold = thresholdDegrees * 0.3; // 30% of threshold for vertex priority

        if (distToV1 < vertexThreshold || distToV2 < vertexThreshold) {
          continue; // Let vertex snap handle this
        }
      }

      const distanceFactor = mode === 'both' ? 0.9 : 1; // Edge needs to be 10% closer in 'both' mode
      if (dist < thresholdDegrees && (!best || dist < best.distance * distanceFactor)) {
        best = {
          point: nearestOnEdge,
          distance: dist,
          type: 'edge',
          edge: edge,
        };
      }
    }
  }

  return best;
}

/**
 * Apply snap to a single coordinate
 */
export function applySnapToCoord(
  coord: [number, number],
  vertices: [number, number][],
  edges: Edge[],
  thresholdDegrees: number,
  mode: SnapMode
): [number, number] {
  const snap = findNearestSnap(coord, vertices, edges, thresholdDegrees, mode);
  return snap ? snap.point : coord;
}

/**
 * Apply snap to a geometry's coordinates recursively
 */
export function applySnapToGeometry(
  geometry: Geometry,
  vertices: [number, number][],
  edges: Edge[],
  thresholdDegrees: number,
  mode: SnapMode
): Geometry {
  const snapCoord = (c: [number, number]) =>
    applySnapToCoord(c, vertices, edges, thresholdDegrees, mode);

  switch (geometry.type) {
    case 'Point':
      return {
        ...geometry,
        coordinates: snapCoord(geometry.coordinates as [number, number]),
      };
    case 'LineString':
    case 'MultiPoint':
      return {
        ...geometry,
        coordinates: (geometry.coordinates as [number, number][]).map(snapCoord),
      };
    case 'Polygon':
    case 'MultiLineString':
      return {
        ...geometry,
        coordinates: geometry.coordinates.map((ring: any) =>
          ring.map(snapCoord)
        ),
      };
    case 'MultiPolygon':
      return {
        ...geometry,
        coordinates: geometry.coordinates.map((polygon: any) =>
          polygon.map((ring: any) => ring.map(snapCoord))
        ),
      };
    default:
      return geometry;
  }
}

/**
 * Calculate snap threshold in degrees based on zoom level and pixel threshold
 */
export function calculateSnapThreshold(
  zoom: number,
  latitude: number,
  snapPixels: number
): number {
  const metersPerPixel = 156543.03392 * Math.cos(latitude * Math.PI / 180) / Math.pow(2, zoom);
  const thresholdMeters = snapPixels * metersPerPixel;
  return thresholdMeters / 111000; // Approximate degrees
}

/**
 * Calculate viewport bounds from view state
 */
export function calculateViewportBounds(
  longitude: number,
  latitude: number,
  zoom: number,
  viewWidth: number = 1920,
  viewHeight: number = 1080
): { minLon: number; maxLon: number; minLat: number; maxLat: number } {
  const metersPerDegree = 111000;
  const latRad = latitude * Math.PI / 180;
  const metersPerDegreeLon = metersPerDegree * Math.cos(latRad);

  const metersPerPixel = 156543.03392 * Math.cos(latRad) / Math.pow(2, zoom);

  const halfWidthDeg = (viewWidth * metersPerPixel) / metersPerDegreeLon / 2;
  const halfHeightDeg = (viewHeight * metersPerPixel) / metersPerDegree / 2;

  return {
    minLon: longitude - halfWidthDeg * 1.5,
    maxLon: longitude + halfWidthDeg * 1.5,
    minLat: latitude - halfHeightDeg * 1.5,
    maxLat: latitude + halfHeightDeg * 1.5
  };
}
