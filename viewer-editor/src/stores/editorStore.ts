import { create } from 'zustand';
import type { Feature, FeatureCollection, Geometry } from 'geojson';
import type { SnapMode, SnapGuide } from '../types/snap';

// Drawing mode types matching @deck.gl-community/editable-layers
export type DrawingMode =
  | 'view'
  | 'draw-point'
  | 'draw-line'
  | 'draw-polygon'
  | 'draw-rectangle'
  | 'draw-rectangle-3pts'
  | 'draw-square'
  | 'draw-circle'
  | 'draw-ellipse'
  | 'draw-90deg-polygon'
  | 'draw-lasso'
  | 'extend-line'
  | 'modify'
  | 'translate'
  | 'rotate'
  | 'scale'
  | 'transform'
  | 'duplicate'
  | 'split-polygon'
  | 'extrude'
  | 'elevation'
  | 'measure-distance'
  | 'measure-area';

export type MeasurementMode = 'none' | 'distance' | 'area';

export interface MeasurementResult {
  type: 'distance' | 'area';
  value: number;
  unit: string;
  coordinates: [number, number][];
}

export interface DrawingStyle {
  fillColor: [number, number, number, number];
  strokeColor: [number, number, number, number];
  strokeWidth: number;
}

export interface EditorFeature extends Feature {
  properties: {
    id: string;
    name?: string;
    style?: Partial<DrawingStyle>;
    createdAt: string;
    updatedAt: string;
    [key: string]: unknown;
  };
}

interface EditorStore {
  // Features
  features: FeatureCollection<Geometry, EditorFeature['properties']>;
  addFeature: (feature: Feature) => void;
  updateFeature: (index: number, feature: Feature) => void;
  deleteFeature: (index: number) => void;
  deleteFeatures: (indexes: number[]) => void;
  setFeatures: (features: FeatureCollection) => void;
  clearFeatures: () => void;

  // Selection
  selectedIndexes: number[];
  setSelectedIndexes: (indexes: number[]) => void;
  clearSelection: () => void;

  // Drawing mode
  mode: DrawingMode;
  setMode: (mode: DrawingMode) => void;

  // Drawing style
  drawingStyle: DrawingStyle;
  setDrawingStyle: (style: Partial<DrawingStyle>) => void;

  // Snap
  snapEnabled: boolean;
  setSnapEnabled: (enabled: boolean) => void;
  toggleSnap: () => void;

  // Snap mode (vertex, edge, or both)
  snapMode: SnapMode;
  setSnapMode: (mode: SnapMode) => void;

  // Snap threshold in pixels
  snapPixels: number;
  setSnapPixels: (pixels: number) => void;

  // Snap reference features (from external layers)
  snapReferenceFeatures: Feature[];
  toggleSnapReference: (feature: Feature) => void;
  removeSnapReference: (index: number) => void;
  clearSnapReferences: () => void;

  // Snap guides (orthogonal lines during drawing)
  snapGuidesEnabled: boolean;
  setSnapGuidesEnabled: (enabled: boolean) => void;
  toggleSnapGuides: () => void;
  snapGuides: SnapGuide[];
  setSnapGuides: (guides: SnapGuide[]) => void;
  clearSnapGuides: () => void;

  // Tentative feature (being drawn)
  tentativeFeature: Feature | null;
  setTentativeFeature: (feature: Feature | null) => void;

  // Drawing coordinates (vertices being added)
  drawingCoordinates: [number, number][];
  addDrawingCoordinate: (coord: [number, number]) => void;
  updateDrawingCoordinate: (index: number, coord: [number, number]) => void;
  removeDrawingCoordinate: (index: number) => void;
  clearDrawingCoordinates: () => void;
  setDrawingCoordinates: (coords: [number, number][]) => void;

  // Active vertex index for editing (null = add new vertex on click)
  activeVertexIndex: number | null;
  setActiveVertexIndex: (index: number | null) => void;

  // Last click coordinate (for display)
  lastClickCoordinate: [number, number] | null;
  setLastClickCoordinate: (coord: [number, number] | null) => void;

