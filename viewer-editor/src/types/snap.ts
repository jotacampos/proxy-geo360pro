/**
 * Snap Types
 *
 * Types for the advanced snapping system including:
 * - Vertex/edge snap to existing features
 * - Orthogonal guides during drawing
 * - Guide intersections
 */

import type { Feature } from 'geojson';

// Snap mode: which targets to consider
export type SnapMode = 'vertex' | 'edge' | 'both';

// Snap guide line (extends across map during drawing)
export interface SnapGuide {
  id: string;
  // Origin point of the guide line
  origin: [number, number];
  // Direction unit vector
  direction: [number, number];
  // Type of guide for coloring
  type: 'horizontal' | 'vertical' | 'parallel' | 'orthogonal';
}

// Edge (line segment) type
export type Edge = [[number, number], [number, number]];

// Result of a snap operation
export interface SnapResult {
  point: [number, number];
  distance: number;
  type: 'vertex' | 'edge';
  edge?: Edge;
}

// Result of a guide snap operation
export interface GuideSnapResult {
  point: [number, number];
  distance: number;
  type: 'guide' | 'intersection';
  guide?: SnapGuide;
}

// Combined snap result (can be feature snap or guide snap)
export interface CombinedSnapResult {
  point: [number, number];
  distance: number;
  source: 'vertex' | 'edge' | 'guide' | 'intersection';
  edge?: Edge;
  guide?: SnapGuide;
}

// Viewport bounds for extending guides
export interface ViewportBounds {
  minLon: number;
  maxLon: number;
  minLat: number;
  maxLat: number;
}

// Snap configuration
export interface SnapConfig {
  enabled: boolean;
  mode: SnapMode;
  pixels: number;
  guidesEnabled: boolean;
  referenceFeatures: Feature[];
}

// Snap state for the store
export interface SnapState {
  // Main toggle
  snapEnabled: boolean;
  // Snap mode: vertex only, edge only, or both
  snapMode: SnapMode;
  // Snap threshold in screen pixels
  snapPixels: number;
  // Features selected as snap reference (from external layers)
  snapReferenceFeatures: Feature[];
  // Orthogonal guides toggle
  snapGuidesEnabled: boolean;
  // Active guides during drawing
  snapGuides: SnapGuide[];
}

// Snap actions for the store
export interface SnapActions {
  // Toggle snap on/off
  toggleSnap: () => void;
  setSnapEnabled: (enabled: boolean) => void;
  // Set snap mode
  setSnapMode: (mode: SnapMode) => void;
  // Set snap threshold in pixels
  setSnapPixels: (pixels: number) => void;
  // Toggle a feature as snap reference
  toggleSnapReference: (feature: Feature) => void;
  // Remove a specific snap reference
  removeSnapReference: (index: number) => void;
  // Clear all snap references
  clearSnapReferences: () => void;
  // Toggle orthogonal guides
  toggleSnapGuides: () => void;
  setSnapGuidesEnabled: (enabled: boolean) => void;
  // Set active guides (usually called by drawing logic)
  setSnapGuides: (guides: SnapGuide[]) => void;
  // Clear active guides
  clearSnapGuides: () => void;
}
