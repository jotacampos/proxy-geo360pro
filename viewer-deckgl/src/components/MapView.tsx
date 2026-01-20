import { useState, useMemo, useCallback, useEffect } from 'react';
import DeckGL from '@deck.gl/react';
import { MVTLayer } from '@deck.gl/geo-layers';
import { GeoJsonLayer, LineLayer, ScatterplotLayer } from '@deck.gl/layers';
import {
  EditableGeoJsonLayer,
  SelectionLayer,
  SELECTION_TYPE,
  // Draw modes
  DrawPointMode,
  DrawLineStringMode,
  DrawPolygonMode,
  DrawRectangleMode,
  DrawRectangleFromCenterMode,
  DrawRectangleUsingThreePointsMode,
  DrawCircleFromCenterMode,
  DrawCircleByDiameterMode,
  ResizeCircleMode,
  DrawEllipseByBoundingBoxMode,
  DrawEllipseUsingThreePointsMode,
  Draw90DegreePolygonMode,
  DrawPolygonByDraggingMode,
  DrawSquareFromCenterMode,
  DrawSquareMode,
  ExtendLineStringMode,
  // Transform modes
  ModifyMode,
  TranslateMode,
  RotateMode,
  ScaleMode,
  ExtrudeMode,
  ElevationMode,
  TransformMode,
  // Other modes
  ViewMode,
  SplitPolygonMode,
  DuplicateMode,
  CompositeMode,
  SnappableMode,
  // Measurement modes
  MeasureDistanceMode,
  MeasureAreaMode,
  MeasureAngleMode,
} from '@deck.gl-community/editable-layers';
import { Map } from 'react-map-gl/maplibre';
import type { MapViewState, PickingInfo } from '@deck.gl/core';
import type { Feature } from 'geojson';

import { useStore } from '../store';
import type { SnapMode, HistoryOperationType } from '../types';
import { buildTileUrl } from '../services/tiles';
import {
  generateSnapGuides,
  extendGuideToViewport,
  findGuideSnap,
  findGuideIntersections,
  extractTentativeCoordinates,
  type GuideSnapResult
} from '../utils/snapGuides';
import LayerPanel from './LayerPanel';
import EditToolbar from './EditToolbar';
import FeaturePanel from './FeaturePanel';
import HistoryPanel from './HistoryPanel';

// Color palette for layers
const LAYER_COLORS = [
  [228, 26, 28],    // Red
  [55, 126, 184],   // Blue
  [77, 175, 74],    // Green
  [152, 78, 163],   // Purple
  [255, 127, 0],    // Orange
  [255, 255, 51],   // Yellow
  [166, 86, 40],    // Brown
  [247, 129, 191],  // Pink
] as const;

// Composite mode: Draw + Modify at the same time
const COMPOSITE_DRAW_MODIFY = new CompositeMode([
  new DrawPolygonMode(),
  new ModifyMode(),
]);

// Edit mode classes - instances will be created with useMemo
const EDIT_MODE_CLASSES = {
  // Navigation
  'view': ViewMode,
  'select-snap-ref': ViewMode,

  // Selection tools (handled by SelectionLayer)
  'select-rectangle': ViewMode,
  'select-lasso': ViewMode,

  // Basic drawing
  'draw-point': DrawPointMode,
  'draw-line': DrawLineStringMode,
  'draw-polygon': DrawPolygonMode,
  'draw-lasso': DrawPolygonByDraggingMode,
  'extend-line': ExtendLineStringMode,

  // Shapes
  'draw-rectangle': DrawRectangleMode,
  'draw-rectangle-center': DrawRectangleFromCenterMode,
  'draw-rectangle-3pts': DrawRectangleUsingThreePointsMode,
  'draw-square': DrawSquareMode,
  'draw-square-center': DrawSquareFromCenterMode,
  'draw-circle': DrawCircleFromCenterMode,
  'draw-circle-diameter': DrawCircleByDiameterMode,
  'resize-circle': ResizeCircleMode,
  'draw-ellipse': DrawEllipseByBoundingBoxMode,
  'draw-ellipse-3pts': DrawEllipseUsingThreePointsMode,
  'draw-90deg-polygon': Draw90DegreePolygonMode,

  // Edit/Transform
  'modify': ModifyMode,
  'translate': TranslateMode,
  'rotate': RotateMode,
  'scale': ScaleMode,
  'extrude': ExtrudeMode,
  'elevation': ElevationMode,
  'transform': TransformMode,
  'split-polygon': SplitPolygonMode,
  'duplicate': DuplicateMode,
  'delete': ViewMode,

  // Composite
  'composite-draw-modify': null, // Special handling

  // Measurement
  'measure-distance': MeasureDistanceMode,
  'measure-area': MeasureAreaMode,
  'measure-angle': MeasureAngleMode,
} as const;

// Helper: Extract all vertices from a geometry for snap calculation
function extractVertices(geometry: any): [number, number][] {
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
  }

  return vertices;
}

// Type for edge (line segment)
type Edge = [[number, number], [number, number]];

// Type for snap result
interface SnapResult {
  point: [number, number];
  distance: number;
  type: 'vertex' | 'edge';
  edge?: Edge;  // The edge if snapping to edge
}

// Helper: Extract all edges (line segments) from a geometry
function extractEdges(geometry: any): Edge[] {
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
  }

  return edges;
}