  // Drawing active state
  isDrawing: boolean;
  setIsDrawing: (drawing: boolean) => void;

  // Silent mode - don't show panel on subsequent drawings
  silentMode: boolean;
  setSilentMode: (silent: boolean) => void;

  // Finish current drawing and create feature
  finishDrawing: () => void;

  // History for undo/redo
  history: FeatureCollection[];
  historyIndex: number;
  pushHistory: () => void;
  undo: () => void;
  redo: () => void;
  canUndo: () => boolean;
  canRedo: () => boolean;

  // Measurement
  measurementMode: MeasurementMode;
  measurementCoordinates: [number, number][];
  measurementResults: MeasurementResult[];
  showMeasurements: boolean;
  setMeasurementMode: (mode: MeasurementMode) => void;
  addMeasurementCoordinate: (coord: [number, number]) => void;
  clearMeasurementCoordinates: () => void;
  addMeasurementResult: (result: MeasurementResult) => void;
  clearMeasurementResults: () => void;
  setShowMeasurements: (show: boolean) => void;
}

// Helper to generate unique IDs
const generateId = () => crypto.randomUUID();

// Helper to parse hex color to RGBA
export const hexToRgba = (hex: string, alpha = 255): [number, number, number, number] => {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (result) {
    return [
      parseInt(result[1], 16),
      parseInt(result[2], 16),
      parseInt(result[3], 16),
      alpha,
    ];
  }
  return [59, 130, 246, alpha]; // Default blue
};

// Default drawing style
const DEFAULT_STYLE: DrawingStyle = {
  fillColor: [59, 130, 246, 100], // Blue with opacity
  strokeColor: [30, 64, 175, 255], // Darker blue
  strokeWidth: 2,
};

// Empty feature collection
const EMPTY_COLLECTION: FeatureCollection<Geometry, EditorFeature['properties']> = {
  type: 'FeatureCollection',
  features: [],
};

