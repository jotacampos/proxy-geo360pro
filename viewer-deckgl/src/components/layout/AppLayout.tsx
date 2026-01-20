import { useRef, useEffect } from 'react';
import {
  Panel,
  Group,
  Separator,
  PanelImperativeHandle,
} from 'react-resizable-panels';
import { SelectionPanel } from './SelectionPanel/SelectionPanel';
import { TaskPane } from './TaskPane/TaskPane';
import { StatusBar } from './StatusBar/StatusBar';
import MapView from '../MapView';
import { useStore } from '../../store';

export function AppLayout() {
  const selectionPanelRef = useRef<PanelImperativeHandle>(null);
  const taskPaneRef = useRef<PanelImperativeHandle>(null);

  const {
    selectedFeatureIndexes,
    editMode,
  } = useStore();

  // Determina se está em modo de desenho
  const isDrawing = editMode.startsWith('draw-') || editMode === 'measure-distance' || editMode === 'measure-area' || editMode === 'measure-angle';

  // Auto-expandir/colapsar Selection Panel baseado na seleção
  useEffect(() => {
    const panel = selectionPanelRef.current;
    if (!panel) return;

    const hasSelection = selectedFeatureIndexes.length > 0 || isDrawing;

    if (hasSelection && panel.isCollapsed()) {
      panel.expand();
    } else if (!hasSelection && !panel.isCollapsed()) {
      // Pequeno delay para não colapsar imediatamente ao limpar seleção
      const timeout = setTimeout(() => {
        if (selectedFeatureIndexes.length === 0 && !isDrawing) {
          panel.collapse();
        }
      }, 300);
      return () => clearTimeout(timeout);
    }
  }, [selectedFeatureIndexes.length, isDrawing]);

  return (
    <div className="h-screen flex flex-col bg-dark text-white overflow-hidden">
      {/* Área principal com painéis redimensionáveis */}
      <Group
        orientation="horizontal"
        id="main-horizontal"
        className="flex-1"
      >
        {/* Selection Panel (Esquerda) - contextual */}
        <Panel
          panelRef={selectionPanelRef}
          id="selection-panel"
          defaultSize={4}
          minSize={4}
          maxSize={30}
          collapsible
          collapsedSize={4}
        >
          <SelectionPanel
            onToggleCollapse={() => {
              const panel = selectionPanelRef.current;
              if (panel?.isCollapsed()) {
                panel.expand();
              } else {
                panel?.collapse();
              }
            }}
          />
        </Panel>

        {/* Resize handle entre Selection e Mapa */}
        <Separator className="w-1 bg-gray-800 hover:bg-primary transition-colors cursor-col-resize" />

        {/* Área do Mapa (Centro) */}
        <Panel id="map-panel" defaultSize={71} minSize={40}>
          <MapView />
        </Panel>

        {/* Resize handle entre Mapa e Task Pane */}
        <Separator className="w-1 bg-gray-800 hover:bg-primary transition-colors cursor-col-resize" />

        {/* Task Pane (Direita) - colapsável */}
        <Panel
          panelRef={taskPaneRef}
          id="task-pane"
          defaultSize={25}
          minSize={4}
          maxSize={40}
          collapsible
          collapsedSize={4}
        >
          <TaskPane
            onToggleCollapse={() => {
              const panel = taskPaneRef.current;
              if (panel?.isCollapsed()) {
                panel.expand();
              } else {
                panel?.collapse();
              }
            }}
          />
        </Panel>
      </Group>

      {/* Status Bar fixo no rodapé */}
      <StatusBar />
    </div>
  );
}