// Helper: Find nearest point on a line segment
// Returns the closest point on segment [p1, p2] to point p
function nearestPointOnSegment(
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

// Helper: Calculate distance between two points
function distance(p1: [number, number], p2: [number, number]): number {
  return Math.sqrt(
    Math.pow(p1[0] - p2[0], 2) + Math.pow(p1[1] - p2[1], 2)
  );
}

// Helper: Find nearest snap point (vertex or edge) based on mode
function findNearestSnap(
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

export default function MapView() {
  const {
    currentOrg,
    layers,
    visibleLayers,
    features,
    selectedFeatureIndexes,
    editMode,
    setEditMode,
    modeConfig,
    snapEnabled,
    snapMode,
    snapPixels,
    snapReferenceFeatures,
    snapGuidesEnabled,
    snapGuides,
    setSnapGuides,
    clearSnapGuides,
    debugInfo,
    logout,
    updateFeatures,
    selectFeature,
    toggleSnapReference,
    copyFeatures,
    pasteFeatures,
    deleteSelectedFeatures,
    addHistoryEntry,
    history,
  } = useStore();

  // Map view state
  const [viewState, setViewState] = useState<MapViewState>({
    longitude: -49.28,
    latitude: -16.68, // Goiania
    zoom: 12,
    pitch: 0,
    bearing: 0,
  });

  // Popup for clicked feature
  const [popupInfo, setPopupInfo] = useState<{
    x: number;
    y: number;
    feature: Feature;
  } | null>(null);

  // Track mouse position for snap preview
  const [mousePosition, setMousePosition] = useState<[number, number] | null>(null);

  // Track current drawing coordinates for snap guides
  const [drawingCoords, setDrawingCoords] = useState<[number, number][]>([]);

  // Track previous feature states for history
  const [prevFeatures, setPrevFeatures] = useState<Feature[]>([]);

  // State to show/hide history panel
  const [showHistoryPanel, setShowHistoryPanel] = useState(false);

  // Create MVT layers for visible layers
  const tileLayers = useMemo(() => {
    return layers
      .filter((layer) => visibleLayers.has(layer.id))
      .map((layer, index) => {
        const color = LAYER_COLORS[index % LAYER_COLORS.length];
        const tileUrl = buildTileUrl(layer, false);

        return new MVTLayer({
          id: `mvt-layer-${layer.id}`,
          data: tileUrl,

          // CRITICAL: Send cookies for authentication
          loadOptions: {
            fetch: {
              credentials: 'include',
            },
          },

          // Use GeoJSON format (not binary) to get full geometry with coordinates
          binary: false,

          // Styling
          getFillColor: [...color, 100] as [number, number, number, number],
          getLineColor: color as [number, number, number],
          getLineWidth: 2,
          lineWidthMinPixels: 1,

          // Picking
          pickable: true,
          autoHighlight: true,
          highlightColor: [78, 204, 163, 150],

          // Update on URL change
          updateTriggers: {
            data: [layer.id, Date.now()],
          },
        });
      });
  }, [layers, visibleLayers]);

  // Create edit mode instance with optional SnappableMode wrapper
  const currentEditMode = useMemo(() => {
    // Special handling for composite mode
    if (editMode === 'composite-draw-modify') {
      return COMPOSITE_DRAW_MODIFY;
    }

    const ModeClass = EDIT_MODE_CLASSES[editMode] || ViewMode;
    if (!ModeClass) return new ViewMode();

    const baseMode = new ModeClass();

    // Wrap translate/transform with SnappableMode for advanced snapping
    const snappableModes = ['translate', 'transform'];
    if (snappableModes.includes(editMode) && modeConfig.enableSnapping) {
      return new SnappableMode(baseMode);
    }

    return baseMode;
  }, [editMode, modeConfig.enableSnapping]);

  // Calculate snap vertices from reference features AND drawn features
  // In EDIT mode: exclude the selected geometry (don't snap to itself)
  // In DRAW mode: include all existing drawn features as snap targets
  const snapVertices = useMemo(() => {
    if (!snapEnabled) {
      return [];
    }

    const vertices: [number, number][] = [];
    const isEditMode = editMode === 'modify' || editMode === 'translate' ||
                       editMode === 'rotate' || editMode === 'scale' ||
                       editMode === 'extrude' || editMode === 'elevation' ||
                       editMode === 'transform' || editMode === 'resize-circle';
    const isDrawMode = editMode.startsWith('draw-') || editMode === 'extend-line';

    // Add vertices from snap reference features (from MVT layers) - always included
    for (const feature of snapReferenceFeatures) {
      if (feature.geometry) {
        vertices.push(...extractVertices(feature.geometry));
      }
    }

    // In draw mode: include ALL existing drawn features as snap targets
    if (isDrawMode) {
      for (const feature of features.features) {
        if (feature?.geometry) {
          vertices.push(...extractVertices(feature.geometry));
        }
      }
    }

    // In edit mode: include other drawn features EXCEPT the selected one
    if (isEditMode) {
      for (let i = 0; i < features.features.length; i++) {
        // Skip selected features - don't snap to itself
        if (selectedFeatureIndexes.includes(i)) continue;

        const feature = features.features[i];
        if (feature?.geometry) {
          vertices.push(...extractVertices(feature.geometry));
        }
      }
    }

    return vertices;
  }, [snapEnabled, snapReferenceFeatures, editMode, features.features, selectedFeatureIndexes]);

  // Calculate snap edges from reference features AND drawn features
  // In EDIT mode: exclude the selected geometry (don't snap to itself)
  // In DRAW mode: include all existing drawn features as snap targets
  const snapEdges = useMemo(() => {
    if (!snapEnabled) {
      return [];
    }

    const edges: Edge[] = [];
    const isEditMode = editMode === 'modify' || editMode === 'translate' ||
                       editMode === 'rotate' || editMode === 'scale' ||
                       editMode === 'extrude' || editMode === 'elevation' ||
                       editMode === 'transform' || editMode === 'resize-circle';
    const isDrawMode = editMode.startsWith('draw-') || editMode === 'extend-line';

    // Add edges from snap reference features (from MVT layers) - always included
    for (const feature of snapReferenceFeatures) {
      if (feature.geometry) {
        edges.push(...extractEdges(feature.geometry));
      }
    }

    // In draw mode: include ALL existing drawn features as snap targets
    if (isDrawMode) {
      for (const feature of features.features) {
        if (feature?.geometry) {
          edges.push(...extractEdges(feature.geometry));
        }
      }
    }

    // In edit mode: include other drawn features EXCEPT the selected one
    if (isEditMode) {
      for (let i = 0; i < features.features.length; i++) {
        // Skip selected features - don't snap to itself
        if (selectedFeatureIndexes.includes(i)) continue;

        const feature = features.features[i];
        if (feature?.geometry) {
          edges.push(...extractEdges(feature.geometry));
        }
      }
    }

    return edges;
  }, [snapEnabled, snapReferenceFeatures, editMode, features.features, selectedFeatureIndexes, snapVertices.length]);

  // Calculate threshold in degrees based on zoom level
  // At zoom 12, roughly 0.0001 degrees ≈ 10 meters
  const snapThresholdDegrees = useMemo(() => {
    const metersPerPixel = 156543.03392 * Math.cos(viewState.latitude * Math.PI / 180) / Math.pow(2, viewState.zoom);
    const thresholdMeters = snapPixels * metersPerPixel;
    return thresholdMeters / 111000; // Approximate degrees
  }, [viewState.zoom, viewState.latitude, snapPixels]);

  // Custom snap function for coordinates (uses vertices/edges AND guides)
  const applySnap = useCallback((coord: [number, number]): [number, number] => {
    const hasFeatureTargets = snapEnabled && (snapVertices.length > 0 || snapEdges.length > 0);
    const hasGuideTargets = snapGuidesEnabled && snapGuides.length > 0;

    if (!hasFeatureTargets && !hasGuideTargets) return coord;

    let bestPoint = coord;
    let bestDistance = Infinity;
    let bestIsIntersection = false;

    // Check feature snap (vertices/edges)
    if (hasFeatureTargets) {
      const featureSnap = findNearestSnap(coord, snapVertices, snapEdges, snapThresholdDegrees, snapMode);
      if (featureSnap && featureSnap.distance < bestDistance) {
        bestPoint = featureSnap.point;
        bestDistance = featureSnap.distance;
      }
    }

    // Check guide snap - intersections have highest priority
    if (hasGuideTargets) {
      const guideSnap = findGuideSnap(coord, snapGuides, snapThresholdDegrees);
      if (guideSnap) {
        // Intersections ALWAYS win when within threshold (they're the most precise)
        if (guideSnap.type === 'intersection') {
          bestPoint = guideSnap.point;
          bestDistance = guideSnap.distance;
          bestIsIntersection = true;
        }
        // Guide lines only win if closer than current best (and no intersection)
        else if (!bestIsIntersection && guideSnap.distance < bestDistance) {
          bestPoint = guideSnap.point;
          bestDistance = guideSnap.distance;
        }
      }
    }

    return bestPoint;
  }, [snapEnabled, snapVertices, snapEdges, snapThresholdDegrees, snapMode, snapGuidesEnabled, snapGuides]);

  // Apply snap to geometry coordinates recursively
  const applySnapToGeometry = useCallback((geometry: any): any => {
    if (!geometry) return geometry;

    switch (geometry.type) {
      case 'Point':
        return {
          ...geometry,
          coordinates: applySnap(geometry.coordinates as [number, number]),
        };
      case 'LineString':
      case 'MultiPoint':
        return {
          ...geometry,
          coordinates: (geometry.coordinates as [number, number][]).map(applySnap),
        };
      case 'Polygon':
      case 'MultiLineString':
        return {
          ...geometry,
          coordinates: geometry.coordinates.map((ring: [number, number][]) =>
            ring.map(applySnap)
          ),
        };
      case 'MultiPolygon':
        return {
          ...geometry,
          coordinates: geometry.coordinates.map((polygon: [number, number][][]) =>
            polygon.map((ring: [number, number][]) => ring.map(applySnap))
          ),
        };
      default:
        return geometry;
    }
  }, [applySnap]);

  // Apply snap to a specific vertex in a geometry based on positionIndexes
  // positionIndexes is an array like [ringIndex, vertexIndex] for polygons or [vertexIndex] for lines
  const snapSpecificVertex = useCallback((geometry: any, positionIndexes: number[]): any => {
    if (!geometry || !positionIndexes || positionIndexes.length === 0) return geometry;

    // Deep clone the coordinates
    const cloneCoords = (coords: any): any => JSON.parse(JSON.stringify(coords));

    switch (geometry.type) {
      case 'Point':
        // Point only has one position
        return {
          ...geometry,
          coordinates: applySnap(geometry.coordinates as [number, number]),
        };

      case 'LineString': {
        const coords = cloneCoords(geometry.coordinates);
        const vertexIndex = positionIndexes[0];
        if (vertexIndex !== undefined && coords[vertexIndex]) {
          coords[vertexIndex] = applySnap(coords[vertexIndex]);
        }
        return { ...geometry, coordinates: coords };
      }

      case 'Polygon': {
        const coords = cloneCoords(geometry.coordinates);
        const ringIndex = positionIndexes[0];
        const vertexIndex = positionIndexes[1];
        if (ringIndex !== undefined && vertexIndex !== undefined && coords[ringIndex]?.[vertexIndex]) {
          coords[ringIndex][vertexIndex] = applySnap(coords[ringIndex][vertexIndex]);
          // If it's the first/last vertex of a ring, update both to keep polygon closed
          if (vertexIndex === 0 && coords[ringIndex].length > 1) {
            coords[ringIndex][coords[ringIndex].length - 1] = coords[ringIndex][0];
          } else if (vertexIndex === coords[ringIndex].length - 1 && coords[ringIndex].length > 1) {
            coords[ringIndex][0] = coords[ringIndex][vertexIndex];
          }
        }
        return { ...geometry, coordinates: coords };
      }

      case 'MultiLineString': {
        const coords = cloneCoords(geometry.coordinates);
        const lineIndex = positionIndexes[0];
        const vertexIndex = positionIndexes[1];
        if (lineIndex !== undefined && vertexIndex !== undefined && coords[lineIndex]?.[vertexIndex]) {
          coords[lineIndex][vertexIndex] = applySnap(coords[lineIndex][vertexIndex]);
        }
        return { ...geometry, coordinates: coords };
      }

      case 'MultiPolygon': {
        const coords = cloneCoords(geometry.coordinates);
        const polygonIndex = positionIndexes[0];
        const ringIndex = positionIndexes[1];
        const vertexIndex = positionIndexes[2];
        if (polygonIndex !== undefined && ringIndex !== undefined && vertexIndex !== undefined &&
            coords[polygonIndex]?.[ringIndex]?.[vertexIndex]) {
          coords[polygonIndex][ringIndex][vertexIndex] = applySnap(coords[polygonIndex][ringIndex][vertexIndex]);
          // Keep polygon closed
          const ring = coords[polygonIndex][ringIndex];
          if (vertexIndex === 0 && ring.length > 1) {
            ring[ring.length - 1] = ring[0];
          } else if (vertexIndex === ring.length - 1 && ring.length > 1) {
            ring[0] = ring[vertexIndex];
          }
        }
        return { ...geometry, coordinates: coords };
      }

      default:
        return geometry;
    }
  }, [applySnap]);

  // Create editable layer
  const editableLayer = useMemo(() => {
    return new EditableGeoJsonLayer({
      id: 'editable-layer',
      // Cast to any due to type mismatch between geojson and @deck.gl-community types
      data: features as any,
      mode: currentEditMode,
      selectedFeatureIndexes,

      // Mode configuration with snapping and user options
      modeConfig: {
        // Native snapping for modify/translate
        enableSnapping: snapEnabled,
        snapPixels: snapPixels,
        pickingRadius: snapPixels,
        // User mode config (allowHoles, booleanOperation, etc.)
        ...modeConfig,
        // Additional snap targets from reference features
        additionalSnapTargets: snapReferenceFeatures,
      },

      // Edit callback with custom snap for draw and edit modes
      onEdit: ({ updatedData, editType, editContext }: any) => {

        // Helper to get operation description
        const getOperationDescription = (type: string, featureIndex: number): string => {
          const geomType = updatedData?.features?.[featureIndex]?.geometry?.type || 'Geometria';
          switch (type) {
            case 'addFeature': return `Adicionou ${geomType}`;
            case 'addPosition': return `Adicionou vértice`;
            case 'removePosition': return `Removeu vértice`;
            case 'movePosition':
            case 'finishMovePosition': return `Moveu vértice`;
            case 'translated':
            case 'finishTranslating': return `Moveu ${geomType}`;
            case 'rotated': return `Rotacionou ${geomType}`;
            case 'scaled': return `Escalou ${geomType}`;
            case 'extruded': return `Extrudou ${geomType}`;
            default: return `Editou ${geomType}`;
          }
        };

        // Helper to map editType to HistoryOperationType
        const getHistoryOpType = (type: string): HistoryOperationType => {
          switch (type) {
            case 'addFeature': return 'add';
            case 'translated':
            case 'finishTranslating': return 'translate';
            case 'rotated': return 'rotate';
            case 'scaled': return 'scale';
            case 'extruded':
            case 'movePosition':
            case 'finishMovePosition':
            case 'addPosition':
            case 'removePosition': return 'modify';
            default: return 'modify';
          }
        };

        // Track drawing coordinates for snap guides
        // Try tentativeFeature first (contains in-progress drawing with mouse position)
        if (editContext?.tentativeFeature?.geometry) {
          const coords = extractTentativeCoordinates(editContext.tentativeFeature.geometry);
          if (coords.length > 0) {
            setDrawingCoords(coords);
          }
        }
        // Fallback: check for position in the last feature being drawn
        else if (updatedData?.features?.length > 0 && editType === 'addPosition') {
          const lastFeature = updatedData.features[updatedData.features.length - 1];
          if (lastFeature?.geometry) {
            const coords = extractTentativeCoordinates(lastFeature.geometry);
            if (coords.length > 0) {
              setDrawingCoords(coords);
            }
          }
        }
        // Also try editContext.position for single point additions
        else if (editContext?.position) {
          const position = editContext.position as [number, number];
          setDrawingCoords(prev => {
            if (prev.length > 0 && prev[prev.length - 1][0] === position[0] && prev[prev.length - 1][1] === position[1]) {
              return prev;
            }
            return [...prev, position];
          });
        }

        // Clear guides when feature is completed
        if (editType === 'addFeature') {
          setDrawingCoords([]);
        }

        let finalData = updatedData;

        // Check if snap should be applied (vertices/edges or guides)
        const hasSnapTargets = snapVertices.length > 0 || snapEdges.length > 0;
        const hasGuideTargets = snapGuidesEnabled && snapGuides.length > 0;

        // Edit types that should trigger snap
        const snapEditTypes = [
          'addFeature',        // New feature completed
          'addPosition',       // New vertex added
          'removePosition',    // Vertex removed
          'movePosition',      // Vertex being moved (real-time)
          'finishMovePosition', // Vertex move finished
          'translated',        // Feature translated
          'finishTranslating', // Feature translation finished
          'scaled',            // Feature scaled
          'rotated',           // Feature rotated
          'extruded',          // Feature extruded
        ];

        const shouldSnap = (snapEnabled && hasSnapTargets) || hasGuideTargets;
        const shouldApplySnap = shouldSnap && snapEditTypes.includes(editType);

        if (shouldApplySnap && updatedData?.features?.length > 0) {

          // For move/translate operations, we need to snap only the affected coordinates
          // editContext contains info about which feature/position was edited
          const featureIndex = editContext?.featureIndexes?.[0] ?? editContext?.featureIndex;
          const positionIndexes = editContext?.positionIndexes;

          if (featureIndex !== undefined && updatedData.features[featureIndex]) {
            // Snap only the specific feature that was edited
            const feature = updatedData.features[featureIndex];
            let snappedGeom = feature.geometry;

            if (positionIndexes && positionIndexes.length > 0 &&
                (editType === 'movePosition' || editType === 'finishMovePosition')) {
              // Snap only the specific vertex that was moved
              snappedGeom = snapSpecificVertex(feature.geometry, positionIndexes);
            } else {
              // Snap all vertices of the feature (for translate, addFeature, etc.)
              snappedGeom = applySnapToGeometry(feature.geometry);
            }

            const snappedFeatures = [...updatedData.features];
            snappedFeatures[featureIndex] = {
              ...feature,
              geometry: snappedGeom,
            };
            finalData = {
              ...updatedData,
              features: snappedFeatures,
            };
          } else {
            // Fallback: snap all features (for addFeature, etc.)
            const snappedFeatures = updatedData.features.map((feature: any) => ({
              ...feature,
              geometry: applySnapToGeometry(feature.geometry),
            }));
            finalData = {
              ...updatedData,
              features: snappedFeatures,
            };
          }
        }

        // Track history for significant operations
        const historyEditTypes = [
          'addFeature',
          'finishMovePosition',
          'finishTranslating',
          'rotated',
          'scaled',
          'extruded',
        ];

        // Ensure features have IDs before tracking history
        // Generate ID for new features that don't have one
        const ensureId = (feature: any): any => {
          if (feature.id !== undefined && feature.id !== null) return feature;
          return { ...feature, id: `feat-${Date.now()}-${Math.random().toString(36).substr(2, 9)}` };
        };

        const dataWithIds = {
          ...finalData,
          features: finalData.features.map(ensureId),
        };

        // Update store first (this also ensures IDs)
        updateFeatures(dataWithIds);

        // Track history for significant operations (after IDs are assigned)
        if (historyEditTypes.includes(editType) && dataWithIds?.features?.length > 0) {
          const featureIndex = editContext?.featureIndexes?.[0] ?? editContext?.featureIndex ?? (dataWithIds.features.length - 1);
          const currentFeature = dataWithIds.features[featureIndex];
          const previousFeature = prevFeatures[featureIndex] || null;

          if (currentFeature) {
            // For addFeature, beforeState is null (feature didn't exist)
            // For modifications, beforeState is the previous state
            const beforeState = editType === 'addFeature' ? null : previousFeature;
            const afterState = JSON.parse(JSON.stringify(currentFeature));

            addHistoryEntry({
              operationType: getHistoryOpType(editType),
              description: getOperationDescription(editType, featureIndex),
              featureId: currentFeature.id,
              featureIndex,
              beforeState: beforeState ? JSON.parse(JSON.stringify(beforeState)) : null,
              afterState,
            });
          }
        }

        // Update previous features state for next comparison
        setPrevFeatures(JSON.parse(JSON.stringify(dataWithIds.features)));

        // Auto-switch to modify mode after creating a new feature
        if (editType === 'addFeature' && finalData?.features?.length > 0) {
          const newFeatureIndex = finalData.features.length - 1;
          setTimeout(() => {
            selectFeature([newFeatureIndex]);
            setEditMode('modify');
          }, 0);
        }
      },

      // Styling - main features
      getFillColor: [255, 107, 107, 100],
      getLineColor: [255, 71, 87, 255],
      getLineWidth: 3,
      lineWidthMinPixels: 2,

      // Styling - edit handles
      getEditHandlePointColor: [78, 204, 163, 255],
      getEditHandlePointRadius: 6,
      editHandlePointRadiusMinPixels: 4,
      editHandlePointRadiusMaxPixels: 10,

      // Styling - tentative (drawing)
      getTentativeLineColor: [78, 204, 163, 255],
      getTentativeFillColor: [78, 204, 163, 100],
      getTentativeLineWidth: 2,

      pickable: true,
    });
  }, [features, currentEditMode, selectedFeatureIndexes, snapEnabled, snapPixels, modeConfig, snapReferenceFeatures, snapVertices, snapEdges, snapGuidesEnabled, snapGuides, applySnapToGeometry, snapSpecificVertex, updateFeatures, selectFeature, setEditMode, setDrawingCoords]);

  // Selection layer for batch selection (rectangle or lasso)
  const selectionLayer = useMemo(() => {
    const isSelectionMode = editMode === 'select-rectangle' || editMode === 'select-lasso';
    if (!isSelectionMode) return null;

    const selectionType = editMode === 'select-rectangle'
      ? SELECTION_TYPE.RECTANGLE
      : SELECTION_TYPE.POLYGON;

    return new SelectionLayer({
      id: 'selection-layer',
      selectionType,
      onSelect: ({ pickingInfos }: any) => {
        // Get indexes of selected features from editable layer
        const selectedIndexes: number[] = [];
        for (const info of pickingInfos) {
          if (info.layer?.id === 'editable-layer' && info.index >= 0) {
            if (!selectedIndexes.includes(info.index)) {
              selectedIndexes.push(info.index);
            }
          }
        }
        if (selectedIndexes.length > 0) {
          selectFeature(selectedIndexes);
        }
      },
      layerIds: ['editable-layer'],
      getTentativeFillColor: [100, 150, 255, 80],
      getTentativeLineColor: [100, 150, 255, 255],
      getTentativeLineDashArray: [8, 4],
      lineWidthMinPixels: 2,
    });
  }, [editMode, selectFeature]);

  // Layer to visualize snap reference features (the selected geometries)
  const snapReferenceLayer = useMemo(() => {
    if (snapReferenceFeatures.length === 0) return null;

    return new GeoJsonLayer({
      id: 'snap-reference-layer',
      data: {
        type: 'FeatureCollection',
        features: snapReferenceFeatures,
      },
      // Highlight style - cyan/blue outline
      getFillColor: [0, 200, 255, 50],
      getLineColor: [0, 200, 255, 255],
      getLineWidth: 3,
      lineWidthMinPixels: 2,
      // Point styling
      getPointRadius: 8,
      pointRadiusMinPixels: 4,
      pickable: false,
    });
  }, [snapReferenceFeatures]);

  // Find nearest snap point (vertex or edge) to mouse position based on mode
  const nearestSnap = useMemo((): SnapResult | null => {
    if (!snapEnabled || !mousePosition) return null;
    if (snapVertices.length === 0 && snapEdges.length === 0) return null;
    return findNearestSnap(mousePosition, snapVertices, snapEdges, snapThresholdDegrees, snapMode);
  }, [snapEnabled, mousePosition, snapVertices, snapEdges, snapThresholdDegrees, snapMode]);

  // Layer to visualize snap vertices (the actual snap points) - smaller dots
  // Only show when mode allows vertex snap
  const snapVerticesLayer = useMemo(() => {
    if (!snapEnabled || snapVertices.length === 0) return null;
    if (snapMode === 'edge') return null; // Don't show vertices in edge-only mode

    // Filter out the nearest vertex if snapping to vertex (it will be shown by the indicator layer)
    const filteredVertices = (nearestSnap && nearestSnap.type === 'vertex')
      ? snapVertices.filter(coord =>
          coord[0] !== nearestSnap.point[0] || coord[1] !== nearestSnap.point[1]
        )
      : snapVertices;

    return new ScatterplotLayer({
      id: 'snap-vertices-layer',
      data: filteredVertices,
      getPosition: (d: [number, number]) => d,
      getFillColor: [255, 0, 255, 120],  // Magenta semi-transparent
      getLineColor: [255, 255, 255, 150],
      getRadius: 4,
      radiusMinPixels: 2,
      radiusMaxPixels: 6,
      stroked: true,
      lineWidthMinPixels: 1,
      pickable: false,
      updateTriggers: {
        data: [nearestSnap?.point],
      },
    });
  }, [snapEnabled, snapVertices, nearestSnap, snapMode]);

  // Get history actions
  const { revertHistoryEntry, reapplyHistoryEntry } = useStore();

  // Keyboard shortcuts for copy/paste/delete/undo/redo
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if typing in input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      // Ctrl+C / Cmd+C - Copy
      if ((e.ctrlKey || e.metaKey) && e.key === 'c') {
        e.preventDefault();
        copyFeatures();
      }

      // Ctrl+V / Cmd+V - Paste
      if ((e.ctrlKey || e.metaKey) && e.key === 'v') {
        e.preventDefault();
        pasteFeatures();
      }

      // Ctrl+Z / Cmd+Z - Undo (revert last non-reverted entry)
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        const lastActive = history.find(h => !h.isReverted);
        if (lastActive) {
          revertHistoryEntry(lastActive.id);
        }
      }

      // Ctrl+Shift+Z / Cmd+Shift+Z - Redo (re-apply last reverted entry)
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && e.shiftKey) {
        e.preventDefault();
        // Find the most recently reverted entry
        const lastReverted = [...history].reverse().find(h => h.isReverted);
        if (lastReverted) {
          reapplyHistoryEntry(lastReverted.id);
        }
      }

      // Ctrl+Y / Cmd+Y - Redo (alternative)
      if ((e.ctrlKey || e.metaKey) && e.key === 'y') {
        e.preventDefault();
        const lastReverted = [...history].reverse().find(h => h.isReverted);
        if (lastReverted) {
          reapplyHistoryEntry(lastReverted.id);
        }
      }

      // Delete / Backspace - Delete selected
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedFeatureIndexes.length > 0) {
          e.preventDefault();
          deleteSelectedFeatures();
        }
      }

      // H - Toggle history panel
      if (e.key === 'h' || e.key === 'H') {
        setShowHistoryPanel(prev => !prev);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [copyFeatures, pasteFeatures, deleteSelectedFeatures, selectedFeatureIndexes, history, revertHistoryEntry, reapplyHistoryEntry]);

  // Generate snap guides when drawing coordinates change
  useEffect(() => {
    if (!snapGuidesEnabled) {
      if (snapGuides.length > 0) {
        clearSnapGuides();
      }
      return;
    }

    if (drawingCoords.length === 0) {
      if (snapGuides.length > 0) {
        clearSnapGuides();
      }
      return;
    }

    // Only generate guides during draw modes
    const isDrawMode = editMode.startsWith('draw-') || editMode === 'extend-line';
    if (!isDrawMode) {
      if (snapGuides.length > 0) {
        clearSnapGuides();
      }
      return;
    }

    const guides = generateSnapGuides(drawingCoords, true);
    setSnapGuides(guides);
  }, [snapGuidesEnabled, drawingCoords, editMode, snapGuides.length, setSnapGuides, clearSnapGuides]);

  // Clear guides when exiting draw mode
  useEffect(() => {
    const isDrawMode = editMode.startsWith('draw-') || editMode === 'extend-line';
    if (!isDrawMode) {
      setDrawingCoords([]);
      if (snapGuides.length > 0) {
        clearSnapGuides();
      }
    }
  }, [editMode, snapGuides.length, clearSnapGuides]);

  // Pulsing animation for snap indicator
  const [pulseSize, setPulseSize] = useState(1);
  useEffect(() => {
    if (!nearestSnap) {
      setPulseSize(1);
      return;
    }
    const interval = setInterval(() => {
      setPulseSize(prev => prev >= 1.5 ? 1 : prev + 0.1);
    }, 50);
    return () => clearInterval(interval);
  }, [nearestSnap]);

  // Snap indicator layer - prominent crosshair/target at active snap point
  const snapIndicatorLayer = useMemo(() => {
    if (!nearestSnap) return null;

    // Different colors for vertex vs edge snap
    const isVertex = nearestSnap.type === 'vertex';
    const fillColor: [number, number, number, number] = isVertex
      ? [0, 255, 100, 255]   // Green for vertex
      : [255, 200, 0, 255];  // Orange/yellow for edge

    return new ScatterplotLayer({
      id: 'snap-indicator-layer',
      data: [nearestSnap.point],
      getPosition: (d: [number, number]) => d,
      getFillColor: fillColor,
      getLineColor: [255, 255, 255, 255],  // White outline
      getRadius: 12 * pulseSize,
      radiusMinPixels: 8,
      radiusMaxPixels: 20,
      stroked: true,
      lineWidthMinPixels: 3,
      pickable: false,
      updateTriggers: {
        getRadius: [pulseSize],
        getFillColor: [nearestSnap.type],
      },
    });
  }, [nearestSnap, pulseSize]);

  // Snap edge highlight layer - shows the edge being snapped to
  const snapEdgeHighlightLayer = useMemo(() => {
    if (!nearestSnap || nearestSnap.type !== 'edge' || !nearestSnap.edge) return null;

    return new LineLayer({
      id: 'snap-edge-highlight-layer',
      data: [{
        source: nearestSnap.edge[0],
        target: nearestSnap.edge[1],
      }],
      getSourcePosition: (d: any) => d.source,
      getTargetPosition: (d: any) => d.target,
      getColor: [255, 200, 0, 255],  // Orange/yellow to match indicator
      getWidth: 4,
      widthMinPixels: 3,
      widthMaxPixels: 6,
      pickable: false,
    });
  }, [nearestSnap]);

  // Viewport bounds for extending guide lines
  const viewportBounds = useMemo(() => {
    // Approximate viewport bounds in degrees
    const metersPerDegree = 111000;
    const latRad = viewState.latitude * Math.PI / 180;
    const metersPerDegreeLon = metersPerDegree * Math.cos(latRad);

    // Calculate viewport size in degrees based on zoom
    const metersPerPixel = 156543.03392 * Math.cos(latRad) / Math.pow(2, viewState.zoom);
    const viewWidthPx = 1920; // Approximate
    const viewHeightPx = 1080;

    const halfWidthDeg = (viewWidthPx * metersPerPixel) / metersPerDegreeLon / 2;
    const halfHeightDeg = (viewHeightPx * metersPerPixel) / metersPerDegree / 2;

    return {
      minLon: viewState.longitude - halfWidthDeg * 1.5,
      maxLon: viewState.longitude + halfWidthDeg * 1.5,
      minLat: viewState.latitude - halfHeightDeg * 1.5,
      maxLat: viewState.latitude + halfHeightDeg * 1.5
    };
  }, [viewState.longitude, viewState.latitude, viewState.zoom]);

  // Find nearest guide snap
  const nearestGuideSnap = useMemo((): GuideSnapResult | null => {
    if (!snapGuidesEnabled || !mousePosition || snapGuides.length === 0) return null;
    return findGuideSnap(mousePosition, snapGuides, snapThresholdDegrees);
  }, [snapGuidesEnabled, mousePosition, snapGuides, snapThresholdDegrees]);

  // Guide intersection points
  const guideIntersections = useMemo(() => {
    if (!snapGuidesEnabled || snapGuides.length < 2) return [];
    return findGuideIntersections(snapGuides);
  }, [snapGuidesEnabled, snapGuides]);

  // Snap guides layer - renders dashed lines across the viewport
  const snapGuidesLayer = useMemo(() => {
    if (!snapGuidesEnabled || snapGuides.length === 0) {
      return null;
    }

    // Extend guides to viewport and create line data
    const guideLines = snapGuides.map(guide => {
      const extended = extendGuideToViewport(guide, viewportBounds);
      return {
        id: guide.id,
        type: guide.type,
        sourcePosition: extended[0],
        targetPosition: extended[1]
      };
    });

    return new LineLayer({
      id: 'snap-guides-layer',
      data: guideLines,
      getSourcePosition: (d: any) => d.sourcePosition,
      getTargetPosition: (d: any) => d.targetPosition,
      getColor: (d: any) => {
        // Different colors for different guide types
        switch (d.type) {
          case 'horizontal': return [255, 200, 50, 180];  // Yellow
          case 'vertical': return [255, 200, 50, 180];    // Yellow
          case 'parallel': return [100, 200, 255, 180];   // Cyan
          case 'orthogonal': return [255, 100, 200, 180]; // Pink
          default: return [255, 200, 50, 180];
        }
      },
      getWidth: 1,
      widthMinPixels: 1,
      widthMaxPixels: 2,
      // Dashed line effect using extensions
      getDashArray: [8, 4],
      dashJustified: true,
      extensions: [],
      pickable: false
    });
  }, [snapGuidesEnabled, snapGuides, viewportBounds]);

  // Guide intersections layer - shows intersection points
  const guideIntersectionsLayer = useMemo(() => {
    if (!snapGuidesEnabled || guideIntersections.length === 0) return null;

    return new ScatterplotLayer({
      id: 'guide-intersections-layer',
      data: guideIntersections,
      getPosition: (d: [number, number]) => d,
      getFillColor: [255, 255, 0, 200],  // Yellow
      getLineColor: [255, 255, 255, 255],
      getRadius: 6,
      radiusMinPixels: 4,
      radiusMaxPixels: 8,
      stroked: true,
      lineWidthMinPixels: 2,
      pickable: false
    });
  }, [snapGuidesEnabled, guideIntersections]);

  // Guide snap indicator - highlights when near a guide
  const guideSnapIndicatorLayer = useMemo(() => {
    if (!nearestGuideSnap) return null;

    const isIntersection = nearestGuideSnap.type === 'intersection';
    const fillColor: [number, number, number, number] = isIntersection
      ? [255, 255, 0, 255]    // Yellow for intersection
      : [100, 200, 255, 255]; // Cyan for guide line

    return new ScatterplotLayer({
      id: 'guide-snap-indicator-layer',
      data: [nearestGuideSnap.point],
      getPosition: (d: [number, number]) => d,
      getFillColor: fillColor,
      getLineColor: [255, 255, 255, 255],
      getRadius: 10 * pulseSize,
      radiusMinPixels: 6,
      radiusMaxPixels: 16,
      stroked: true,
      lineWidthMinPixels: 2,
      pickable: false,
      updateTriggers: {
        getRadius: [pulseSize],
        getFillColor: [nearestGuideSnap.type]
      }
    });
  }, [nearestGuideSnap, pulseSize]);

  // Snap guide line - from cursor to snap point
  const snapGuideLayer = useMemo(() => {
    if (!nearestSnap || !mousePosition) return null;

    // Only show guide line if cursor is not exactly on snap point
    const dx = mousePosition[0] - nearestSnap.point[0];
    const dy = mousePosition[1] - nearestSnap.point[1];
    const dist = Math.sqrt(dx * dx + dy * dy);

    // Don't show if too close (basically on top of snap point)
    if (dist < snapThresholdDegrees * 0.1) return null;

    return new LineLayer({
      id: 'snap-guide-layer',
      data: [{
        source: mousePosition,
        target: nearestSnap.point,
      }],
      getSourcePosition: (d: any) => d.source,
      getTargetPosition: (d: any) => d.target,
      getColor: [0, 255, 100, 200],  // Green semi-transparent
      getWidth: 2,
      widthMinPixels: 1,
      widthMaxPixels: 3,
      pickable: false,
    });
  }, [nearestSnap, mousePosition, snapThresholdDegrees]);

  // Handle click on features
  // IMPORTANT: Don't interfere with draw modes - they handle clicks via onEdit
  const handleClick = useCallback(
    (info: PickingInfo) => {
      // Skip click handling during draw/measure/selection modes - let layers handle it
      const nonClickableModes = [
        // Selection tools
        'select-rectangle', 'select-lasso',
        // Basic drawing
        'draw-point', 'draw-line', 'draw-polygon', 'draw-lasso', 'extend-line',
        // Shapes
        'draw-rectangle', 'draw-rectangle-center', 'draw-rectangle-3pts',
        'draw-square', 'draw-square-center',
        'draw-circle', 'draw-circle-diameter', 'resize-circle',
        'draw-ellipse', 'draw-ellipse-3pts', 'draw-90deg-polygon',
        // Split/Edit that use click
        'split-polygon', 'duplicate',
        // Composite
        'composite-draw-modify',
        // Measurement
        'measure-distance', 'measure-area', 'measure-angle',
      ];
      if (nonClickableModes.includes(editMode)) {
        return;
      }

      // Select snap reference mode - toggle MVT features as snap references
      if (editMode === 'select-snap-ref') {
        if (info.object && info.layer?.id?.startsWith('mvt-layer-')) {
          const feature = info.object as Feature;
          toggleSnapReference(feature);
        }
        return;
      }

      if (!info.object) {
        // Clicked on empty space (only in non-draw modes)
        selectFeature([]);
        setPopupInfo(null);
        return;
      }

      // Delete mode - remove clicked feature
      if (editMode === 'delete' && info.layer?.id === 'editable-layer') {
        const featureIndex = info.index;
        if (featureIndex >= 0 && featureIndex < features.features.length) {
          const deletedFeature = features.features[featureIndex];

          // Track in history before deleting
          addHistoryEntry({
            operationType: 'delete',
            description: `Deletou ${deletedFeature.geometry?.type || 'Geometria'}`,
            featureId: deletedFeature.id ?? featureIndex,
            featureIndex,
            beforeState: JSON.parse(JSON.stringify(deletedFeature)),
            afterState: null,
          });

          const newFeatures = {
            ...features,
            features: features.features.filter((_, i) => i !== featureIndex),
          };
          updateFeatures(newFeatures);
          setPrevFeatures(newFeatures.features);
        }
        return;
      }

      // Select feature for modify/translate
      if (
        info.layer?.id === 'editable-layer' &&
        (editMode === 'modify' || editMode === 'translate')
      ) {
        selectFeature([info.index]);
        return;
      }

      // Show popup for MVT layer click (only in view mode)
      if (editMode === 'view' && info.layer?.id?.startsWith('mvt-layer-')) {
        const feature = info.object as Feature;
        setPopupInfo({
          x: info.x,
          y: info.y,
          feature,
        });
      }
    },
    [editMode, features, selectFeature, updateFeatures, toggleSnapReference]
  );

  // Handle hover - track mouse position for snap preview
  const handleHover = useCallback((info: PickingInfo) => {
    // Update mouse position for snap preview when snap is enabled
    const hasSnapTargets = snapVertices.length > 0 || snapEdges.length > 0;
    if (snapEnabled && hasSnapTargets && info.coordinate) {
      setMousePosition([info.coordinate[0], info.coordinate[1]]);
    } else if (mousePosition !== null && !snapEnabled) {
      setMousePosition(null);
    }
  }, [snapEnabled, snapVertices.length, snapEdges.length, mousePosition]);

  // Get cursor based on edit mode
  const getCursor = useCallback(() => {
    switch (editMode) {
      // Selection tools - crosshair for drawing selection area
      case 'select-rectangle':
      case 'select-lasso':
        return 'crosshair';

      // All draw modes use crosshair
      case 'draw-point':
      case 'draw-line':
      case 'draw-polygon':
      case 'draw-lasso':
      case 'extend-line':
      case 'draw-rectangle':
      case 'draw-rectangle-center':
      case 'draw-rectangle-3pts':
      case 'draw-square':
      case 'draw-square-center':
      case 'draw-circle':
      case 'draw-circle-diameter':
      case 'resize-circle':
      case 'draw-ellipse':
      case 'draw-ellipse-3pts':
      case 'draw-90deg-polygon':
      case 'split-polygon':
      case 'composite-draw-modify':
        return 'crosshair';

      // Measurement modes
      case 'measure-distance':
      case 'measure-area':
      case 'measure-angle':
        return 'crosshair';

      // Delete mode
      case 'delete':
        return 'not-allowed';

      // Selection modes
      case 'select-snap-ref':
      case 'duplicate':
        return 'pointer';

      // Transform modes - use move cursor
      case 'modify':
      case 'translate':
      case 'rotate':
      case 'scale':
      case 'extrude':
      case 'elevation':
      case 'transform':
        return 'move';

      // Default navigation
      case 'view':
      default:
        return 'grab';
    }
  }, [editMode]);

  return (
    <div className="flex flex-col h-screen">
      {/* Header */}
      <header className="bg-secondary px-5 py-3 flex items-center justify-between border-b border-gray-700">
        <div className="flex items-center gap-5">
          <h1 className="text-lg font-bold text-primary">Geo360 Editor</h1>
          {currentOrg && (
            <span className="bg-primary text-dark px-3 py-1 rounded-full text-xs font-semibold">
              {currentOrg.name}
            </span>
          )}
        </div>

        <div className="flex items-center gap-4">
          {/* Debug info */}
          <div className="text-xs font-mono">
            <span className="text-gray-500">Auth: </span>
            <span
              className={
                debugInfo.authStatus === 'ok'
                  ? 'text-primary'
                  : debugInfo.authStatus === 'refreshing'
                  ? 'text-warning'
                  : 'text-danger'
              }
            >
              {debugInfo.authStatus.toUpperCase()}
            </span>
          </div>

          <button
            onClick={logout}
            className="px-4 py-2 bg-gray-700 text-white rounded-lg text-sm hover:bg-gray-600 transition-colors"
          >
            Sair
          </button>
        </div>
      </header>

      {/* Main content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <aside className="w-80 bg-secondary border-r border-gray-700 flex flex-col overflow-hidden">
          <LayerPanel />
        </aside>

        {/* Map container */}
        <main className="flex-1 relative">
          <DeckGL
            viewState={viewState}
            onViewStateChange={({ viewState }) =>
              setViewState(viewState as MapViewState)
            }
            controller={{ doubleClickZoom: false }}
            layers={[
              ...tileLayers,
              snapReferenceLayer,
              snapVerticesLayer,
              snapEdgeHighlightLayer,
              snapGuidesLayer,
              guideIntersectionsLayer,
              guideSnapIndicatorLayer,
              snapGuideLayer,
              snapIndicatorLayer,
              editableLayer,
              selectionLayer,
            ].filter(Boolean)}
            onClick={handleClick}
            onHover={handleHover}
            getCursor={getCursor}
            useDevicePixels={true}
            onError={(error) => console.error('DeckGL Error:', error)}
          >
            <Map
              mapStyle="https://basemaps.cartocdn.com/gl/positron-gl-style/style.json"
              reuseMaps
            />
          </DeckGL>

          {/* Edit toolbar */}
          <EditToolbar />

          {/* Feature panel (selected editable feature) */}
          {selectedFeatureIndexes.length > 0 && editMode !== 'view' && (
            <FeaturePanel />
          )}

          {/* History toggle button */}
          <button
            onClick={() => setShowHistoryPanel(!showHistoryPanel)}
            className={`
              absolute top-4 right-4 z-10 px-3 py-2 rounded-lg shadow-lg transition-all
              flex items-center gap-2
              ${showHistoryPanel
                ? 'bg-primary text-dark'
                : 'bg-secondary/95 text-gray-300 hover:bg-secondary'
              }
            `}
            title="Histórico de operações"
          >
            <span className="text-lg">H</span>
            <span className="text-sm font-medium">Histórico</span>
            {history.length > 0 && (
              <span className={`
                px-1.5 py-0.5 text-xs rounded-full
                ${showHistoryPanel ? 'bg-dark/20 text-dark' : 'bg-primary text-dark'}
              `}>
                {history.length}
              </span>
            )}
          </button>

          {/* History panel */}
          {showHistoryPanel && (
            <div className="absolute top-16 right-4 z-10 w-80 max-h-[calc(100vh-200px)] bg-secondary/95 rounded-lg shadow-xl border border-gray-700 overflow-hidden">
              <HistoryPanel />
            </div>
          )}

          {/* Popup for clicked MVT feature */}
          {popupInfo && (
            <div
              className="absolute bg-secondary/95 border border-primary rounded-lg shadow-xl max-w-sm z-10"
              style={{
                left: Math.min(popupInfo.x + 10, window.innerWidth - 320),
                top: Math.min(popupInfo.y + 10, window.innerHeight - 300),
              }}
            >
              <div className="flex items-center justify-between px-3 py-2 bg-primary text-dark rounded-t-lg">
                <span className="font-semibold text-sm">Atributos</span>
                <button
                  onClick={() => setPopupInfo(null)}
                  className="text-dark/70 hover:text-dark text-lg leading-none"
                >
                  &times;
                </button>
              </div>
              <div className="p-3 max-h-60 overflow-y-auto text-sm">
                {Object.entries(popupInfo.feature.properties || {}).map(
                  ([key, value]) => (
                    <div
                      key={key}
                      className="flex py-1 border-b border-gray-700 last:border-0"
                    >
                      <span className="w-28 text-primary font-mono text-xs flex-shrink-0">
                        {key}
                      </span>
                      <span className="text-gray-300 break-words">
                        {String(value ?? 'NULL')}
                      </span>
                    </div>
                  )
                )}
              </div>
            </div>
          )}

          {/* Map info */}
          <div className="absolute bottom-5 left-5 bg-secondary/90 px-4 py-2 rounded-lg text-xs font-mono">
            Zoom: {viewState.zoom.toFixed(1)} | Centro:{' '}
            {viewState.longitude.toFixed(4)}, {viewState.latitude.toFixed(4)}
          </div>

          {/* Snap indicator overlay */}
          {nearestSnap && snapEnabled && (
            <div className={`absolute bottom-5 right-5 px-4 py-3 rounded-lg shadow-xl z-20 border-2 ${
              nearestSnap.type === 'vertex'
                ? 'bg-green-900/95 border-green-400'
                : 'bg-amber-900/95 border-amber-400'
            }`}>
              <div className="flex items-center gap-2 mb-2">
                <div className={`w-3 h-3 rounded-full animate-pulse ${
                  nearestSnap.type === 'vertex' ? 'bg-green-400' : 'bg-amber-400'
                }`} />
                <span className={`font-semibold text-sm ${
                  nearestSnap.type === 'vertex' ? 'text-green-400' : 'text-amber-400'
                }`}>
                  SNAP {nearestSnap.type === 'vertex' ? 'VÉRTICE' : 'ARESTA'}
                </span>
              </div>
              <div className={`text-xs font-mono ${
                nearestSnap.type === 'vertex' ? 'text-green-200' : 'text-amber-200'
              }`}>
                <div>Lon: {nearestSnap.point[0].toFixed(6)}</div>
                <div>Lat: {nearestSnap.point[1].toFixed(6)}</div>
              </div>
              <div className={`mt-2 text-xs ${
                nearestSnap.type === 'vertex' ? 'text-green-300/70' : 'text-amber-300/70'
              }`}>
                Clique para usar este ponto
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