export const useEditorStore = create<EditorStore>((set, get) => ({
  // Features
  features: EMPTY_COLLECTION,

  addFeature: (feature) => {
    const state = get();
    const now = new Date().toISOString();
    const newFeature: EditorFeature = {
      ...feature,
      properties: {
        ...feature.properties,
        id: generateId(),
        style: { ...state.drawingStyle },
        createdAt: now,
        updatedAt: now,
      },
    } as EditorFeature;

    set({
      features: {
        ...state.features,
        features: [...state.features.features, newFeature],
      },
    });
    state.pushHistory();
  },

  updateFeature: (index, feature) => {
    const state = get();
    const features = [...state.features.features];
    const now = new Date().toISOString();

    features[index] = {
      ...feature,
      properties: {
        ...features[index].properties,
        ...feature.properties,
        updatedAt: now,
      },
    } as EditorFeature;

    set({
      features: {
        ...state.features,
        features,
      },
    });
  },

  deleteFeature: (index) => {
    const state = get();
    const features = state.features.features.filter((_, i) => i !== index);
    set({
      features: {
        ...state.features,
        features,
      },
      selectedIndexes: state.selectedIndexes.filter((i) => i !== index),
    });
    state.pushHistory();
  },

  deleteFeatures: (indexes) => {
    const state = get();
    const features = state.features.features.filter((_, i) => !indexes.includes(i));
    set({
      features: {
        ...state.features,
        features,
      },
      selectedIndexes: [],
    });
    state.pushHistory();
  },

  setFeatures: (features) => {
    set({ features: features as FeatureCollection<Geometry, EditorFeature['properties']> });
    get().pushHistory();
  },

  clearFeatures: () => {
    set({ features: EMPTY_COLLECTION, selectedIndexes: [] });
    get().pushHistory();
  },

  // Selection
  selectedIndexes: [],
  setSelectedIndexes: (indexes) => set({ selectedIndexes: indexes }),
  clearSelection: () => set({ selectedIndexes: [] }),

  // Drawing mode
  mode: 'view',
  setMode: (mode) => {
    const state = get();
    const isDrawingMode = mode.startsWith('draw-');
    const isEditMode = ['modify', 'translate', 'rotate', 'scale', 'transform'].includes(mode);
    const isSameMode = state.mode === mode;

    // Always clear pending drawing context when changing modes (unless same mode)
    const shouldClearDrawing = !isSameMode && (state.drawingCoordinates.length > 0 || state.isDrawing);

    set({
      mode,
      // Clear drawing context when switching modes
      ...(shouldClearDrawing ? {
        drawingCoordinates: [],
        lastClickCoordinate: null,
        activeVertexIndex: null,
      } : {}),
      // Start in "add mode" for drawing modes
      ...(isDrawingMode ? {
        activeVertexIndex: null,
      } : {}),
      // Disable drawing state for edit modes
      ...(isEditMode ? {
        isDrawing: false,
      } : {})
    });
  },

  // Drawing style
  drawingStyle: DEFAULT_STYLE,
  setDrawingStyle: (style) =>
    set((state) => ({
      drawingStyle: { ...state.drawingStyle, ...style },
    })),

  // Snap
  snapEnabled: true,
  setSnapEnabled: (enabled) => set({ snapEnabled: enabled }),
  toggleSnap: () => set((state) => ({ snapEnabled: !state.snapEnabled })),

  // Snap mode
  snapMode: 'both' as SnapMode,
  setSnapMode: (mode) => set({ snapMode: mode }),

  // Snap threshold
  snapPixels: 12,
  setSnapPixels: (pixels) => set({ snapPixels: Math.max(1, Math.min(50, pixels)) }),

  // Snap reference features
  snapReferenceFeatures: [],
  toggleSnapReference: (feature) => set((state) => {
    const current = state.snapReferenceFeatures;
    const featureId = feature.id ?? JSON.stringify(feature.geometry);
    const exists = current.some(f =>
      (f.id ?? JSON.stringify(f.geometry)) === featureId
    );

    if (exists) {
      return {
        snapReferenceFeatures: current.filter(f =>
          (f.id ?? JSON.stringify(f.geometry)) !== featureId
        )
      };
    } else {
      return { snapReferenceFeatures: [...current, feature] };
    }
  }),
  removeSnapReference: (index) => set((state) => ({
    snapReferenceFeatures: state.snapReferenceFeatures.filter((_, i) => i !== index)
  })),
  clearSnapReferences: () => set({ snapReferenceFeatures: [] }),

  // Snap guides
  snapGuidesEnabled: true,
  setSnapGuidesEnabled: (enabled) => set({ snapGuidesEnabled: enabled }),
  toggleSnapGuides: () => set((state) => ({ snapGuidesEnabled: !state.snapGuidesEnabled })),
  snapGuides: [],
  setSnapGuides: (guides) => set({ snapGuides: guides }),
  clearSnapGuides: () => set({ snapGuides: [] }),

  // Tentative feature
  tentativeFeature: null,
  setTentativeFeature: (feature) => set({ tentativeFeature: feature }),

  // Drawing coordinates
  drawingCoordinates: [],
  addDrawingCoordinate: (coord) =>
    set((state) => ({
      drawingCoordinates: [...state.drawingCoordinates, coord],
      lastClickCoordinate: coord,
    })),
  updateDrawingCoordinate: (index, coord) =>
    set((state) => {
      const coords = [...state.drawingCoordinates];
      coords[index] = coord;
      return { drawingCoordinates: coords };
    }),
  removeDrawingCoordinate: (index) =>
    set((state) => ({
      drawingCoordinates: state.drawingCoordinates.filter((_, i) => i !== index),
    })),
  clearDrawingCoordinates: () => set({ drawingCoordinates: [], lastClickCoordinate: null, activeVertexIndex: null }),
  setDrawingCoordinates: (coords) => set({ drawingCoordinates: coords }),

  // Active vertex index for editing
  activeVertexIndex: null,
  setActiveVertexIndex: (index) => set({ activeVertexIndex: index }),

  // Last click coordinate
  lastClickCoordinate: null,
  setLastClickCoordinate: (coord) => set({ lastClickCoordinate: coord }),

  // Drawing active state
  isDrawing: false,
  setIsDrawing: (drawing) => set({ isDrawing: drawing }),

  // Silent mode - don't show panel on subsequent drawings
  silentMode: false,
  setSilentMode: (silent) => set({ silentMode: silent }),

  // Finish current drawing
  finishDrawing: () => {
    const state = get();
    const coords = state.drawingCoordinates;
    const mode = state.mode;

    if (coords.length === 0) return;

    let geometry: Geometry | null = null;

    // Create geometry based on mode and coordinates
    if (mode === 'draw-point' && coords.length >= 1) {
      geometry = { type: 'Point', coordinates: coords[0] };
    } else if (mode === 'draw-line' && coords.length >= 2) {
      geometry = { type: 'LineString', coordinates: coords };
    } else if (
      (mode === 'draw-polygon' || mode === 'draw-lasso') &&
      coords.length >= 3
    ) {
      // Close the polygon by adding the first point at the end
      const closedCoords = [...coords, coords[0]];
      geometry = { type: 'Polygon', coordinates: [closedCoords] };
    } else if (mode === 'draw-90deg-polygon' && coords.length >= 3) {
      // For 90-degree polygon, ensure the closing edge is also at 90 degrees
      const firstPoint = coords[0];
      const lastPoint = coords[coords.length - 1];
      const secondToLastPoint = coords[coords.length - 2];

      // Check if first and last points are already aligned (horizontally or vertically)
      const isAlignedHorizontally = Math.abs(lastPoint[1] - firstPoint[1]) < 1e-9;
      const isAlignedVertically = Math.abs(lastPoint[0] - firstPoint[0]) < 1e-9;

      let finalCoords: [number, number][];

      if (isAlignedHorizontally || isAlignedVertically) {
        // Already aligned, just close normally
        finalCoords = [...coords, coords[0]];
      } else {
        // Need to add an intermediate point
        // Determine the direction of the last edge to decide which corner to use
        const lastEdgeIsHorizontal = Math.abs(lastPoint[1] - secondToLastPoint[1]) < 1e-9;

        let intermediatePoint: [number, number];
        if (lastEdgeIsHorizontal) {
          // Last edge was horizontal, so next edge should be vertical
          // Intermediate point: same X as first point, same Y as last point
          intermediatePoint = [firstPoint[0], lastPoint[1]];
        } else {
          // Last edge was vertical, so next edge should be horizontal
          // Intermediate point: same X as last point, same Y as first point
          intermediatePoint = [lastPoint[0], firstPoint[1]];
        }

        finalCoords = [...coords, intermediatePoint, coords[0]];
      }

      geometry = { type: 'Polygon', coordinates: [finalCoords] };
    } else if (
      (mode === 'draw-rectangle' || mode === 'draw-square') &&
      coords.length >= 2
    ) {
      // Create rectangle from two corners
      const [x1, y1] = coords[0];
      const [x2, y2] = coords[1];
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
    } else if (mode === 'draw-rectangle-3pts' && coords.length >= 3) {
      // Create rectangle from 3 points (allows rotation)
      // p1 = first corner, p2 = second corner on same edge, p3 = defines height
      const [x1, y1] = coords[0]; // p1
      const [x2, y2] = coords[1]; // p2
      const [x3, y3] = coords[2]; // p3

      // Vector from p1 to p2 (base edge)
      const dx = x2 - x1;
      const dy = y2 - y1;

      // Calculate perpendicular projection of p3 onto p1-p2 line
      const len2 = dx * dx + dy * dy;
      if (len2 > 0) {
        // Project p3 onto line p1-p2
        const t = ((x3 - x1) * dx + (y3 - y1) * dy) / len2;
        const projX = x1 + t * dx;
        const projY = y1 + t * dy;

        // Perpendicular vector from projection to p3
        const perpX = x3 - projX;
        const perpY = y3 - projY;

        // Four corners of the rectangle
        const c1: [number, number] = [x1, y1];
        const c2: [number, number] = [x2, y2];
        const c3: [number, number] = [x2 + perpX, y2 + perpY];
        const c4: [number, number] = [x1 + perpX, y1 + perpY];

        geometry = {
          type: 'Polygon',
          coordinates: [[c1, c2, c3, c4, c1]],
        };
      }
    } else if (mode === 'draw-circle' && coords.length >= 2) {
      // Create circle approximation (32 points)
      const [cx, cy] = coords[0];
      const [px, py] = coords[1];
      const radius = Math.sqrt(Math.pow(px - cx, 2) + Math.pow(py - cy, 2));
      const points: [number, number][] = [];
      for (let i = 0; i <= 32; i++) {
        const angle = (i / 32) * 2 * Math.PI;
        points.push([
          cx + radius * Math.cos(angle),
          cy + radius * Math.sin(angle),
        ]);
      }
      geometry = { type: 'Polygon', coordinates: [points] };
    }

    if (geometry) {
      const now = new Date().toISOString();
      const newFeature: Feature = {
        type: 'Feature',
        geometry,
        properties: {
          id: generateId(),
          style: { ...state.drawingStyle },
          createdAt: now,
          updatedAt: now,
        },
      };

      const newFeatures = [...state.features.features, newFeature as any];

      set({
        features: {
          ...state.features,
          features: newFeatures,
        },
        drawingCoordinates: [],
        lastClickCoordinate: null,
        activeVertexIndex: null, // Reset to add mode for next drawing
        // Keep isDrawing true so user can continue creating features
      });

      state.pushHistory();
    }
  },

  // History
  history: [EMPTY_COLLECTION],
  historyIndex: 0,

  pushHistory: () => {
    const state = get();
    const newHistory = state.history.slice(0, state.historyIndex + 1);
    newHistory.push(JSON.parse(JSON.stringify(state.features)));

    // Limit history to 50 items
    if (newHistory.length > 50) {
      newHistory.shift();
    }

    set({
      history: newHistory,
      historyIndex: newHistory.length - 1,
    });
  },

  undo: () => {
    const state = get();
    if (state.historyIndex > 0) {
      const newIndex = state.historyIndex - 1;
      set({
        features: JSON.parse(JSON.stringify(state.history[newIndex])),
        historyIndex: newIndex,
        selectedIndexes: [],
      });
    }
  },

  redo: () => {
    const state = get();
    if (state.historyIndex < state.history.length - 1) {
      const newIndex = state.historyIndex + 1;
      set({
        features: JSON.parse(JSON.stringify(state.history[newIndex])),
        historyIndex: newIndex,
        selectedIndexes: [],
      });
    }
  },

  canUndo: () => get().historyIndex > 0,
  canRedo: () => get().historyIndex < get().history.length - 1,

  // Measurement
  measurementMode: 'none',
  measurementCoordinates: [],
  measurementResults: [],
  showMeasurements: true,

  setMeasurementMode: (mode) => {
    if (mode === 'none') {
      set({ measurementMode: mode, measurementCoordinates: [], mode: 'view' });
    } else {
      set({
        measurementMode: mode,
        measurementCoordinates: [],
        mode: mode === 'distance' ? 'measure-distance' : 'measure-area'
      });
    }
  },

  addMeasurementCoordinate: (coord) =>
    set((state) => ({
      measurementCoordinates: [...state.measurementCoordinates, coord],
    })),

  clearMeasurementCoordinates: () => set({ measurementCoordinates: [] }),

  addMeasurementResult: (result) =>
    set((state) => ({
      measurementResults: [...state.measurementResults, result],
      measurementCoordinates: [], // Clear coordinates after adding result
    })),

  clearMeasurementResults: () => set({ measurementResults: [], measurementCoordinates: [] }),

  setShowMeasurements: (show) => set({ showMeasurements: show }),
}));
