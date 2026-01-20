import type { Feature, FeatureCollection, Geometry } from 'geojson';

export interface User {
  id: string;
  email: string;
  name?: string;
}

export interface Organization {
  id: string;
  name: string;
  schema: string;
}

export interface Attribute {
  id: number;
  columnName: string;
  attributeType: string;
  mainGeometry: boolean;
}

export interface Layer {
  id: number;
  name: string;
  tableName: string;
  recordsCount: number;
  schema: string;
  geomColumn: string;
  attributes: Attribute[];
  connection?: {
    relatedSchema: string;
    name: string;
  };
}

export interface DebugInfo {
  authStatus: 'ok' | 'error' | 'refreshing' | 'expired';
  lastTileUrl?: string;
  userEmail?: string;
}

export type ViewType = 'login' | 'org-select' | 'map';

export type EditModeType =
  // Navigation
  | 'view'
  | 'select-snap-ref'
  // Selection tools
  | 'select-rectangle'
  | 'select-lasso'
  // Basic drawing
  | 'draw-point'
  | 'draw-line'
  | 'draw-polygon'
  | 'draw-lasso'
  | 'extend-line'
  // Shapes
  | 'draw-rectangle'
  | 'draw-rectangle-center'
  | 'draw-rectangle-3pts'
  | 'draw-square'
  | 'draw-square-center'
  | 'draw-circle'
  | 'draw-circle-diameter'
  | 'resize-circle'
  | 'draw-ellipse'
  | 'draw-ellipse-3pts'
  | 'draw-90deg-polygon'
  // Edit/Transform
  | 'modify'
  | 'translate'
  | 'rotate'
  | 'scale'
  | 'extrude'
  | 'elevation'
  | 'transform'
  | 'split-polygon'
  | 'duplicate'
  | 'delete'
  // Composite modes
  | 'composite-draw-modify'
  // Measurement
  | 'measure-distance'
  | 'measure-area'
  | 'measure-angle';

// Boolean operations for polygon modes
export type BooleanOperation = 'union' | 'difference' | 'intersection' | null;

// Mode configuration options
export interface ModeConfig {
  // DrawPolygonMode options
  allowHoles?: boolean;
  allowSelfIntersection?: boolean;
  // Boolean operations
  booleanOperation?: BooleanOperation;
  // Snapping
  enableSnapping?: boolean;
  snapPixels?: number;
  // Measurement
  formatTooltip?: (value: number) => string;
  measurementUnit?: 'meters' | 'kilometers' | 'miles' | 'feet';
}

// Snap mode options
export type SnapMode = 'vertex' | 'edge' | 'both';

// Snap guide line (extends across map)
export interface SnapGuide {
  id: string;
  // Two points defining the line direction (will be extended infinitely)
  origin: [number, number];
  direction: [number, number];  // Unit vector
  // Type of guide
  type: 'horizontal' | 'vertical' | 'parallel' | 'orthogonal';
  // Visual line segment for rendering (computed from viewport)
  line?: [[number, number], [number, number]];
}

export interface AppState {
  // Auth
  user: User | null;
  organizations: Organization[];
  currentOrg: Organization | null;
  isAuthenticated: boolean;

  // Layers
  layers: Layer[];
  visibleLayers: Set<number>;
  selectableLayers: Set<number>;
  editableLayers: Set<number>;
  layersLoading: boolean;

  // Editor
  features: FeatureCollection;
  selectedFeatureIndexes: number[];
  editMode: EditModeType;
  modeConfig: ModeConfig;  // Configurações específicas do modo
  snapEnabled: boolean;
  snapMode: SnapMode;  // Modo de snap: vertex, edge, ou both
  snapPixels: number;  // Distância em pixels para snap
  snapReferenceFeatures: Feature[];  // Features selecionadas como referência para snap
  snapGuidesEnabled: boolean;  // Habilita guias ortogonais durante desenho
  snapGuides: SnapGuide[];  // Guias ativas

  // UI
  view: ViewType;
  debugInfo: DebugInfo;
  loading: boolean;
  error: string | null;

