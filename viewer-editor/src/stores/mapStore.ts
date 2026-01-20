import { create } from 'zustand';

interface ViewState {
  longitude: number;
  latitude: number;
  zoom: number;
  pitch: number;
  bearing: number;
}

interface MapStore {
  // View state
  viewState: ViewState;
  setViewState: (viewState: Partial<ViewState>) => void;

  // Basemap
  basemapStyle: string;
  setBasemapStyle: (style: string) => void;

  // Interaction mode
  interactionMode: 'navigate' | 'draw' | 'edit' | 'measure';
  setInteractionMode: (mode: 'navigate' | 'draw' | 'edit' | 'measure') => void;

  // Selected features
  selectedFeatureIds: string[];
  selectFeatures: (ids: string[]) => void;
  addToSelection: (ids: string[]) => void;
  removeFromSelection: (ids: string[]) => void;
  clearSelection: () => void;

  // Hover
  hoveredFeatureId: string | null;
  setHoveredFeature: (id: string | null) => void;
}

const BASEMAP_STYLES = {
  dark: 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json',
  light: 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json',
  voyager: 'https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json',
};

export const useMapStore = create<MapStore>((set) => ({
  // Initial view state (Goiânia, Brazil)
  viewState: {
    longitude: -49.2800,
    latitude: -16.6800,
    zoom: 15,
    pitch: 0,
    bearing: 0,
  },
  setViewState: (viewState) =>
    set((state) => ({ viewState: { ...state.viewState, ...viewState } })),

  // Basemap
  basemapStyle: BASEMAP_STYLES.dark,
  setBasemapStyle: (style) => set({ basemapStyle: style }),

  // Interaction mode
  interactionMode: 'navigate',
  setInteractionMode: (mode) => set({ interactionMode: mode }),

  // Selected features
  selectedFeatureIds: [],
  selectFeatures: (ids) => set({ selectedFeatureIds: ids }),
  addToSelection: (ids) =>
    set((state) => ({
      selectedFeatureIds: [...new Set([...state.selectedFeatureIds, ...ids])],
    })),
  removeFromSelection: (ids) =>
    set((state) => ({
      selectedFeatureIds: state.selectedFeatureIds.filter((id) => !ids.includes(id)),
    })),
  clearSelection: () => set({ selectedFeatureIds: [] }),

  // Hover
  hoveredFeatureId: null,
  setHoveredFeature: (id) => set({ hoveredFeatureId: id }),
}));

export { BASEMAP_STYLES };
