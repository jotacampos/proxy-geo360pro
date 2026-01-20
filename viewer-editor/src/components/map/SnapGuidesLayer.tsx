/**
 * Snap Visualization Layers
 *
 * Renders all visual elements for the snap system:
 * - Snap reference features (cyan highlight)
 * - Snap vertices (magenta dots)
 * - Snap edge highlight (orange)
 * - Snap guides (dashed lines)
 * - Guide intersections (yellow dots)
 * - Snap indicator (pulsing green/orange)
 * - Snap guide line (cursor to snap point)
 */

import { useMemo, useState, useEffect, useCallback } from 'react';
import { LineLayer, ScatterplotLayer } from '@deck.gl/layers';
import { GeoJsonLayer } from '@deck.gl/layers';
import { useEditorStore } from '../../stores/editorStore';
import type { SnapResult, GuideSnapResult, ViewportBounds, Edge } from '../../types/snap';
import {
  generateSnapGuides,
  extendGuideToViewport,
  findGuideSnap,
  findGuideIntersections,
} from '../../utils/snapGuides';
import {
  extractVerticesFromFeatures,
  extractEdgesFromFeatures,
  findNearestSnap,
  calculateSnapThreshold,
  calculateViewportBounds,
} from '../../utils/snapFeatures';

// Colors
const REFERENCE_FILL_COLOR: [number, number, number, number] = [0, 200, 255, 50];
const REFERENCE_LINE_COLOR: [number, number, number, number] = [0, 200, 255, 255];
const VERTEX_COLOR: [number, number, number, number] = [255, 0, 255, 120];
const EDGE_HIGHLIGHT_COLOR: [number, number, number, number] = [255, 200, 0, 255];
const GUIDE_HORIZONTAL_COLOR: [number, number, number, number] = [255, 200, 50, 150];
const GUIDE_PARALLEL_COLOR: [number, number, number, number] = [100, 200, 255, 150];
const GUIDE_ORTHOGONAL_COLOR: [number, number, number, number] = [255, 100, 200, 150];
const INTERSECTION_COLOR: [number, number, number, number] = [255, 255, 0, 200];
const SNAP_VERTEX_COLOR: [number, number, number, number] = [0, 255, 100, 255];
const SNAP_EDGE_COLOR: [number, number, number, number] = [255, 200, 0, 255];
const SNAP_GUIDE_COLOR: [number, number, number, number] = [100, 200, 255, 255];
const SNAP_INTERSECTION_COLOR: [number, number, number, number] = [255, 255, 0, 255];

interface SnapLayersProps {
  viewState: {
    longitude: number;
    latitude: number;
    zoom: number;
  };
  mousePosition: [number, number] | null;
}

export interface SnapLayersResult {
  layers: any[];
  nearestSnap: SnapResult | null;
  nearestGuideSnap: GuideSnapResult | null;
  applySnap: (coord: [number, number]) => [number, number];
}

/**
 * Hook that generates all snap visualization layers
 */
