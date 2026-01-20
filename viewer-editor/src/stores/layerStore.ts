import { create } from 'zustand';

export interface LayerItem {
  id: string;
  name: string;
  type: 'group' | 'layer';
  visible: boolean;
  selectable: boolean;
  editable: boolean;
  color?: string;
  featureCount?: number;
  parentId: string | null;
  geomType?: 'Point' | 'LineString' | 'Polygon';
  opacity?: number;
  minZoom?: number;
  maxZoom?: number;
  sourceUrl?: string;
}

interface LayerStore {
  // Layers
  layers: LayerItem[];
  setLayers: (layers: LayerItem[]) => void;
  addLayer: (layer: LayerItem) => void;
  updateLayer: (id: string, updates: Partial<LayerItem>) => void;
  removeLayer: (id: string) => void;

  // Active layer
  activeLayerId: string | null;
  setActiveLayer: (id: string | null) => void;

  // Expanded groups
  expandedGroups: Set<string>;
  toggleGroupExpanded: (id: string) => void;
  setExpandedGroups: (ids: Set<string>) => void;

  // Layer order (for rendering)
  layerOrder: string[];
  setLayerOrder: (order: string[]) => void;
  moveLayer: (id: string, direction: 'up' | 'down') => void;
}

// Initial mock data
const INITIAL_LAYERS: LayerItem[] = [
  { id: 'cadastro', name: 'Cadastro', type: 'group', visible: true, selectable: true, editable: true, parentId: null },
  { id: 'lotes', name: 'Lotes', type: 'layer', visible: true, selectable: true, editable: true, color: '#3B82F6', featureCount: 1234, parentId: 'cadastro', geomType: 'Polygon', opacity: 0.8 },
  { id: 'edificacoes', name: 'Edificações', type: 'layer', visible: true, selectable: true, editable: false, color: '#10B981', featureCount: 892, parentId: 'cadastro', geomType: 'Polygon', opacity: 0.8 },
  { id: 'logradouros', name: 'Logradouros', type: 'layer', visible: false, selectable: true, editable: false, color: '#F59E0B', featureCount: 156, parentId: 'cadastro', geomType: 'LineString', opacity: 1 },
  { id: 'infra', name: 'Infraestrutura', type: 'group', visible: true, selectable: true, editable: true, parentId: null },
  { id: 'postes', name: 'Postes', type: 'layer', visible: true, selectable: true, editable: false, color: '#8B5CF6', featureCount: 456, parentId: 'infra', geomType: 'Point', opacity: 1 },
  { id: 'redes', name: 'Redes Elétricas', type: 'layer', visible: true, selectable: false, editable: false, color: '#EC4899', featureCount: 234, parentId: 'infra', geomType: 'LineString', opacity: 1 },
  { id: 'hidro', name: 'Hidrografia', type: 'group', visible: true, selectable: true, editable: true, parentId: null },
  { id: 'rios', name: 'Rios', type: 'layer', visible: true, selectable: true, editable: false, color: '#06B6D4', featureCount: 23, parentId: 'hidro', geomType: 'LineString', opacity: 0.8 },
  { id: 'nascentes', name: 'Nascentes', type: 'layer', visible: true, selectable: true, editable: false, color: '#0EA5E9', featureCount: 45, parentId: 'hidro', geomType: 'Point', opacity: 1 },
];

export const useLayerStore = create<LayerStore>((set) => ({
  // Layers
  layers: INITIAL_LAYERS,
  setLayers: (layers) => set({ layers }),
  addLayer: (layer) => set((state) => ({ layers: [...state.layers, layer] })),
  updateLayer: (id, updates) =>
    set((state) => ({
      layers: state.layers.map((l) => (l.id === id ? { ...l, ...updates } : l)),
    })),
  removeLayer: (id) =>
    set((state) => ({
      layers: state.layers.filter((l) => l.id !== id && l.parentId !== id),
    })),

  // Active layer
  activeLayerId: null,
  setActiveLayer: (id) => set({ activeLayerId: id }),

  // Expanded groups
  expandedGroups: new Set(['cadastro', 'infra', 'hidro']),
  toggleGroupExpanded: (id) =>
    set((state) => {
      const next = new Set(state.expandedGroups);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return { expandedGroups: next };
    }),
  setExpandedGroups: (ids) => set({ expandedGroups: ids }),

  // Layer order
  layerOrder: INITIAL_LAYERS.filter((l) => l.type === 'layer').map((l) => l.id),
  setLayerOrder: (order) => set({ layerOrder: order }),
  moveLayer: (id, direction) =>
    set((state) => {
      const order = [...state.layerOrder];
      const index = order.indexOf(id);
      if (index === -1) return state;

      const newIndex = direction === 'up' ? index - 1 : index + 1;
      if (newIndex < 0 || newIndex >= order.length) return state;

      [order[index], order[newIndex]] = [order[newIndex], order[index]];
      return { layerOrder: order };
    }),
}));
