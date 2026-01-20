import { create } from 'zustand';
import type { RibbonTab } from '../components/layout/CompactRibbon';

interface UiStore {
  // Panels
  leftPanelCollapsed: boolean;
  rightPanelCollapsed: boolean;
  leftPanelWidth: number;
  rightPanelWidth: number;
  toggleLeftPanel: () => void;
  toggleRightPanel: () => void;
  setLeftPanelWidth: (width: number) => void;
  setRightPanelWidth: (width: number) => void;

  // Attribute table
  attributeTableOpen: boolean;
  attributeTableHeight: number;
  setAttributeTableOpen: (open: boolean) => void;
  setAttributeTableHeight: (height: number) => void;

  // Ribbon and tools
  activeRibbonTab: RibbonTab;
  activeTool: string | null;
  setActiveRibbonTab: (tab: RibbonTab) => void;
  setActiveTool: (tool: string | null) => void;

  // Task pane tabs
  activeTaskPaneTab: 'layers' | 'attributes' | 'analysis';
  setActiveTaskPaneTab: (tab: 'layers' | 'attributes' | 'analysis') => void;

  // Floating panels
  drawingPanelOpen: boolean;
  bufferPanelOpen: boolean;
  measurePanelOpen: boolean;
  setDrawingPanelOpen: (open: boolean) => void;
  setBufferPanelOpen: (open: boolean) => void;
  setMeasurePanelOpen: (open: boolean) => void;
  closeAllPanels: () => void;

  // Notifications
  notifications: Notification[];
  addNotification: (notification: Omit<Notification, 'id'>) => void;
  removeNotification: (id: string) => void;
}

interface Notification {
  id: string;
  type: 'info' | 'success' | 'warning' | 'error';
  title: string;
  message?: string;
  duration?: number;
}

export const useUiStore = create<UiStore>((set) => ({
  // Panels
  leftPanelCollapsed: false,
  rightPanelCollapsed: false,
  leftPanelWidth: 20,
  rightPanelWidth: 20,
  toggleLeftPanel: () => set((state) => ({ leftPanelCollapsed: !state.leftPanelCollapsed })),
  toggleRightPanel: () => set((state) => ({ rightPanelCollapsed: !state.rightPanelCollapsed })),
  setLeftPanelWidth: (width) => set({ leftPanelWidth: width }),
  setRightPanelWidth: (width) => set({ rightPanelWidth: width }),

  // Attribute table
  attributeTableOpen: false,
  attributeTableHeight: 200,
  setAttributeTableOpen: (open) => set({ attributeTableOpen: open }),
  setAttributeTableHeight: (height) => set({ attributeTableHeight: height }),

  // Ribbon and tools
  activeRibbonTab: 'selecao',
  activeTool: 'select-rectangle',
  setActiveRibbonTab: (tab) => set({ activeRibbonTab: tab }),
  setActiveTool: (tool) => set({ activeTool: tool }),

  // Task pane tabs
  activeTaskPaneTab: 'layers',
  setActiveTaskPaneTab: (tab) => set({ activeTaskPaneTab: tab }),

  // Floating panels
  drawingPanelOpen: false,
  bufferPanelOpen: false,
  measurePanelOpen: false,
  setDrawingPanelOpen: (open) => set({ drawingPanelOpen: open }),
  setBufferPanelOpen: (open) => set({ bufferPanelOpen: open }),
  setMeasurePanelOpen: (open) => set({ measurePanelOpen: open }),
  closeAllPanels: () =>
    set({
      drawingPanelOpen: false,
      bufferPanelOpen: false,
      measurePanelOpen: false,
    }),

  // Notifications
  notifications: [],
  addNotification: (notification) =>
    set((state) => ({
      notifications: [
        ...state.notifications,
        { ...notification, id: crypto.randomUUID() },
      ],
    })),
  removeNotification: (id) =>
    set((state) => ({
      notifications: state.notifications.filter((n) => n.id !== id),
    })),
}));
