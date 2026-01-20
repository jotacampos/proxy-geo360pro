import { create } from 'zustand';
import type { FeatureCollection, Feature } from 'geojson';
import type { AppState, User, Organization, Layer, EditModeType, ViewType, DebugInfo, SnapMode, ModeConfig, SnapGuide, HistoryEntry } from '../types';
import { api } from '../services/api';

// Clipboard for copy/paste
let clipboard: Feature[] = [];

// Counter for generating unique feature IDs
let featureIdCounter = 1;

// Helper: Generate unique ID for history entries
function generateHistoryId(): string {
  return `hist-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

// Helper: Generate unique ID for features
function generateFeatureId(): string {
  return `feat-${Date.now()}-${featureIdCounter++}`;
}

// Helper: Ensure feature has a stable ID
function ensureFeatureId(feature: Feature): Feature {
  if (feature.id !== undefined && feature.id !== null) {
    return feature;
  }
  return {
    ...feature,
    id: generateFeatureId(),
  };
}

// Helper: Find feature by ID
function findFeatureById(features: Feature[], id: string | number | null | undefined): number {
  if (id === null || id === undefined) return -1;
  return features.findIndex(f => f.id === id);
}

// Helper: Deep clone a feature
function cloneFeature(feature: Feature): Feature {
  return JSON.parse(JSON.stringify(feature));
}

// Known organizations for testing
const KNOWN_ORGS = [
  '055e5a53-1016-44df-9318-074f180f039d',
  '448735db-786b-4558-8722-bc340d49b33b',
  '7b6173d2-f604-4920-ba10-657c5308c9ff',
];

// Token refresh interval (90 seconds)
const TOKEN_REFRESH_INTERVAL = 90 * 1000;

let refreshIntervalId: ReturnType<typeof setInterval> | null = null;

const initialFeatures: FeatureCollection = {
  type: 'FeatureCollection',
  features: [],
};

export const useStore = create<AppState>((set, get) => ({
  // Auth state
  user: null,
  organizations: [],
  currentOrg: null,
  isAuthenticated: false,

  // Layers state
  layers: [],
  visibleLayers: new Set<number>(),
  selectableLayers: new Set<number>(),
  editableLayers: new Set<number>(),
  layersLoading: false,

  // Editor state
  features: initialFeatures,
  selectedFeatureIndexes: [],
  editMode: 'view' as EditModeType,
  modeConfig: {
    allowHoles: true,
    allowSelfIntersection: false,
    booleanOperation: null,
    enableSnapping: true,
  } as ModeConfig,
  snapEnabled: false,
  snapMode: 'both' as SnapMode,  // Default: snap to both vertices and edges
  snapPixels: 12,  // Default snap distance in pixels
  snapReferenceFeatures: [],  // Features selecionadas como referência para snap
  snapGuidesEnabled: true,  // Guias ortogonais habilitadas por padrão
  snapGuides: [] as SnapGuide[],  // Guias ativas

  // History state (non-sequential undo/redo)
  history: [] as HistoryEntry[],
  historyMaxEntries: 100,  // Maximum history entries to keep

  // UI state
  view: 'login' as ViewType,
  debugInfo: { authStatus: 'ok' } as DebugInfo,
  loading: false,
  error: null,

  // Actions
  login: async (email: string, password: string) => {
    set({ loading: true, error: null });

    try {
      const response = await api.login(email, password);
      const user: User = {
        id: response.content.user.id,
        email: response.content.user.email,
        name: response.content.user.name,
      };

      set({ user, isAuthenticated: true });

      // Start token refresh
      get().startTokenRefresh();

      // Load organizations
      await get().loadOrganizations();

      set({ view: 'org-select', loading: false });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Erro ao fazer login',
        loading: false,
      });
      throw error;
    }
  },

  logout: () => {
    // Stop token refresh
    if (refreshIntervalId) {
      clearInterval(refreshIntervalId);
      refreshIntervalId = null;
    }

    api.logout();
    api.setOrganization(null);

    set({
      user: null,
      organizations: [],
      currentOrg: null,
      isAuthenticated: false,
      layers: [],
      visibleLayers: new Set(),
      selectableLayers: new Set(),
      editableLayers: new Set(),
      features: initialFeatures,
      selectedFeatureIndexes: [],
      editMode: 'view',
      view: 'login',
      debugInfo: { authStatus: 'ok' },
    });
  },

  startTokenRefresh: () => {
    if (refreshIntervalId) {
      clearInterval(refreshIntervalId);
    }

    refreshIntervalId = setInterval(async () => {
      const success = await get().refreshToken();
      if (!success) {
        set({ debugInfo: { ...get().debugInfo, authStatus: 'expired' } });
      }
    }, TOKEN_REFRESH_INTERVAL);
  },

  refreshToken: async (): Promise<boolean> => {
    set({ debugInfo: { ...get().debugInfo, authStatus: 'refreshing' } });

    const success = await api.refreshToken();

    if (success) {
      set({ debugInfo: { ...get().debugInfo, authStatus: 'ok' } });
      return true;
    } else {
      // Session expired
      set({ debugInfo: { ...get().debugInfo, authStatus: 'expired' } });

      // Auto-logout on 401
      if (refreshIntervalId) {
        clearInterval(refreshIntervalId);
        refreshIntervalId = null;
      }

      return false;
    }
  },

  loadOrganizations: async () => {
    const organizations: Organization[] = [];

    for (const orgId of KNOWN_ORGS) {
      const response = await api.checkOrganizationAccess(orgId);

      if (response && response.content.data && response.content.data.length > 0) {
        const conn = response.content.data[0];
        organizations.push({
          id: orgId,
          name: conn.name || `Org ${orgId.substring(0, 8)}`,
          schema: conn.relatedSchema,
        });
      }
    }

    set({ organizations });
  },

  selectOrg: async (orgId: string) => {
    const org = get().organizations.find(o => o.id === orgId);
    if (!org) return;

    set({ loading: true, currentOrg: org });
    api.setOrganization(orgId);

    try {
      // Debug auth
      const debugData = await api.debugAuth();
      set({
        debugInfo: {
          authStatus: debugData.has_token ? 'ok' : 'error',
          userEmail: debugData.user_email,
        },
      });

      // Load layers
      await get().loadLayers();

      set({ view: 'map', loading: false });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Erro ao carregar dados',
        loading: false,
      });
    }
  },

  loadLayers: async () => {
    set({ layersLoading: true });

    try {
      const response = await api.getLayers();
      const layersData = response.content.data;

      const layers: Layer[] = [];

      for (const layerData of layersData) {
        try {
          const attrsResponse = await api.getLayerAttributes(layerData.id);
          const attributes = attrsResponse.content.data || [];

          // Find geometry column
          const geomAttr = attributes.find(a => a.mainGeometry === true);
          const geomColumn = geomAttr?.columnName || 'geom';

          // Schema from connection
          const schema = layerData.connection?.relatedSchema || 'public';

          layers.push({
            id: layerData.id,
            name: layerData.name,
            tableName: layerData.tableName,
            recordsCount: layerData.recordsCount,
            schema,
            geomColumn,
            attributes,
            connection: layerData.connection,
          });
        } catch (e) {
          console.error(`Error loading attributes for layer ${layerData.id}:`, e);
          // Add layer without attributes
          layers.push({
            id: layerData.id,
            name: layerData.name,
            tableName: layerData.tableName,
            recordsCount: layerData.recordsCount,
            schema: layerData.connection?.relatedSchema || 'public',
            geomColumn: 'geom',
            attributes: [],
            connection: layerData.connection,
          });
        }
      }

      set({ layers, layersLoading: false });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Erro ao carregar camadas',
        layersLoading: false,
      });
    }
  },

  toggleLayerVisibility: (layerId: number) => {
    const visibleLayers = new Set(get().visibleLayers);

    if (visibleLayers.has(layerId)) {
      visibleLayers.delete(layerId);
    } else {
      visibleLayers.add(layerId);
    }

    set({ visibleLayers });
  },

  toggleLayerSelectable: (layerId: number) => {
    const selectableLayers = new Set(get().selectableLayers);

    if (selectableLayers.has(layerId)) {
      selectableLayers.delete(layerId);
    } else {
      selectableLayers.add(layerId);
    }

    set({ selectableLayers });
  },

  toggleLayerEditable: (layerId: number) => {
    const editableLayers = new Set(get().editableLayers);

    if (editableLayers.has(layerId)) {
      editableLayers.delete(layerId);
    } else {
      editableLayers.add(layerId);
    }

    set({ editableLayers });
  },

  zoomToLayer: (layerId: number) => {
    // This will be implemented when we have map view state management
    // For now, just log the action
    console.log('Zoom to layer:', layerId);
  },

  setEditMode: (mode: EditModeType) => {
    set({ editMode: mode });

    // Clear selection when changing to view mode
    if (mode === 'view') {
      set({ selectedFeatureIndexes: [] });
    }
  },

  updateFeatures: (fc: FeatureCollection) => {
    // Ensure all features have stable IDs
    const featuresWithIds = {
      ...fc,
      features: fc.features.map(f => ensureFeatureId(f)),
    };
    set({ features: featuresWithIds });
  },

  selectFeature: (indexes: number[]) => {
    set({ selectedFeatureIndexes: indexes });
  },

  setModeConfig: (config: Partial<ModeConfig>) => {
    set({ modeConfig: { ...get().modeConfig, ...config } });
  },

  addFeatures: (newFeatures: Feature[]) => {
    const current = get().features;
    set({
      features: {
        ...current,
        features: [...current.features, ...newFeatures],
      },
    });
  },

  deleteSelectedFeatures: () => {
    const { features, selectedFeatureIndexes } = get();
    if (selectedFeatureIndexes.length === 0) return;

    const newFeatures = features.features.filter(
      (_, index) => !selectedFeatureIndexes.includes(index)
    );

    set({
      features: { ...features, features: newFeatures },
      selectedFeatureIndexes: [],
    });
  },

  copyFeatures: () => {
    const { features, selectedFeatureIndexes } = get();
    if (selectedFeatureIndexes.length === 0) return;

    clipboard = selectedFeatureIndexes.map(index =>
      JSON.parse(JSON.stringify(features.features[index]))
    );
  },

  pasteFeatures: () => {
    if (clipboard.length === 0) {
      return;
    }

    const { features } = get();
    // Offset pasted features slightly
    const offset = 0.0001;
    const pastedFeatures = clipboard.map(feature => {
      const cloned = JSON.parse(JSON.stringify(feature));
      // Offset coordinates
      if (cloned.geometry) {
        const offsetCoords = (coords: any): any => {
          if (Array.isArray(coords[0])) {
            return coords.map(offsetCoords);
          }
          return [coords[0] + offset, coords[1] + offset];
        };
        cloned.geometry.coordinates = offsetCoords(cloned.geometry.coordinates);
      }
      return cloned;
    });

    const newFeatures = [...features.features, ...pastedFeatures];
    const newIndexes = pastedFeatures.map((_, i) => features.features.length + i);

    set({
      features: { ...features, features: newFeatures },
      selectedFeatureIndexes: newIndexes,
    });
  },

  downloadGeoJSON: () => {
    const { features } = get();
    if (features.features.length === 0) {
      return;
    }

    const json = JSON.stringify(features, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = `geometrias_${new Date().toISOString().slice(0, 10)}.geojson`;
    a.click();

    URL.revokeObjectURL(url);
  },

  loadGeoJSON: (geojson: FeatureCollection) => {
    if (!geojson || geojson.type !== 'FeatureCollection') {
      console.error('Invalid GeoJSON');
      return;
    }

    set({
      features: geojson,
      selectedFeatureIndexes: [],
    });
  },

  setError: (error: string | null) => {
    set({ error });
  },

  toggleSnap: () => {
    set({ snapEnabled: !get().snapEnabled });
  },

  setSnapMode: (mode: SnapMode) => {
    set({ snapMode: mode });
  },

  setSnapPixels: (pixels: number) => {
    set({ snapPixels: Math.max(1, Math.min(50, pixels)) });  // Clamp 1-50
  },

  toggleSnapReference: (feature: Feature) => {
    const current = get().snapReferenceFeatures;
    // Use feature id or generate one from coordinates
    const featureId = feature.id || JSON.stringify(feature.geometry);
    const exists = current.some(f =>
      (f.id || JSON.stringify(f.geometry)) === featureId
    );

    if (exists) {
      // Remove
      const newRefs = current.filter(f =>
        (f.id || JSON.stringify(f.geometry)) !== featureId
      );
      set({ snapReferenceFeatures: newRefs });
    } else {
      // Add
      const newRefs = [...current, feature];
      set({ snapReferenceFeatures: newRefs });
    }
  },

  removeSnapReference: (index: number) => {
    const current = get().snapReferenceFeatures;
    const newRefs = current.filter((_, i) => i !== index);
    set({ snapReferenceFeatures: newRefs });
  },

  clearSnapReferences: () => {
    set({ snapReferenceFeatures: [] });
  },

  toggleSnapGuides: () => {
    set({ snapGuidesEnabled: !get().snapGuidesEnabled });
  },

  setSnapGuides: (guides: SnapGuide[]) => {
    set({ snapGuides: guides });
  },

  clearSnapGuides: () => {
    set({ snapGuides: [] });
  },

  // History actions (non-sequential undo/redo)
  addHistoryEntry: (entry) => {
    const { history, historyMaxEntries } = get();
    const newEntry: HistoryEntry = {
      ...entry,
      id: generateHistoryId(),
      timestamp: Date.now(),
      isReverted: false,
    };

    // Add to history (newest first)
    let newHistory = [newEntry, ...history];

    // Prune if exceeds max entries
    if (newHistory.length > historyMaxEntries) {
      newHistory = newHistory.slice(0, historyMaxEntries);
    }

    set({ history: newHistory });
  },

  canRevertEntry: (entryId: string) => {
    const { history, features } = get();
    const entry = history.find(h => h.id === entryId);

    if (!entry) {
      return { canRevert: false, conflicts: ['Entrada não encontrada'] };
    }

    if (entry.isReverted) {
      return { canRevert: false, conflicts: ['Entrada já foi revertida'] };
    }

    const conflicts: string[] = [];
    const featureId = entry.featureId;

    // For 'add' operations: check if feature still exists (by ID)
    if (entry.operationType === 'add') {
      const currentIndex = findFeatureById(features.features, featureId);
      if (currentIndex === -1) {
        conflicts.push('Feature não existe mais (pode ter sido deletada)');
      }
    }

    // For 'delete' operations: check if feature was re-added (by ID)
    if (entry.operationType === 'delete') {
      const currentIndex = findFeatureById(features.features, featureId);
      if (currentIndex !== -1) {
        conflicts.push('Feature já foi re-adicionada');
      }
    }

    // For 'modify' operations: check if feature still exists (by ID)
    if (['modify', 'translate', 'rotate', 'scale', 'transform'].includes(entry.operationType)) {
      const currentIndex = findFeatureById(features.features, featureId);
      if (currentIndex === -1) {
        conflicts.push('Feature foi removida após esta operação');
      }
    }

    // Check for subsequent non-reverted operations on the same feature
    const entryIndex = history.findIndex(h => h.id === entryId);
    const subsequentOps = history.slice(0, entryIndex).filter(h =>
      !h.isReverted &&
      h.featureId === featureId &&
      featureId !== null
    );

    if (subsequentOps.length > 0) {
      conflicts.push(`${subsequentOps.length} operação(ões) posterior(es) na mesma feature`);
    }

    return {
      canRevert: true, // Allow revert even with conflicts (warnings)
      conflicts,
    };
  },

  revertHistoryEntry: (entryId: string) => {
    const { history, features, canRevertEntry } = get();
    const entry = history.find(h => h.id === entryId);

    if (!entry) {
      return { success: false, message: 'Entrada não encontrada' };
    }

    if (entry.isReverted) {
      return { success: false, message: 'Entrada já foi revertida' };
    }

    // Check for conflicts (but allow revert with warning)
    const { conflicts } = canRevertEntry(entryId);

    let newFeatures = [...features.features];
    let message = '';
    const featureId = entry.featureId;

    try {
      switch (entry.operationType) {
        case 'add': {
          // Revert add = remove the feature by ID
          const index = findFeatureById(newFeatures, featureId);
          if (index !== -1) {
            newFeatures.splice(index, 1);
            message = 'Feature removida (add revertido)';
          } else {
            return { success: false, message: 'Feature não encontrada para remover' };
          }
          break;
        }

        case 'delete': {
          // Revert delete = re-add the feature
          if (entry.beforeState) {
            // Add at end (original position may have shifted)
            newFeatures.push(cloneFeature(entry.beforeState));
            message = 'Feature restaurada (delete revertido)';
          }
          break;
        }

        case 'modify':
        case 'translate':
        case 'rotate':
        case 'scale':
        case 'transform': {
          // Revert modification = restore beforeState at same ID
          if (entry.beforeState) {
            const index = findFeatureById(newFeatures, featureId);
            if (index !== -1) {
              // Preserve the ID when restoring
              const restored = cloneFeature(entry.beforeState);
              if (featureId !== null) {
                restored.id = featureId;
              }
              newFeatures[index] = restored;
              message = 'Geometria restaurada';
            } else {
              return { success: false, message: 'Feature não encontrada para restaurar' };
            }
          }
          break;
        }

        case 'properties': {
          // Revert property change
          if (entry.beforeState) {
            const index = findFeatureById(newFeatures, featureId);
            if (index !== -1) {
              const restored = cloneFeature(entry.beforeState);
              if (featureId !== null) {
                restored.id = featureId;
              }
              newFeatures[index] = restored;
              message = 'Propriedades restauradas';
            } else {
              return { success: false, message: 'Feature não encontrada' };
            }
          }
          break;
        }

        default:
          return { success: false, message: `Tipo de operação não suportado: ${entry.operationType}` };
      }

      // Update features
      set({
        features: { ...features, features: newFeatures },
        selectedFeatureIndexes: [],
      });

      // Mark entry as reverted
      const newHistory = history.map(h =>
        h.id === entryId ? { ...h, isReverted: true } : h
      );
      set({ history: newHistory });

      // Add conflict info to message if any
      if (conflicts.length > 0) {
        message += ` (Avisos: ${conflicts.join(', ')})`;
      }

      return { success: true, message };

    } catch (error) {
      console.error('[History] Error reverting:', error);
      return { success: false, message: `Erro ao reverter: ${error}` };
    }
  },

  reapplyHistoryEntry: (entryId: string) => {
    const { history, features } = get();
    const entry = history.find(h => h.id === entryId);

    if (!entry) {
      return { success: false, message: 'Entrada não encontrada' };
    }

    if (!entry.isReverted) {
      return { success: false, message: 'Entrada não foi revertida' };
    }

    let newFeatures = [...features.features];
    let message = '';
    const featureId = entry.featureId;

    try {
      switch (entry.operationType) {
        case 'add': {
          // Re-apply add = add the feature again (with same ID)
          if (entry.afterState) {
            const restored = cloneFeature(entry.afterState);
            if (featureId !== null) {
              restored.id = featureId;
            }
            newFeatures.push(restored);
            message = 'Feature re-adicionada';
          }
          break;
        }

        case 'delete': {
          // Re-apply delete = remove the feature again by ID
          const index = findFeatureById(newFeatures, featureId);
          if (index !== -1) {
            newFeatures.splice(index, 1);
            message = 'Feature removida novamente';
          } else {
            return { success: false, message: 'Feature não encontrada para remover' };
          }
          break;
        }

        case 'modify':
        case 'translate':
        case 'rotate':
        case 'scale':
        case 'transform': {
          // Re-apply modification = apply afterState
          if (entry.afterState) {
            const index = findFeatureById(newFeatures, featureId);
            if (index !== -1) {
              const restored = cloneFeature(entry.afterState);
              if (featureId !== null) {
                restored.id = featureId;
              }
              newFeatures[index] = restored;
              message = 'Modificação re-aplicada';
            } else {
              return { success: false, message: 'Feature não encontrada' };
            }
          }
          break;
        }

        default:
          return { success: false, message: `Tipo de operação não suportado: ${entry.operationType}` };
      }

      // Update features
      set({
        features: { ...features, features: newFeatures },
        selectedFeatureIndexes: [],
      });

      // Mark entry as not reverted
      const newHistory = history.map(h =>
        h.id === entryId ? { ...h, isReverted: false } : h
      );
      set({ history: newHistory });

      return { success: true, message };

    } catch (error) {
      console.error('[History] Error re-applying:', error);
      return { success: false, message: `Erro ao re-aplicar: ${error}` };
    }
  },

  clearHistory: () => {
    set({ history: [] });
  },
}));

// Export a selector for startTokenRefresh (not part of the public state)
export const startTokenRefresh = () => {
  useStore.getState().startTokenRefresh();
};
