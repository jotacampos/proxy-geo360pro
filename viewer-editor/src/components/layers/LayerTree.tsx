import { useState } from 'react';

// Types
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
}

// Mock data
const INITIAL_LAYERS: LayerItem[] = [
  { id: 'cadastro', name: 'Cadastro', type: 'group', visible: true, selectable: true, editable: true, parentId: null },
  { id: 'lotes', name: 'Lotes', type: 'layer', visible: true, selectable: true, editable: true, color: '#3B82F6', featureCount: 1234, parentId: 'cadastro', geomType: 'Polygon' },
  { id: 'edificacoes', name: 'Edificações', type: 'layer', visible: true, selectable: true, editable: false, color: '#10B981', featureCount: 892, parentId: 'cadastro', geomType: 'Polygon' },
  { id: 'logradouros', name: 'Logradouros', type: 'layer', visible: false, selectable: true, editable: false, color: '#F59E0B', featureCount: 156, parentId: 'cadastro', geomType: 'LineString' },
  { id: 'infra', name: 'Infraestrutura', type: 'group', visible: true, selectable: true, editable: true, parentId: null },
  { id: 'postes', name: 'Postes', type: 'layer', visible: true, selectable: true, editable: false, color: '#8B5CF6', featureCount: 456, parentId: 'infra', geomType: 'Point' },
  { id: 'redes', name: 'Redes Elétricas', type: 'layer', visible: true, selectable: false, editable: false, color: '#EC4899', featureCount: 234, parentId: 'infra', geomType: 'LineString' },
  { id: 'hidro', name: 'Hidrografia', type: 'group', visible: true, selectable: true, editable: true, parentId: null },
  { id: 'rios', name: 'Rios', type: 'layer', visible: true, selectable: true, editable: false, color: '#06B6D4', featureCount: 23, parentId: 'hidro', geomType: 'LineString' },
  { id: 'nascentes', name: 'Nascentes', type: 'layer', visible: true, selectable: true, editable: false, color: '#0EA5E9', featureCount: 45, parentId: 'hidro', geomType: 'Point' },
];

const GEOM_ICONS: Record<string, string> = {
  Point: '●',
  LineString: '━',
  Polygon: '⬡',
};

interface LayerTreeProps {
  onLayerSelect?: (layer: LayerItem) => void;
  onLayerToggle?: (layerId: string, property: 'visible' | 'selectable' | 'editable') => void;
  onLayerZoom?: (layer: LayerItem) => void;
  onOpenTable?: (layer: LayerItem) => void;
}

