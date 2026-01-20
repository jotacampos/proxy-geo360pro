import { useRef, useCallback, useState, useMemo, useEffect } from 'react';
import Map, { NavigationControl, ScaleControl, type MapRef } from 'react-map-gl/maplibre';
import DeckGL from '@deck.gl/react';
import { WebMercatorViewport, FlyToInterpolator } from '@deck.gl/core';
import { GeoJsonLayer, ScatterplotLayer } from '@deck.gl/layers';
import type { PickingInfo, MapViewState } from '@deck.gl/core';
import {
  EditableGeoJsonLayer,
  DrawPointMode,
  DrawLineStringMode,
  DrawPolygonMode,
  DrawRectangleMode,
  DrawCircleFromCenterMode,
  DrawEllipseByBoundingBoxMode,
  Draw90DegreePolygonMode,
  DrawPolygonByDraggingMode,
  ModifyMode,
  TranslateMode,
  RotateMode,
  ScaleMode,
  TransformMode,
  ExtendLineStringMode,
  SplitPolygonMode,
  ExtrudeMode,
  ElevationMode,
  ViewMode,
} from '@deck.gl-community/editable-layers';
import { useEditorStore, useMapStore, type DrawingMode } from '../../stores';
import { useMeasurementLayers, calculateTotalLength, calculateArea } from './MeasurementLayer';
import { useSnapLayers } from './SnapGuidesLayer';
import 'maplibre-gl/dist/maplibre-gl.css';

// Initial view state centered on Goiânia, Brazil
const INITIAL_VIEW_STATE: MapViewState = {
  longitude: -49.2800,
  latitude: -16.6800,
  zoom: 15,
  pitch: 0,
  bearing: 0,
};

interface ViewState {
  longitude: number;
  latitude: number;
  zoom: number;
  pitch: number;
  bearing: number;
}

interface MapViewProps {
  onViewStateChange?: (viewState: ViewState) => void;
  onFeatureClick?: (info: PickingInfo) => void;
  onFeatureHover?: (info: PickingInfo) => void;
  hoveredFeatureIndex?: number | null;
  flyToFeatureIndex?: number | null;
  onFlyToComplete?: () => void;
  selectionMode?: 'single' | 'multi' | null;
}

// Helper to calculate bounding box of a geometry
function getGeometryBounds(geometry: any): { minLon: number; minLat: number; maxLon: number; maxLat: number } | null {
  if (!geometry) return null;

  const coords: number[][] = [];

  const extractCoords = (arr: any): void => {
    if (typeof arr[0] === 'number') {
      coords.push(arr as number[]);
    } else if (Array.isArray(arr)) {
      arr.forEach(extractCoords);
    }
  };

  if (geometry.type === 'Point') {
    const [lon, lat] = geometry.coordinates;
    // For points, create a small bounding box around it
    return { minLon: lon - 0.001, minLat: lat - 0.001, maxLon: lon + 0.001, maxLat: lat + 0.001 };
  }

  extractCoords(geometry.coordinates);

  if (coords.length === 0) return null;

  let minLon = Infinity, minLat = Infinity, maxLon = -Infinity, maxLat = -Infinity;
  coords.forEach(([lon, lat]) => {
    if (lon < minLon) minLon = lon;
    if (lon > maxLon) maxLon = lon;
    if (lat < minLat) minLat = lat;
    if (lat > maxLat) maxLat = lat;
  });

  // Add some padding
  const lonPadding = (maxLon - minLon) * 0.2 || 0.001;
  const latPadding = (maxLat - minLat) * 0.2 || 0.001;

  return {
    minLon: minLon - lonPadding,
    minLat: minLat - latPadding,
    maxLon: maxLon + lonPadding,
    maxLat: maxLat + latPadding,
  };
}