export function useSnapLayers({ viewState, mousePosition }: SnapLayersProps): SnapLayersResult {
  const {
    // Drawing state
    drawingCoordinates,
    mode,
    // Snap configuration
    snapEnabled,
    snapMode,
    snapPixels,
    snapReferenceFeatures,
    snapGuidesEnabled,
    snapGuides,
    setSnapGuides,
    clearSnapGuides,
    // Editor features
    features,
    selectedIndexes,
  } = useEditorStore();

  // Pulsing animation state
  const [pulseSize, setPulseSize] = useState(1);

  // Calculate viewport bounds
  const viewportBounds = useMemo((): ViewportBounds => {
    return calculateViewportBounds(viewState.longitude, viewState.latitude, viewState.zoom);
  }, [viewState.longitude, viewState.latitude, viewState.zoom]);

  // Calculate snap threshold in degrees
  const snapThreshold = useMemo(() => {
    return calculateSnapThreshold(viewState.zoom, viewState.latitude, snapPixels);
  }, [viewState.zoom, viewState.latitude, snapPixels]);

  // Determine if we're in a drawing or edit mode
  const isDrawMode = mode.startsWith('draw-') || mode === 'extend-line';
  const isEditMode = ['modify', 'translate', 'rotate', 'scale', 'transform', 'extrude', 'elevation'].includes(mode);

  // Calculate snap vertices from reference features and editor features
  const snapVertices = useMemo(() => {
    if (!snapEnabled) return [];

    const vertices: [number, number][] = [];

    // Add vertices from reference features (external layers)
    vertices.push(...extractVerticesFromFeatures(snapReferenceFeatures));

    // In draw mode: include all existing drawn features
    if (isDrawMode) {
      vertices.push(...extractVerticesFromFeatures(features.features));
    }

    // In edit mode: include all features EXCEPT selected ones
    if (isEditMode) {
      const unselectedFeatures = features.features.filter((_, i) => !selectedIndexes.includes(i));
      vertices.push(...extractVerticesFromFeatures(unselectedFeatures));
    }

    return vertices;
  }, [snapEnabled, snapReferenceFeatures, isDrawMode, isEditMode, features.features, selectedIndexes]);

  // Calculate snap edges
  const snapEdges = useMemo((): Edge[] => {
    if (!snapEnabled) return [];

    const edges: Edge[] = [];

    // Add edges from reference features
    edges.push(...extractEdgesFromFeatures(snapReferenceFeatures));

    // In draw mode: include all existing drawn features
    if (isDrawMode) {
      edges.push(...extractEdgesFromFeatures(features.features));
    }

    // In edit mode: include all features EXCEPT selected ones
    if (isEditMode) {
      const unselectedFeatures = features.features.filter((_, i) => !selectedIndexes.includes(i));
      edges.push(...extractEdgesFromFeatures(unselectedFeatures));
    }

    return edges;
  }, [snapEnabled, snapReferenceFeatures, isDrawMode, isEditMode, features.features, selectedIndexes]);

  // Generate snap guides during drawing
  useEffect(() => {
    if (!snapGuidesEnabled || !isDrawMode || drawingCoordinates.length === 0) {
      if (snapGuides.length > 0) {
        clearSnapGuides();
      }
      return;
    }

    const guides = generateSnapGuides(drawingCoordinates, true);
    setSnapGuides(guides);
  }, [snapGuidesEnabled, isDrawMode, drawingCoordinates, setSnapGuides, clearSnapGuides, snapGuides.length]);

  // Find nearest feature snap (vertex or edge)
  const nearestSnap = useMemo((): SnapResult | null => {
    if (!snapEnabled || !mousePosition) return null;
    if (snapVertices.length === 0 && snapEdges.length === 0) return null;

    return findNearestSnap(mousePosition, snapVertices, snapEdges, snapThreshold, snapMode);
  }, [snapEnabled, mousePosition, snapVertices, snapEdges, snapThreshold, snapMode]);

  // Find nearest guide snap
  const nearestGuideSnap = useMemo((): GuideSnapResult | null => {
    if (!snapGuidesEnabled || !mousePosition || snapGuides.length === 0) return null;
    return findGuideSnap(mousePosition, snapGuides, snapThreshold);
  }, [snapGuidesEnabled, mousePosition, snapGuides, snapThreshold]);

  // Guide intersections
  const guideIntersections = useMemo(() => {
    if (!snapGuidesEnabled || snapGuides.length < 2) return [];
    return findGuideIntersections(snapGuides);
  }, [snapGuidesEnabled, snapGuides]);

  // Pulse animation
  const hasSnap = nearestSnap || nearestGuideSnap;
  useEffect(() => {
    if (!hasSnap) {
      setPulseSize(1);
      return;
    }
    const interval = setInterval(() => {
      setPulseSize(prev => prev >= 1.5 ? 1 : prev + 0.1);
    }, 50);
    return () => clearInterval(interval);
  }, [hasSnap]);

  // Apply snap function
  const applySnap = useCallback((coord: [number, number]): [number, number] => {
    const hasFeatureTargets = snapEnabled && (snapVertices.length > 0 || snapEdges.length > 0);
    const hasGuideTargets = snapGuidesEnabled && snapGuides.length > 0;

    if (!hasFeatureTargets && !hasGuideTargets) return coord;

    let bestPoint = coord;
    let bestDistance = Infinity;
    let bestIsIntersection = false;

    // Check feature snap
    if (hasFeatureTargets) {
      const featureSnap = findNearestSnap(coord, snapVertices, snapEdges, snapThreshold, snapMode);
      if (featureSnap && featureSnap.distance < bestDistance) {
        bestPoint = featureSnap.point;
        bestDistance = featureSnap.distance;
      }
    }

    // Check guide snap - intersections have highest priority
    if (hasGuideTargets) {
      const guideSnap = findGuideSnap(coord, snapGuides, snapThreshold);
      if (guideSnap) {
        if (guideSnap.type === 'intersection') {
          bestPoint = guideSnap.point;
          bestDistance = guideSnap.distance;
          bestIsIntersection = true;
        } else if (!bestIsIntersection && guideSnap.distance < bestDistance) {
          bestPoint = guideSnap.point;
          bestDistance = guideSnap.distance;
        }
      }
    }

    return bestPoint;
  }, [snapEnabled, snapVertices, snapEdges, snapThreshold, snapMode, snapGuidesEnabled, snapGuides]);

  // Build layers
  const layers = useMemo(() => {
    const result: any[] = [];

    // 1. Snap reference layer (cyan highlight)
    if (snapReferenceFeatures.length > 0) {
      result.push(
        new GeoJsonLayer({
          id: 'snap-reference-layer',
          data: {
            type: 'FeatureCollection',
            features: snapReferenceFeatures,
          },
          getFillColor: REFERENCE_FILL_COLOR,
          getLineColor: REFERENCE_LINE_COLOR,
          getLineWidth: 3,
          lineWidthMinPixels: 2,
          getPointRadius: 8,
          pointRadiusMinPixels: 4,
          pickable: false,
        })
      );
    }

    // 2. Snap vertices layer (magenta dots) - only show in vertex or both mode
    if (snapEnabled && snapVertices.length > 0 && snapMode !== 'edge') {
      // Filter out the nearest vertex if we're snapping to it
      const filteredVertices = (nearestSnap && nearestSnap.type === 'vertex')
        ? snapVertices.filter(v =>
            v[0] !== nearestSnap.point[0] || v[1] !== nearestSnap.point[1]
          )
        : snapVertices;

      if (filteredVertices.length > 0) {
        result.push(
          new ScatterplotLayer({
            id: 'snap-vertices-layer',
            data: filteredVertices,
            getPosition: (d: [number, number]) => d,
            getFillColor: VERTEX_COLOR,
            getLineColor: [255, 255, 255, 150],
            getRadius: 4,
            radiusMinPixels: 2,
            radiusMaxPixels: 6,
            stroked: true,
            lineWidthMinPixels: 1,
            pickable: false,
          })
        );
      }
    }

    // 3. Snap edge highlight layer (orange)
    if (nearestSnap && nearestSnap.type === 'edge' && nearestSnap.edge) {
      result.push(
        new LineLayer({
          id: 'snap-edge-highlight-layer',
          data: [{
            source: nearestSnap.edge[0],
            target: nearestSnap.edge[1],
          }],
          getSourcePosition: (d: any) => d.source,
          getTargetPosition: (d: any) => d.target,
          getColor: EDGE_HIGHLIGHT_COLOR,
          getWidth: 4,
          widthMinPixels: 3,
          widthMaxPixels: 6,
          pickable: false,
        })
      );
    }

    // 4. Snap guides layer (dashed lines)
    if (snapGuidesEnabled && snapGuides.length > 0) {
      const guideLines = snapGuides.map(guide => {
        const extended = extendGuideToViewport(guide, viewportBounds);
        return {
          id: guide.id,
          type: guide.type,
          sourcePosition: extended[0],
          targetPosition: extended[1],
        };
      });

      result.push(
        new LineLayer({
          id: 'snap-guides-layer',
          data: guideLines,
          getSourcePosition: (d: any) => d.sourcePosition,
          getTargetPosition: (d: any) => d.targetPosition,
          getColor: (d: any) => {
            switch (d.type) {
              case 'horizontal':
              case 'vertical':
                return GUIDE_HORIZONTAL_COLOR;
              case 'parallel':
                return GUIDE_PARALLEL_COLOR;
              case 'orthogonal':
                return GUIDE_ORTHOGONAL_COLOR;
              default:
                return GUIDE_HORIZONTAL_COLOR;
            }
          },
          getWidth: 1,
          widthMinPixels: 1,
          widthMaxPixels: 2,
          pickable: false,
        })
      );
    }

    // 5. Guide intersections layer (yellow dots)
    if (snapGuidesEnabled && guideIntersections.length > 0) {
      result.push(
        new ScatterplotLayer({
          id: 'guide-intersections-layer',
          data: guideIntersections,
          getPosition: (d: [number, number]) => d,
          getFillColor: INTERSECTION_COLOR,
          getLineColor: [255, 255, 255, 255],
          getRadius: 6,
          radiusMinPixels: 4,
          radiusMaxPixels: 8,
          stroked: true,
          lineWidthMinPixels: 2,
          pickable: false,
        })
      );
    }

    // 6. Main snap indicator (pulsing)
    const activeSnap = nearestGuideSnap || nearestSnap;
    if (activeSnap) {
      let fillColor: [number, number, number, number];

      if (nearestGuideSnap) {
        fillColor = nearestGuideSnap.type === 'intersection'
          ? SNAP_INTERSECTION_COLOR
          : SNAP_GUIDE_COLOR;
      } else if (nearestSnap) {
        fillColor = nearestSnap.type === 'vertex'
          ? SNAP_VERTEX_COLOR
          : SNAP_EDGE_COLOR;
      } else {
        fillColor = SNAP_VERTEX_COLOR;
      }

      result.push(
        new ScatterplotLayer({
          id: 'snap-indicator-layer',
          data: [activeSnap.point],
          getPosition: (d: [number, number]) => d,
          getFillColor: fillColor,
          getLineColor: [255, 255, 255, 255],
          getRadius: 12 * pulseSize,
          radiusMinPixels: 8,
          radiusMaxPixels: 20,
          stroked: true,
          lineWidthMinPixels: 3,
          pickable: false,
          updateTriggers: {
            getRadius: [pulseSize],
            getFillColor: [nearestSnap?.type, nearestGuideSnap?.type],
          },
        })
      );
    }

    // 7. Snap guide line (from cursor to snap point)
    if (activeSnap && mousePosition) {
      const dx = mousePosition[0] - activeSnap.point[0];
      const dy = mousePosition[1] - activeSnap.point[1];
      const dist = Math.sqrt(dx * dx + dy * dy);

      // Only show if cursor is not exactly on snap point
      if (dist > snapThreshold * 0.1) {
        result.push(
          new LineLayer({
            id: 'snap-cursor-guide-layer',
            data: [{
              source: mousePosition,
              target: activeSnap.point,
            }],
            getSourcePosition: (d: any) => d.source,
            getTargetPosition: (d: any) => d.target,
            getColor: [0, 255, 100, 200],
            getWidth: 2,
            widthMinPixels: 1,
            widthMaxPixels: 3,
            pickable: false,
          })
        );
      }
    }

    return result;
  }, [
    snapReferenceFeatures,
    snapEnabled,
    snapMode,
    snapVertices,
    snapEdges,
    nearestSnap,
    snapGuidesEnabled,
    snapGuides,
    viewportBounds,
    guideIntersections,
    nearestGuideSnap,
    mousePosition,
    pulseSize,
    snapThreshold,
  ]);

  return {
    layers,
    nearestSnap,
    nearestGuideSnap,
    applySnap,
  };
}

/**
 * Get snap status info for UI display
 */
export function getSnapStatusInfo(nearestSnap: SnapResult | null, nearestGuideSnap: GuideSnapResult | null) {
  if (nearestGuideSnap) {
    return {
      active: true,
      type: nearestGuideSnap.type === 'intersection' ? 'INTERSECÇÃO' : 'GUIA',
      color: nearestGuideSnap.type === 'intersection' ? 'yellow' : 'cyan',
      point: nearestGuideSnap.point,
    };
  }

  if (nearestSnap) {
    return {
      active: true,
      type: nearestSnap.type === 'vertex' ? 'VÉRTICE' : 'ARESTA',
      color: nearestSnap.type === 'vertex' ? 'green' : 'orange',
      point: nearestSnap.point,
    };
  }

  return { active: false, type: null, color: null, point: null };
}