export function LayerTree({ onLayerSelect, onLayerToggle, onLayerZoom, onOpenTable }: LayerTreeProps) {
  const [layers, setLayers] = useState<LayerItem[]>(INITIAL_LAYERS);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set(['cadastro', 'infra', 'hidro']));
  const [selectedLayer, setSelectedLayer] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; layerId: string } | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');

  // Get root level items (groups)
  const rootItems = layers.filter(l => l.parentId === null);

  // Get children of a group
  const getChildren = (parentId: string) => layers.filter(l => l.parentId === parentId);

  // Toggle group expansion
  const toggleExpand = (groupId: string) => {
    setExpandedGroups(prev => {
      const next = new Set(prev);
      if (next.has(groupId)) {
        next.delete(groupId);
      } else {
        next.add(groupId);
      }
      return next;
    });
  };

  // Toggle layer property
  const toggleProperty = (layerId: string, property: 'visible' | 'selectable' | 'editable') => {
    setLayers(prev => prev.map(l => l.id === layerId ? { ...l, [property]: !l[property] } : l));
    onLayerToggle?.(layerId, property);
  };

  // Select layer
  const selectLayer = (layer: LayerItem) => {
    setSelectedLayer(layer.id);
    onLayerSelect?.(layer);
  };

  // Start renaming
  const startRename = (layer: LayerItem) => {
    setRenamingId(layer.id);
    setRenameValue(layer.name);
    setContextMenu(null);
  };

  // Confirm rename
  const confirmRename = () => {
    if (renamingId && renameValue.trim()) {
      setLayers(prev => prev.map(l => l.id === renamingId ? { ...l, name: renameValue.trim() } : l));
    }
    setRenamingId(null);
    setRenameValue('');
  };

  // Context menu
  const handleContextMenu = (e: React.MouseEvent, layer: LayerItem) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, layerId: layer.id });
  };

  // Filter by search
  const matchesSearch = (layer: LayerItem) => {
    if (!searchQuery) return true;
    return layer.name.toLowerCase().includes(searchQuery.toLowerCase());
  };

  // Render a layer item
  const renderLayer = (layer: LayerItem, depth: number = 0) => {
    if (!matchesSearch(layer) && layer.type === 'layer') return null;

    const isGroup = layer.type === 'group';
    const isExpanded = expandedGroups.has(layer.id);
    const isSelected = selectedLayer === layer.id;
    const isRenaming = renamingId === layer.id;
    const children = getChildren(layer.id);

    // For groups, check if any child matches search
    if (isGroup && searchQuery && !children.some(c => matchesSearch(c))) {
      return null;
    }

    return (
      <div key={layer.id}>
        <div
          onClick={() => selectLayer(layer)}
          onContextMenu={(e) => handleContextMenu(e, layer)}
          onDoubleClick={() => !isGroup && onLayerZoom?.(layer)}
          className={`flex items-center gap-1 px-2 py-1.5 cursor-pointer transition-colors rounded mx-1 my-0.5 ${
            isSelected ? 'bg-emerald-900/50 text-white' : 'hover:bg-gray-700/50'
          }`}
          style={{ paddingLeft: `${depth * 16 + 8}px` }}
        >
          {/* Expand/Collapse for groups */}
          {isGroup ? (
            <button
              onClick={(e) => { e.stopPropagation(); toggleExpand(layer.id); }}
              className="w-4 h-4 flex items-center justify-center text-gray-400 hover:text-white text-xs"
            >
              {isExpanded ? '▼' : '▶'}
            </button>
          ) : (
            <span className="w-4 h-4 flex items-center justify-center text-xs" style={{ color: layer.color }}>
              {GEOM_ICONS[layer.geomType || 'Polygon']}
            </span>
          )}

          {/* Icon */}
          {isGroup && <span className="text-sm">📁</span>}

          {/* Name (or rename input) */}
          {isRenaming ? (
            <input
              type="text"
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              onBlur={confirmRename}
              onKeyDown={(e) => {
                if (e.key === 'Enter') confirmRename();
                if (e.key === 'Escape') { setRenamingId(null); setRenameValue(''); }
              }}
              onClick={(e) => e.stopPropagation()}
              autoFocus
              className="flex-1 bg-gray-700 border border-emerald-500 rounded px-1 text-sm text-white outline-none"
            />
          ) : (
            <span className="flex-1 text-sm truncate">{layer.name}</span>
          )}

          {/* Feature count */}
          {!isGroup && layer.featureCount && (
            <span className="text-xs text-gray-500 mr-1">{layer.featureCount}</span>
          )}

          {/* Controls */}
          {!isGroup && !isRenaming && (
            <div className="flex gap-0.5" onClick={(e) => e.stopPropagation()}>
              <button
                onClick={() => toggleProperty(layer.id, 'visible')}
                className={`p-1 rounded text-xs ${layer.visible ? 'text-emerald-400' : 'text-gray-600'}`}
                title={layer.visible ? 'Ocultar' : 'Mostrar'}
              >
                👁️
              </button>
              <button
                onClick={() => toggleProperty(layer.id, 'selectable')}
                className={`p-1 rounded text-xs ${layer.selectable ? 'text-emerald-400' : 'text-gray-600'}`}
                title={layer.selectable ? 'Desabilitar seleção' : 'Habilitar seleção'}
              >
                🖱️
              </button>
              <button
                onClick={() => toggleProperty(layer.id, 'editable')}
                className={`p-1 rounded text-xs ${layer.editable ? 'text-emerald-400' : 'text-gray-600'}`}
                title={layer.editable ? 'Bloquear' : 'Desbloquear'}
              >
                {layer.editable ? '🔓' : '🔒'}
              </button>
              <button
                onClick={() => onLayerZoom?.(layer)}
                className="p-1 rounded text-xs text-gray-400 hover:text-white"
                title="Zoom"
              >
                🔍
              </button>
            </div>
          )}
        </div>

        {/* Children */}
        {isGroup && isExpanded && children.map(child => renderLayer(child, depth + 1))}
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full" onClick={() => setContextMenu(null)}>
      {/* Search */}
      <div className="p-2 border-b border-gray-700">
        <input
          type="text"
          placeholder="🔍 Buscar camada..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full bg-gray-800 border border-gray-600 rounded px-2 py-1.5 text-xs text-white focus:outline-none focus:border-emerald-500"
        />
      </div>

      {/* Legend */}
      <div className="px-3 py-2 text-xs text-gray-500 border-b border-gray-700 flex gap-3">
        <span>👁️ Visível</span>
        <span>🖱️ Selecionável</span>
        <span>🔓 Editável</span>
      </div>

      {/* Tree */}
      <div className="flex-1 overflow-auto py-1">
        {rootItems.map(item => renderLayer(item))}
      </div>

      {/* Actions */}
      <div className="p-2 border-t border-gray-700 flex gap-2">
        <button className="flex-1 p-2 bg-gray-800 rounded text-xs text-gray-400 hover:bg-gray-700 hover:text-white">
          + Grupo
        </button>
        <button className="flex-1 p-2 bg-gray-800 rounded text-xs text-gray-400 hover:bg-gray-700 hover:text-white">
          + Camada
        </button>
      </div>

      {/* Context Menu */}
      {contextMenu && (() => {
        const layer = layers.find(l => l.id === contextMenu.layerId);
        if (!layer) return null;
        return (
          <div
            className="fixed bg-gray-800 border border-gray-600 rounded shadow-lg py-1 z-50 min-w-[180px]"
            style={{ top: contextMenu.y, left: contextMenu.x }}
            onClick={(e) => e.stopPropagation()}
          >
            {layer.type === 'layer' && (
              <>
                <button
                  onClick={() => { onOpenTable?.(layer); setContextMenu(null); }}
                  className="w-full px-3 py-1.5 text-left text-sm text-gray-300 hover:bg-gray-700"
                >
                  📋 Abrir tabela de atributos
                </button>
                <button
                  onClick={() => { onLayerZoom?.(layer); setContextMenu(null); }}
                  className="w-full px-3 py-1.5 text-left text-sm text-gray-300 hover:bg-gray-700"
                >
                  🔍 Zoom para camada
                </button>
                <div className="border-t border-gray-700 my-1" />
              </>
            )}
            <button
              onClick={() => { toggleProperty(layer.id, 'visible'); setContextMenu(null); }}
              className="w-full px-3 py-1.5 text-left text-sm text-gray-300 hover:bg-gray-700 flex justify-between"
            >
              <span>👁️ Visível</span>
              {layer.visible && <span>✓</span>}
            </button>
            <button
              onClick={() => { toggleProperty(layer.id, 'selectable'); setContextMenu(null); }}
              className="w-full px-3 py-1.5 text-left text-sm text-gray-300 hover:bg-gray-700 flex justify-between"
            >
              <span>🖱️ Selecionável</span>
              {layer.selectable && <span>✓</span>}
            </button>
            <button
              onClick={() => { toggleProperty(layer.id, 'editable'); setContextMenu(null); }}
              className="w-full px-3 py-1.5 text-left text-sm text-gray-300 hover:bg-gray-700 flex justify-between"
            >
              <span>🔓 Editável</span>
              {layer.editable && <span>✓</span>}
            </button>
            <div className="border-t border-gray-700 my-1" />
            <button
              onClick={() => startRename(layer)}
              className="w-full px-3 py-1.5 text-left text-sm text-gray-300 hover:bg-gray-700"
            >
              ✏️ Renomear
            </button>
            <button
              onClick={() => {
                setLayers(prev => prev.filter(l => l.id !== layer.id));
                setContextMenu(null);
              }}
              className="w-full px-3 py-1.5 text-left text-sm text-red-400 hover:bg-gray-700"
            >
              🗑️ Remover
            </button>
          </div>
        );
      })()}
    </div>
  );
}