// Map tool IDs to editable-layers modes
const MODE_MAP: Record<DrawingMode, new () => any> = {
  'view': ViewMode,
  'draw-point': DrawPointMode,
  'draw-line': DrawLineStringMode,
  'draw-polygon': DrawPolygonMode,
  'draw-rectangle': DrawRectangleMode,
  'draw-rectangle-3pts': DrawRectangleMode, // Use standard rectangle for now
  'draw-square': DrawRectangleMode, // Will constrain to square
  'draw-circle': DrawCircleFromCenterMode,
  'draw-ellipse': DrawEllipseByBoundingBoxMode,
  'draw-90deg-polygon': Draw90DegreePolygonMode,
  'draw-lasso': DrawPolygonByDraggingMode,
  'extend-line': ExtendLineStringMode,
  'modify': ModifyMode,
  'translate': TranslateMode,
  'rotate': RotateMode,
  'scale': ScaleMode,
  'transform': TransformMode,
  'duplicate': ViewMode, // Handle separately
  'split-polygon': SplitPolygonMode,
  'extrude': ExtrudeMode,
  'elevation': ElevationMode,
  'measure-distance': ViewMode, // Handled by measurement layer
  'measure-area': ViewMode, // Handled by measurement layer
};

// Drawing modes that should trigger feature creation
const DRAWING_MODES: DrawingMode[] = [
  'draw-point',
  'draw-line',
  'draw-polygon',
  'draw-rectangle',
  'draw-rectangle-3pts',
  'draw-square',
  'draw-circle',
  'draw-ellipse',
  'draw-90deg-polygon',
  'draw-lasso',
  'extend-line',
];