  // Actions
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  selectOrg: (orgId: string) => Promise<void>;
  loadLayers: () => Promise<void>;
  loadOrganizations: () => Promise<void>;
  toggleLayerVisibility: (layerId: number) => void;
  toggleLayerSelectable: (layerId: number) => void;
  toggleLayerEditable: (layerId: number) => void;
  zoomToLayer: (layerId: number) => void;
  setEditMode: (mode: EditModeType) => void;
  setModeConfig: (config: Partial<ModeConfig>) => void;
  updateFeatures: (fc: FeatureCollection) => void;
  selectFeature: (indexes: number[]) => void;
  addFeatures: (features: Feature[]) => void;
  deleteSelectedFeatures: () => void;
  copyFeatures: () => void;
  pasteFeatures: () => void;
  downloadGeoJSON: () => void;
  loadGeoJSON: (geojson: FeatureCollection) => void;
  setError: (error: string | null) => void;
  refreshToken: () => Promise<boolean>;
  startTokenRefresh: () => void;
  toggleSnap: () => void;
  setSnapMode: (mode: SnapMode) => void;
  setSnapPixels: (pixels: number) => void;
  toggleSnapReference: (feature: Feature) => void;
  removeSnapReference: (index: number) => void;
  clearSnapReferences: () => void;
  toggleSnapGuides: () => void;
  setSnapGuides: (guides: SnapGuide[]) => void;
  clearSnapGuides: () => void;

  // History (non-sequential undo/redo)
  history: HistoryEntry[];
  historyMaxEntries: number;
  addHistoryEntry: (entry: Omit<HistoryEntry, 'id' | 'timestamp' | 'isReverted'>) => void;
  revertHistoryEntry: (entryId: string) => { success: boolean; message: string };
  reapplyHistoryEntry: (entryId: string) => { success: boolean; message: string };
  clearHistory: () => void;
  canRevertEntry: (entryId: string) => { canRevert: boolean; conflicts: string[] };
}

export type GeoJSONFeature = Feature<Geometry>;
export type GeoJSONFeatureCollection = FeatureCollection<Geometry>;

// History system types for non-sequential undo/redo

export type HistoryOperationType =
  | 'add'           // Feature added
  | 'delete'        // Feature deleted
  | 'modify'        // Geometry modified (vertices)
  | 'translate'     // Feature moved
  | 'rotate'        // Feature rotated
  | 'scale'         // Feature scaled
  | 'transform'     // Combined transform
  | 'properties'    // Properties changed
  | 'batch';        // Multiple operations grouped

export interface HistoryEntry {
  id: string;
  timestamp: number;
  operationType: HistoryOperationType;
  description: string;
  // The feature(s) affected - store full state for independent revert
  featureId: string | number | null;  // null for batch operations
  featureIndex: number;               // Index in features array at time of operation
  // States for reverting
  beforeState: Feature | null;        // null if feature was added
  afterState: Feature | null;         // null if feature was deleted
  // For batch operations
  batchEntries?: HistoryEntry[];
  // Status
  isReverted: boolean;
  // Conflict info (filled when there are dependent operations)
  hasConflicts?: boolean;
  conflictReason?: string;
}

export interface HistoryState {
  entries: HistoryEntry[];
  maxEntries: number;  // Limit history size
}

// History actions interface
export interface HistoryActions {
  // Add a new entry to history
  addHistoryEntry: (entry: Omit<HistoryEntry, 'id' | 'timestamp' | 'isReverted'>) => void;
  // Revert a specific entry (not necessarily the last one)
  revertHistoryEntry: (entryId: string) => { success: boolean; message: string };
  // Re-apply a reverted entry
  reapplyHistoryEntry: (entryId: string) => { success: boolean; message: string };
  // Clear all history
  clearHistory: () => void;
  // Remove old entries beyond maxEntries
  pruneHistory: () => void;
  // Check if an entry can be safely reverted
  canRevertEntry: (entryId: string) => { canRevert: boolean; conflicts: string[] };
  // Get history entries (newest first)
  getHistoryEntries: () => HistoryEntry[];
}
