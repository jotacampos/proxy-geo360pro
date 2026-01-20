import {
  Eye,
  EyeOff,
  MousePointer2,
  Lock,
  Unlock,
  ZoomIn,
  Layers,
  Database,
} from 'lucide-react';
import { useStore } from '../../../store';
import type { Layer } from '../../../types';

export function LayerTree() {
  const {
    layers,
    visibleLayers,
    selectableLayers,
    editableLayers,
    layersLoading,
    toggleLayerVisibility,
    toggleLayerSelectable,
    toggleLayerEditable,
    zoomToLayer,
  } = useStore();

  if (layersLoading) {
    return (
      <div className="p-4 text-gray-400 text-sm flex items-center gap-2">
        <div className="animate-spin h-4 w-4 border-2 border-primary border-t-transparent rounded-full" />
        <span>Carregando camadas...</span>
      </div>
    );
  }

  if (layers.length === 0) {
    return (
      <div className="p-4 text-gray-400 text-sm">
        <p>Nenhuma camada disponível.</p>
        <p className="text-xs text-gray-500 mt-2">
          Selecione uma organização com camadas configuradas.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header with global controls */}
      <div className="px-3 py-2 border-b border-gray-700 flex items-center gap-2 text-xs text-gray-400">
        <Layers size={14} />
        <span>{layers.length} camada(s)</span>
      </div>

      {/* Layer list */}
      <div className="flex-1 overflow-auto">
        {layers.map((layer) => (
          <LayerItem
            key={layer.id}
            layer={layer}
            isVisible={visibleLayers.has(layer.id)}
            isSelectable={selectableLayers.has(layer.id)}
            isEditable={editableLayers.has(layer.id)}
            onToggleVisible={() => toggleLayerVisibility(layer.id)}
            onToggleSelectable={() => toggleLayerSelectable(layer.id)}
            onToggleEditable={() => toggleLayerEditable(layer.id)}
            onZoomTo={() => zoomToLayer(layer.id)}
          />
        ))}
      </div>

      {/* Legend */}
      <div className="px-3 py-2 border-t border-gray-700 text-xs text-gray-500">
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1">
            <Eye size={12} /> Visível
          </span>
          <span className="flex items-center gap-1">
            <MousePointer2 size={12} /> Selecionável
          </span>
          <span className="flex items-center gap-1">
            <Unlock size={12} /> Editável
          </span>
        </div>
      </div>
    </div>
  );
}

interface LayerItemProps {
  layer: Layer;
  isVisible: boolean;
  isSelectable: boolean;
  isEditable: boolean;
  onToggleVisible: () => void;
  onToggleSelectable: () => void;
  onToggleEditable: () => void;
  onZoomTo: () => void;
}

function LayerItem({
  layer,
  isVisible,
  isSelectable,
  isEditable,
  onToggleVisible,
  onToggleSelectable,
  onToggleEditable,
  onZoomTo,
}: LayerItemProps) {
  return (
    <div
      className={`group flex items-center px-2 py-1.5 border-b border-gray-800 hover:bg-gray-800/50 transition-colors ${
        !isVisible ? 'opacity-50' : ''
      }`}
    >
      {/* Layer info */}
      <div className="flex-1 min-w-0 flex items-center gap-2">
        <Database size={14} className="text-gray-500 flex-shrink-0" />
        <div className="min-w-0">
          <div className="text-sm truncate" title={layer.name}>
            {layer.name}
          </div>
          <div className="text-xs text-gray-500 truncate" title={`${layer.schema}.${layer.tableName}`}>
            {layer.recordsCount.toLocaleString()} registros
          </div>
        </div>
      </div>

      {/* Layer controls */}
      <div className="flex items-center gap-1">
        {/* Visible toggle */}
        <LayerControl
          active={isVisible}
          onClick={onToggleVisible}
          title={isVisible ? 'Ocultar camada' : 'Mostrar camada'}
          activeIcon={<Eye size={16} />}
          inactiveIcon={<EyeOff size={16} />}
          activeColor="text-blue-400"
        />

        {/* Selectable toggle */}
        <LayerControl
          active={isSelectable}
          onClick={onToggleSelectable}
          title={isSelectable ? 'Desabilitar seleção' : 'Habilitar seleção'}
          activeIcon={<MousePointer2 size={16} />}
          inactiveIcon={<MousePointer2 size={16} />}
          activeColor="text-green-400"
          disabled={!isVisible}
        />

        {/* Editable toggle */}
        <LayerControl
          active={isEditable}
          onClick={onToggleEditable}
          title={isEditable ? 'Bloquear edição' : 'Permitir edição'}
          activeIcon={<Unlock size={16} />}
          inactiveIcon={<Lock size={16} />}
          activeColor="text-orange-400"
          disabled={!isVisible || !isSelectable}
        />

        {/* Zoom to extent */}
        <LayerControl
          active={false}
          onClick={onZoomTo}
          title="Zoom para extensão"
          activeIcon={<ZoomIn size={16} />}
          inactiveIcon={<ZoomIn size={16} />}
          activeColor="text-gray-300"
          alwaysShow
        />
      </div>
    </div>
  );
}

interface LayerControlProps {
  active: boolean;
  onClick: () => void;
  title: string;
  activeIcon: React.ReactNode;
  inactiveIcon: React.ReactNode;
  activeColor: string;
  disabled?: boolean;
  alwaysShow?: boolean;
}

function LayerControl({
  active,
  onClick,
  title,
  activeIcon,
  inactiveIcon,
  activeColor,
  disabled,
  alwaysShow,
}: LayerControlProps) {
  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        if (!disabled) onClick();
      }}
      disabled={disabled}
      className={`p-1 rounded transition-colors ${
        disabled
          ? 'text-gray-600 cursor-not-allowed'
          : active
          ? `${activeColor} hover:bg-gray-700`
          : 'text-gray-500 hover:text-gray-300 hover:bg-gray-700'
      } ${!alwaysShow && !active ? 'opacity-50 group-hover:opacity-100' : ''}`}
      title={title}
    >
      {active ? activeIcon : inactiveIcon}
    </button>
  );
}