export function MapView({ onViewStateChange, onFeatureClick, onFeatureHover, hoveredFeatureIndex, flyToFeatureIndex, onFlyToComplete, selectionMode }: MapViewProps) {
  const mapRef = useRef<MapRef>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [cursor, setCursor] = useState<string>('grab');
  const [viewState, setViewState] = useState<MapViewState>(INITIAL_VIEW_STATE);
  const [isReady, setIsReady] = useState(false);
  const [mousePosition, setMousePosition] = useState<[number, number] | null>(null);

  // Wait for container to have dimensions before rendering DeckGL
  useEffect(() => {
    const checkReady = () => {
      if (containerRef.current) {
        const { clientWidth, clientHeight } = containerRef.current;
        if (clientWidth > 0 && clientHeight > 0) {
          setIsReady(true);
          return;
        }
      }
      // Retry after a short delay
      requestAnimationFrame(checkReady);
    };
    checkReady();
  }, []);

  // Editor store
  const {
    features,
    selectedIndexes,
    mode,
    drawingStyle,
    snapEnabled,
    isDrawing: storeIsDrawing,
    drawingCoordinates,
    setSelectedIndexes,
    setFeatures,
    setDrawingCoordinates,
    setLastClickCoordinate,
    silentMode,
    finishDrawing,
    activeVertexIndex,
    setActiveVertexIndex,
    // Measurement
    measurementMode,
    measurementCoordinates,
    addMeasurementCoordinate,
    addMeasurementResult,
  } = useEditorStore();

  // Map store - basemap style
  const { basemapStyle } = useMapStore();

  // Measurement layers
  const measurementLayers = useMeasurementLayers();

  // Snap layers with mouse position tracking
  const {
    layers: snapLayers,
    // nearestSnap and nearestGuideSnap available for UI feedback if needed
    applySnap,
  } = useSnapLayers({
    viewState: {
      longitude: viewState.longitude,
      latitude: viewState.latitude,
      zoom: viewState.zoom,
    },
    mousePosition,
  });

  // Get the mode class based on current mode
  // When storeIsDrawing is true, we use ViewMode for EditableGeoJsonLayer
  // because we handle drawing ourselves with the coordinate panel
  const ModeClass = storeIsDrawing ? ViewMode : (MODE_MAP[mode] || ViewMode);
  const modeInstance = useMemo(() => new ModeClass(), [ModeClass, storeIsDrawing]);

  // Handle edit events from EditableGeoJsonLayer
  const handleEdit = useCallback(({ updatedData }: { updatedData: any; editType?: string; editContext?: any }) => {
    if (!updatedData) return;

    // Update the feature collection
    setFeatures(updatedData);
  }, [setFeatures]);

  // Handle flyTo when flyToFeatureIndex changes
  useEffect(() => {
    if (flyToFeatureIndex === null || flyToFeatureIndex === undefined) return;

    const feature = features.features[flyToFeatureIndex];
    if (!feature?.geometry) return;

    const bounds = getGeometryBounds(feature.geometry);
    if (!bounds) return;

    // Calculate center and zoom to fit bounds
    const centerLon = (bounds.minLon + bounds.maxLon) / 2;
    const centerLat = (bounds.minLat + bounds.maxLat) / 2;

    // Calculate zoom level based on bounds
    const lonRange = bounds.maxLon - bounds.minLon;
    const latRange = bounds.maxLat - bounds.minLat;
    const lonZoom = Math.log2(360 / lonRange) - 1;
    const latZoom = Math.log2(180 / latRange) - 1;
    const targetZoom = Math.min(lonZoom, latZoom, 18);

    setViewState(prev => ({
      ...prev,
      longitude: centerLon,
      latitude: centerLat,
      zoom: Math.max(targetZoom, 12),
      transitionDuration: 1000,
      transitionInterpolator: new FlyToInterpolator(),
    }));

    onFlyToComplete?.();
  }, [flyToFeatureIndex, features.features, onFlyToComplete]);

  // Determine if layer should be interactive
  const editModes = ['modify', 'translate', 'rotate', 'scale', 'transform', 'extrude', 'elevation'];
  const isEditMode = editModes.includes(mode);
  const isActiveMode = mode !== 'view';
  // Layer is pickable when: active mode, edit mode, selection mode active, OR there are selected objects (to allow clearing)
  const shouldBePickable = isActiveMode || isEditMode || selectionMode !== null || selectedIndexes.length > 0;

  // Create the editable layer with memoization for hover highlighting
  const editableLayer = useMemo(() => new EditableGeoJsonLayer({
    id: 'editable-layer',
    data: features as any, // Type cast to avoid strict GeoJSON type issues
    mode: modeInstance,
    selectedFeatureIndexes: selectedIndexes,

    // Styling
    getFillColor: (feature: any) => {
      const style = feature.properties?.style;
      if (style?.fillColor) return style.fillColor;
      return drawingStyle.fillColor;
    },
    getLineColor: (feature: any) => {
      const style = feature.properties?.style;
      if (style?.strokeColor) return style.strokeColor;
      return drawingStyle.strokeColor;
    },
    getLineWidth: (feature: any) => {
      const style = feature.properties?.style;
      if (style?.strokeWidth) return style.strokeWidth;
      return drawingStyle.strokeWidth;
    },
    lineWidthMinPixels: 1,

    // Tentative (drawing in progress) styling
    getTentativeFillColor: () => [...drawingStyle.fillColor.slice(0, 3), 50] as [number, number, number, number],
    getTentativeLineColor: () => drawingStyle.strokeColor,
    getTentativeLineWidth: () => drawingStyle.strokeWidth,

    // Edit handle styling
    getEditHandlePointColor: () => [16, 185, 129, 255] as [number, number, number, number], // Emerald
    getEditHandlePointRadius: () => 6,
    editHandlePointRadiusScale: 1,
    editHandlePointRadiusMinPixels: 4,
    editHandlePointRadiusMaxPixels: 10,

    // Interaction settings - only pickable when there's an active mode or selection
    pickable: shouldBePickable,
    autoHighlight: false, // Disabled - we control highlighting manually
    highlightColor: [16, 185, 129, 100],

    // Events
    onEdit: handleEdit,

    // Snap settings
    modeConfig: {
      enableSnapping: snapEnabled,
    },
  }), [features, modeInstance, selectedIndexes, drawingStyle, handleEdit, snapEnabled, shouldBePickable]);

  // Create a separate highlight layer for SELECTED features
  // This shows a distinct visual style for selected geometries
  const selectionHighlightLayer = useMemo(() => {
    if (selectedIndexes.length === 0) {
      return null;
    }

    const selectedFeatures = selectedIndexes
      .map(idx => features.features[idx])
      .filter(Boolean);

    if (selectedFeatures.length === 0) {
      return null;
    }

    return new GeoJsonLayer({
      id: 'selection-highlight-layer',
      data: {
        type: 'FeatureCollection',
        features: selectedFeatures,
      },
      stroked: true,
      filled: true,
      getFillColor: [16, 185, 129, 60], // Emerald with transparency
      getLineColor: [16, 185, 129, 255], // Solid emerald
      getLineWidth: 3,
      lineWidthMinPixels: 2,
      getPointRadius: 10,
      pointRadiusMinPixels: 6,
      pickable: false, // Don't interfere with picking on main layer
    });
  }, [selectedIndexes, features.features]);

  // Create a separate highlight layer for hovered features from the list panel
  // This only activates when hoveredFeatureIndex is set (from the sidebar list)
  const highlightLayer = useMemo(() => {
    // Only show highlight from sidebar list hover (hoveredFeatureIndex)
    if (hoveredFeatureIndex === null || hoveredFeatureIndex === undefined) {
      return null;
    }

    const hoveredFeature = features.features[hoveredFeatureIndex];
    if (!hoveredFeature) {
      return null;
    }

    return new GeoJsonLayer({
      id: 'hover-highlight-layer',
      data: {
        type: 'FeatureCollection',
        features: [hoveredFeature],
      },
      stroked: true,
      filled: true,
      getFillColor: [255, 215, 0, 120], // Gold with transparency
      getLineColor: [255, 215, 0, 255], // Solid gold
      getLineWidth: 4,
      lineWidthMinPixels: 3,
      getPointRadius: 12,
      pointRadiusMinPixels: 8,
      pickable: false, // Don't interfere with picking on main layer
    });
  }, [hoveredFeatureIndex, features.features]);

  // Create preview layers for drawing coordinates
  const previewLayers = useMemo(() => {
    if (!storeIsDrawing || drawingCoordinates.length === 0) {
      return [];
    }

    const layers: any[] = [];

    // Points layer - show all vertices
    layers.push(
      new ScatterplotLayer({
        id: 'drawing-vertices',
        data: drawingCoordinates.map((coord, index) => ({
          position: coord,
          index,
        })),
        getPosition: (d: any) => d.position,
        getRadius: 6,
        getFillColor: [16, 185, 129, 255], // Emerald
        getLineColor: [255, 255, 255, 255],
        getLineWidth: 2,
        stroked: true,
        radiusMinPixels: 6,
        radiusMaxPixels: 10,
        pickable: true,
      })
    );

    // 90-degree guide lines for draw-90deg-polygon mode
    if (mode === 'draw-90deg-polygon' && drawingCoordinates.length >= 1) {
      const lastPoint = drawingCoordinates[drawingCoordinates.length - 1];
      const guideLength = 0.01; // Approximately 1km at equator

      // Horizontal and vertical guide lines from the last point
      const guideLines = {
        type: 'FeatureCollection',
        features: [
          {
            type: 'Feature',
            geometry: {
              type: 'LineString',
              coordinates: [
                [lastPoint[0] - guideLength, lastPoint[1]],
                [lastPoint[0] + guideLength, lastPoint[1]],
              ],
            },
            properties: { direction: 'horizontal' },
          },
          {
            type: 'Feature',
            geometry: {
              type: 'LineString',
              coordinates: [
                [lastPoint[0], lastPoint[1] - guideLength],
                [lastPoint[0], lastPoint[1] + guideLength],
              ],
            },
            properties: { direction: 'vertical' },
          },
        ],
      };

      layers.push(
        new GeoJsonLayer({
          id: 'snap-guides-90deg',
          data: guideLines as any,
          stroked: true,
          getLineColor: [255, 165, 0, 180], // Orange with transparency
          getLineWidth: 1,
          lineWidthMinPixels: 1,
          getDashArray: [4, 4],
          extensions: [],
        })
      );
    }

    // Line/Polygon preview layer
    if (drawingCoordinates.length >= 2) {
      let geometry: any = null;

      if (mode === 'draw-line' || mode === 'extend-line') {
        geometry = {
          type: 'LineString',
          coordinates: drawingCoordinates,
        };
      } else if (mode === 'draw-polygon' || mode === 'draw-lasso') {
        // Show as polygon with closing line to first point
        const coords = [...drawingCoordinates];
        if (coords.length >= 3) {
          coords.push(coords[0]); // Close the polygon
        }
        geometry = {
          type: 'LineString',
          coordinates: coords,
        };
      } else if (mode === 'draw-90deg-polygon') {
        // Show as polygon with 90-degree closing
        const coords = [...drawingCoordinates];
        if (coords.length >= 3) {
          const firstPoint = coords[0];
          const lastPoint = coords[coords.length - 1];
          const secondToLastPoint = coords[coords.length - 2];

          // Check if first and last points are already aligned
          const isAlignedHorizontally = Math.abs(lastPoint[1] - firstPoint[1]) < 1e-9;
          const isAlignedVertically = Math.abs(lastPoint[0] - firstPoint[0]) < 1e-9;

          if (!isAlignedHorizontally && !isAlignedVertically) {
            // Add intermediate point for 90-degree closure
            const lastEdgeIsHorizontal = Math.abs(lastPoint[1] - secondToLastPoint[1]) < 1e-9;
            const intermediatePoint: [number, number] = lastEdgeIsHorizontal
              ? [firstPoint[0], lastPoint[1]]
              : [lastPoint[0], firstPoint[1]];
            coords.push(intermediatePoint);
          }
          coords.push(coords[0]); // Close the polygon
        }
        geometry = {
          type: 'LineString',
          coordinates: coords,
        };
      } else if ((mode === 'draw-rectangle' || mode === 'draw-square') && drawingCoordinates.length >= 2) {
        // Show rectangle preview
        const [x1, y1] = drawingCoordinates[0];
        const [x2, y2] = drawingCoordinates[1];
        geometry = {
          type: 'Polygon',
          coordinates: [[
            [x1, y1],
            [x2, y1],
            [x2, y2],
            [x1, y2],
            [x1, y1],
          ]],
        };
      } else if (mode === 'draw-circle' && drawingCoordinates.length >= 2) {
        // Show circle preview
        const [cx, cy] = drawingCoordinates[0];
        const [px, py] = drawingCoordinates[1];
        const radius = Math.sqrt(Math.pow(px - cx, 2) + Math.pow(py - cy, 2));
        const points: [number, number][] = [];
        for (let i = 0; i <= 32; i++) {
          const angle = (i / 32) * 2 * Math.PI;
          points.push([
            cx + radius * Math.cos(angle),
            cy + radius * Math.sin(angle),
          ]);
        }
        geometry = {
          type: 'Polygon',
          coordinates: [points],
        };
      }

      if (geometry) {
        layers.push(
          new GeoJsonLayer({
            id: 'drawing-preview',
            data: {
              type: 'Feature',
              geometry,
              properties: {},
            },
            stroked: true,
            filled: geometry.type === 'Polygon',
            getFillColor: [...drawingStyle.fillColor.slice(0, 3), 50] as [number, number, number, number],
            getLineColor: drawingStyle.strokeColor,
            getLineWidth: drawingStyle.strokeWidth,
            lineWidthMinPixels: 2,
          })
        );
      }
    }

    return layers;
  }, [storeIsDrawing, drawingCoordinates, mode, drawingStyle]);

  // Handle hover for cursor and mouse position tracking
  const handleHover = useCallback((info: PickingInfo) => {
    // Track mouse position for snap preview
    if (info.coordinate) {
      setMousePosition(info.coordinate as [number, number]);
    } else if (info.x !== undefined && info.y !== undefined) {
      // Convert screen coordinates to geographic using current viewport
      const container = mapRef.current?.getContainer();
      if (container) {
        const viewport = new WebMercatorViewport({
          ...viewState,
          width: container.clientWidth,
          height: container.clientHeight,
        });
        const coords = viewport.unproject([info.x, info.y]);
        setMousePosition(coords as [number, number]);
      }
    }

    const isDrawingMode = DRAWING_MODES.includes(mode);
    const editModes = ['modify', 'translate', 'rotate', 'scale', 'transform', 'extrude', 'elevation'];
    const isEditMode = editModes.includes(mode);
    const isMeasurementMode = measurementMode !== 'none';

    if (isMeasurementMode) {
      setCursor('crosshair');
    } else if (isDrawingMode) {
      setCursor('crosshair');
    } else if (isEditMode && info.object) {
      // In edit mode, show pointer when hovering over objects
      setCursor('pointer');
    } else if (selectionMode && info.object) {
      // In selection mode, show pointer when hovering over objects
      setCursor('pointer');
    } else if (selectionMode) {
      // In selection mode but not over object, show crosshair
      setCursor('crosshair');
    } else {
      // No mode active - just navigation
      setCursor('grab');
    }

    onFeatureHover?.(info);
  }, [mode, onFeatureHover, selectionMode, measurementMode, viewState]);

  // Get cursor style
  const getCursor = useCallback(() => cursor, [cursor]);

  // Determine if we should disable map panning (during drawing or editing)
  const isDrawing = DRAWING_MODES.includes(mode);
  const isEditModeActive = ['modify', 'translate', 'rotate', 'scale', 'transform', 'extrude', 'elevation'].includes(mode);
  const shouldDisablePan = isDrawing || (isEditModeActive && selectedIndexes.length > 0);

  // Handle view state changes - keep track for coordinate conversion
  const handleViewStateChangeInternal = useCallback((params: any) => {
    const newViewState = params.viewState;
    if (newViewState) {
      setViewState(newViewState);
      onViewStateChange?.({
        longitude: newViewState.longitude,
        latitude: newViewState.latitude,
        zoom: newViewState.zoom,
        pitch: newViewState.pitch || 0,
        bearing: newViewState.bearing || 0,
      });
    }
  }, [onViewStateChange]);

  // Handle click on the map (DeckGL level)
  const handleClick = useCallback((info: PickingInfo, event: any) => {
    // Check for double-click (to finish multi-vertex geometries)
    const srcEvent = event?.srcEvent as MouseEvent | undefined;
    const isDoubleClick = srcEvent?.detail === 2;

    // Handle measurement mode clicks
    if (measurementMode !== 'none') {
      let lon: number, lat: number;

      // Get coordinates from click
      if (info.coordinate) {
        [lon, lat] = info.coordinate as [number, number];
      } else if (info.x !== undefined && info.y !== undefined && info.viewport) {
        const coords = info.viewport.unproject([info.x, info.y]);
        [lon, lat] = coords as [number, number];
      } else if (info.x !== undefined && info.y !== undefined) {
        const container = mapRef.current?.getContainer();
        if (container) {
          const viewport = new WebMercatorViewport({
            ...viewState,
            width: container.clientWidth,
            height: container.clientHeight,
          });
          const coords = viewport.unproject([info.x, info.y]);
          [lon, lat] = coords as [number, number];
        } else {
          return false;
        }
      } else {
        return false;
      }

      // Double-click finishes measurement
      if (isDoubleClick && measurementCoordinates.length >= 2) {
        const minPoints = measurementMode === 'area' ? 3 : 2;
        if (measurementCoordinates.length >= minPoints) {
          // Save measurement result
          const value = measurementMode === 'distance'
            ? calculateTotalLength(measurementCoordinates)
            : calculateArea(measurementCoordinates);

          addMeasurementResult({
            type: measurementMode,
            value,
            unit: measurementMode === 'distance' ? 'm' : 'm²',
            coordinates: [...measurementCoordinates],
          });
          return true;
        }
      }

      // Add coordinate to measurement
      addMeasurementCoordinate([lon, lat]);
      return true;
    }

    // If in drawing mode, capture coordinates
    if (storeIsDrawing) {
      // Types that allow unlimited vertices
      const multiVertexTypes = ['draw-line', 'draw-polygon', 'draw-lasso', 'draw-90deg-polygon'];
      const isMultiVertexType = multiVertexTypes.includes(mode);

      // Double-click finishes multi-vertex geometries (in silent mode or with panel)
      if (isDoubleClick && isMultiVertexType && drawingCoordinates.length >= 2) {
        const minVerticesForType: Record<string, number> = {
          'draw-line': 2,
          'draw-polygon': 3,
          'draw-lasso': 3,
          'draw-90deg-polygon': 3,
        };
        const minRequired = minVerticesForType[mode] || 2;
        if (drawingCoordinates.length >= minRequired) {
          finishDrawing();
          return true;
        }
      }

      let lon: number, lat: number;

      // Try to get coordinates from info.coordinate first
      if (info.coordinate) {
        [lon, lat] = info.coordinate as [number, number];
      } else if (info.x !== undefined && info.y !== undefined && info.viewport) {
        // Convert screen coordinates to geographic using viewport
        const coords = info.viewport.unproject([info.x, info.y]);
        [lon, lat] = coords as [number, number];
      } else if (info.x !== undefined && info.y !== undefined) {
        // Fallback: create viewport from current view state
        const container = mapRef.current?.getContainer();
        if (container) {
          const viewport = new WebMercatorViewport({
            ...viewState,
            width: container.clientWidth,
            height: container.clientHeight,
          });
          const coords = viewport.unproject([info.x, info.y]);
          [lon, lat] = coords as [number, number];
        } else {
          return false;
        }
      } else {
        return false;
      }

      // Apply snap if enabled
      if (snapEnabled) {
        const snappedCoord = applySnap([lon, lat]);
        lon = snappedCoord[0];
        lat = snappedCoord[1];
      }

      // Apply 90-degree snap for draw-90deg-polygon mode (after general snap)
      if (mode === 'draw-90deg-polygon' && drawingCoordinates.length > 0) {
        const prevPoint = drawingCoordinates[drawingCoordinates.length - 1];
        const dx = Math.abs(lon - prevPoint[0]);
        const dy = Math.abs(lat - prevPoint[1]);

        // Snap to horizontal or vertical based on which direction is dominant
        if (dx >= dy) {
          // Horizontal movement dominant - keep lon, snap lat to previous
          lat = prevPoint[1];
        } else {
          // Vertical movement dominant - keep lat, snap lon to previous
          lon = prevPoint[0];
        }
      }

      // Max vertices for fixed-vertex types
      const maxVertices: Record<string, number> = {
        'draw-point': 1,
        'draw-rectangle': 2,
        'draw-rectangle-center': 2,
        'draw-rectangle-3pts': 3,
        'draw-square': 2,
        'draw-square-center': 2,
        'draw-circle': 2,
        'draw-circle-diameter': 2,
        'draw-ellipse': 2,
        'draw-ellipse-3pts': 3,
        'extend-line': 1,
        'resize-circle': 1,
      };
      const max = maxVertices[mode];

      // Types that should keep adding vertices without editing (like multi-vertex but with a max)
      const simpleAddTypes = [
        'draw-rectangle', 'draw-square', 'draw-circle', 'draw-ellipse',
        'draw-rectangle-center', 'draw-square-center', 'draw-circle-diameter',
        'draw-rectangle-3pts', 'draw-ellipse-3pts'
      ];
      const isSimpleAddType = simpleAddTypes.includes(mode);

      let newCoordinates: [number, number][];
      let newActiveIndex: number | null = null;

      if (drawingCoordinates.length === 0) {
        // First coordinate - add it
        newCoordinates = [[lon, lat]];
        // Keep activeVertexIndex null for multi-vertex and simple-add types
        newActiveIndex = (isMultiVertexType || isSimpleAddType) ? null : 0;
      } else if (activeVertexIndex !== null && !isSimpleAddType) {
        // User selected a specific vertex to edit - update it (not for simple add types)
        newCoordinates = [...drawingCoordinates];
        newCoordinates[activeVertexIndex] = [lon, lat];
        newActiveIndex = activeVertexIndex; // Keep same vertex active
      } else if (isMultiVertexType || isSimpleAddType) {
        // Multi-vertex and simple-add types: ADD new vertex on each click until max
        if (max && drawingCoordinates.length >= max) {
          // Max reached: replace the last coordinate
          newCoordinates = [...drawingCoordinates];
          newCoordinates[newCoordinates.length - 1] = [lon, lat];
        } else {
          // Add new vertex
          newCoordinates = [...drawingCoordinates, [lon, lat]];
        }
        newActiveIndex = null; // Stay in add mode
      } else if (max && drawingCoordinates.length < max) {
        // Fixed-vertex types: auto-add vertex until max is reached
        newCoordinates = [...drawingCoordinates, [lon, lat]];
        newActiveIndex = newCoordinates.length - 1;
      } else {
        // Max reached for fixed-vertex types: replace the last coordinate
        newCoordinates = [...drawingCoordinates];
        newCoordinates[newCoordinates.length - 1] = [lon, lat];
        newActiveIndex = newCoordinates.length - 1;
      }

      setDrawingCoordinates(newCoordinates);
      setActiveVertexIndex(newActiveIndex);
      setLastClickCoordinate([lon, lat]);

      // Clear selection when starting a new drawing to avoid ghost highlights
      if (selectedIndexes.length > 0) {
        setSelectedIndexes([]);
      }

      // Auto-finalize in silent mode only for point creation
      if (silentMode && mode === 'draw-point' && newCoordinates.length >= 1) {
        // Use setTimeout to ensure state is updated before finishing
        setTimeout(() => {
          finishDrawing();
        }, 0);
      }

      return true; // Prevent further handling
    }

    // Handle feature selection
    // In edit modes (modify, translate, rotate, scale), don't change selection on click
    const editModes = ['modify', 'translate', 'rotate', 'scale', 'transform', 'extrude', 'elevation'];
    const isEditMode = editModes.includes(mode);

    if (info.object && info.index !== undefined && info.index >= 0) {
      // In edit modes, only allow clicking on already selected features
      if (isEditMode) {
        // If clicking on an unselected feature in edit mode, add it to selection
        if (!selectedIndexes.includes(info.index)) {
          setSelectedIndexes([...selectedIndexes, info.index]);
        }
        // Otherwise just let the edit mode handle the interaction
      } else if (selectionMode) {
        // Selection is based on selectionMode (from menu)
        if (selectionMode === 'multi') {
          // Multi-select: toggle selection
          if (selectedIndexes.includes(info.index)) {
            setSelectedIndexes(selectedIndexes.filter(i => i !== info.index));
          } else {
            setSelectedIndexes([...selectedIndexes, info.index]);
          }
        } else {
          // Single-select: replace selection
          setSelectedIndexes([info.index]);
        }
        onFeatureClick?.(info);
      }
      // If selectionMode is null, don't select anything (just navigation)
    } else if (mode === 'view' && selectedIndexes.length > 0) {
      // Clear selection when clicking empty space in view mode (if there's a selection)
      setSelectedIndexes([]);
    }

    return false;
  }, [storeIsDrawing, drawingCoordinates, setDrawingCoordinates, setLastClickCoordinate, selectedIndexes, setSelectedIndexes, mode, onFeatureClick, viewState, silentMode, finishDrawing, activeVertexIndex, setActiveVertexIndex, selectionMode, measurementMode, measurementCoordinates, addMeasurementCoordinate, addMeasurementResult, snapEnabled, applySnap]);

  return (
    <div ref={containerRef} className="w-full h-full relative">
      {isReady ? (
        <DeckGL
          viewState={viewState}
          controller={{
            doubleClickZoom: !isDrawing,
            dragPan: !shouldDisablePan || mode === 'draw-point',
            dragRotate: !shouldDisablePan,
          }}
          layers={[editableLayer, selectionHighlightLayer, highlightLayer, ...previewLayers, ...measurementLayers, ...snapLayers].filter(Boolean)}
          onClick={handleClick}
          onHover={handleHover}
          getCursor={getCursor}
          onViewStateChange={handleViewStateChangeInternal}
        >
          <Map
            ref={mapRef}
            mapStyle={basemapStyle}
            attributionControl={false}
          >
            <NavigationControl position="bottom-right" showCompass={true} showZoom={true} />
            <ScaleControl position="bottom-left" maxWidth={100} unit="metric" />
          </Map>
        </DeckGL>
      ) : (
        <div className="w-full h-full flex items-center justify-center bg-gray-900">
          <div className="text-gray-500 text-sm">Carregando mapa...</div>
        </div>
      )}
    </div>
  );
}
