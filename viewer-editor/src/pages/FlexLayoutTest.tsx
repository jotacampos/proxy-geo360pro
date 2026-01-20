import { useCallback, useRef, useState, useEffect, useMemo } from 'react';
import {
  Layout,
  Model,
  TabNode,
  TabSetNode,
  BorderNode,
  IJsonModel,
  Action,
  Actions,
  DockLocation,
  ITabSetRenderValues,
} from 'flexlayout-react';
import 'flexlayout-react/style/dark.css';
import { MapView } from '../components/map/MapView';
import { useEditorStore, type DrawingMode } from '../stores';

// ============================================================================
// Types
// ============================================================================

interface PanelConfig {
  id: string;
  name: string;
  icon: string;
  component: string;
  defaultLocation: 'left' | 'right' | 'bottom' | 'center';
}

type RibbonTab = 'selecao' | 'criar' | 'editar' | 'analise' | 'medicao' | 'ferramentas';

interface ToolButton {
  id: string;
  icon: string;
  label: string;
  shortcut?: string;
  disabled?: boolean;
}

interface ToolGroup {
  name: string;
  tools: ToolButton[];
}

// ============================================================================
// Ribbon Tools Configuration
// ============================================================================

const RIBBON_TABS: { id: RibbonTab; label: string; icon: string }[] = [
  { id: 'selecao', label: 'Seleção', icon: '⬚' },
  { id: 'criar', label: 'Criar', icon: '✏️' },
  { id: 'editar', label: 'Editar', icon: '⧉' },
  { id: 'analise', label: 'Análise', icon: '📊' },
  { id: 'medicao', label: 'Medição', icon: '📏' },
  { id: 'ferramentas', label: 'Ferramentas', icon: '🛠️' },
];

const RIBBON_TOOLS: Record<RibbonTab, ToolGroup[]> = {
  selecao: [
    {
      name: 'Modo',
      tools: [
        { id: 'select-single', icon: '👆', label: 'Simples' },
        { id: 'select-multi', icon: '👆', label: 'Múltipla' },
      ],
    },
    {
      name: 'Área',
      tools: [
        { id: 'select-rectangle', icon: '⬚', label: 'Retângulo' },
        { id: 'select-lasso', icon: '〰️', label: 'Laço' },
        { id: 'select-polygon', icon: '⬡', label: 'Polígono' },
      ],
    },
    {
      name: 'Painel',
      tools: [
        { id: 'panel-selection', icon: '📋', label: 'Seleção' },
      ],
    },
  ],
  criar: [
    {
      name: 'Básico',
      tools: [
        { id: 'draw-point', icon: '📍', label: 'Ponto', shortcut: 'P' },
        { id: 'draw-line', icon: '📏', label: 'Linha', shortcut: 'L' },
        { id: 'draw-polygon', icon: '⬡', label: 'Polígono', shortcut: 'G' },
        { id: 'draw-lasso', icon: '〰️', label: 'Laço' },
      ],
    },
    {
      name: 'Retângulos',
      tools: [
        { id: 'draw-rectangle', icon: '▭', label: 'Retângulo', shortcut: 'R' },
        { id: 'draw-square', icon: '⬜', label: 'Quadrado' },
        { id: 'draw-rectangle-3pts', icon: '⊟', label: '3 Pontos' },
      ],
    },
    {
      name: 'Círculos',
      tools: [
        { id: 'draw-circle', icon: '⭕', label: 'Círculo', shortcut: 'C' },
        { id: 'draw-ellipse', icon: '⬭', label: 'Elipse' },
      ],
    },
    {
      name: 'Especial',
      tools: [
        { id: 'draw-90deg-polygon', icon: '📐', label: '90°' },
        { id: 'extend-line', icon: '➡️', label: 'Estender' },
      ],
    },
  ],
  editar: [
    {
      name: 'Geometria',
      tools: [
        { id: 'modify', icon: '✏️', label: 'Vértices', shortcut: 'E' },
        { id: 'split-polygon', icon: '✂️', label: 'Dividir' },
        { id: 'extrude', icon: '↗️', label: 'Extrudar' },
        { id: 'elevation', icon: '⬆️', label: 'Elevação' },
      ],
    },
    {
      name: 'Transformar',
      tools: [
        { id: 'translate', icon: '↔️', label: 'Mover', shortcut: 'M' },
        { id: 'rotate', icon: '🔄', label: 'Rotacionar' },
        { id: 'scale', icon: '⤢', label: 'Escalar' },
        { id: 'transform', icon: '⧉', label: 'Livre' },
      ],
    },
    {
      name: 'Ações',
      tools: [
        { id: 'duplicate', icon: '📋', label: 'Duplicar', shortcut: 'Ctrl+D' },
        { id: 'delete', icon: '🗑️', label: 'Excluir', shortcut: 'Del' },
      ],
    },
  ],
  analise: [
    {
      name: 'Operações',
      tools: [
        { id: 'buffer', icon: '⭕', label: 'Buffer' },
        { id: 'union', icon: '🔗', label: 'Unir' },
        { id: 'intersect', icon: '∩', label: 'Interseção' },
        { id: 'difference', icon: '➖', label: 'Diferença' },
      ],
    },
    {
      name: 'Dividir',
      tools: [
        { id: 'clip', icon: '✂️', label: 'Cortar' },
        { id: 'split', icon: '⚔️', label: 'Dividir' },
      ],
    },
    {
      name: 'Geometria',
      tools: [
        { id: 'simplify', icon: '〰️', label: 'Simplificar' },
        { id: 'smooth', icon: '🌊', label: 'Suavizar' },
      ],
    },
  ],
  medicao: [
    {
      name: 'Medir',
      tools: [
        { id: 'measure-distance', icon: '📏', label: 'Distância' },
        { id: 'measure-area', icon: '📐', label: 'Área' },
        { id: 'measure-angle', icon: '∠', label: 'Ângulo' },
        { id: 'measure-perimeter', icon: '⭕', label: 'Perímetro' },
      ],
    },
    {
      name: 'Opções',
      tools: [
        { id: 'measure-clear', icon: '🗑️', label: 'Limpar' },
        { id: 'measure-export', icon: '📤', label: 'Exportar' },
      ],
    },
  ],
  ferramentas: [
    {
      name: 'Snap',
      tools: [
        { id: 'snap-toggle', icon: '🧲', label: 'Snap', shortcut: 'S' },
        { id: 'snap-settings', icon: '⚙️', label: 'Config.' },
      ],
    },
    {
      name: 'Arquivo',
      tools: [
        { id: 'download-geojson', icon: '📤', label: 'Exportar' },
        { id: 'load-geojson', icon: '📂', label: 'Importar' },
        { id: 'clear-all', icon: '🗑️', label: 'Limpar Tudo' },
      ],
    },
    {
      name: 'Painéis',
      tools: [
        { id: 'panel-layers', icon: '📑', label: 'Camadas' },
        { id: 'panel-attributes', icon: '📋', label: 'Atributos' },
        { id: 'panel-options', icon: '🔧', label: 'Opções' },
        { id: 'panel-table', icon: '🗃️', label: 'Tabela' },
      ],
    },
  ],
};

// ============================================================================
// Panel Configuration
// ============================================================================

const PANELS: PanelConfig[] = [
  { id: 'layers', name: 'Camadas', icon: '📑', component: 'layers', defaultLocation: 'left' },
  { id: 'selection', name: 'Seleção', icon: '⬚', component: 'selection', defaultLocation: 'left' },
  { id: 'snap', name: 'Snap', icon: '🧲', component: 'snap', defaultLocation: 'left' },
  { id: 'options', name: 'Opções', icon: '🔧', component: 'options', defaultLocation: 'right' },
  { id: 'attributes', name: 'Atributos', icon: '📋', component: 'attributes', defaultLocation: 'right' },
  { id: 'history', name: 'Histórico', icon: '📜', component: 'history', defaultLocation: 'right' },
  { id: 'analysis', name: 'Análise', icon: '📊', component: 'analysis', defaultLocation: 'right' },
  { id: 'table', name: 'Tabela de Atributos', icon: '📊', component: 'table', defaultLocation: 'bottom' },
];

const DEFAULT_VISIBLE_PANELS = ['layers', 'selection', 'snap', 'options', 'table'];

// ============================================================================
// Mock Components
// ============================================================================

// Real Selection Panel - shows selected features from the store
function SelectionPanel() {
  const { features, selectedIndexes, setSelectedIndexes, deleteFeatures, setMode, mode, drawingCoordinates } = useEditorStore();

  // Check if actively drawing (has coordinates in progress)
  // Edit operations are disabled only while actively drawing
  // After finishing (coordinates cleared), edit is re-enabled even if still in draw mode
  const isActivelyDrawing = mode.startsWith('draw-') && drawingCoordinates.length > 0;

  // Get selected features
  const selectedFeatures = selectedIndexes.map(idx => ({
    index: idx,
    feature: features.features[idx],
  })).filter(item => item.feature);

  // Analyze selection to determine available operations
  const selectionAnalysis = useMemo(() => {
    if (selectedFeatures.length === 0) {
      return {
        count: 0,
        types: [] as string[],
        hasPoints: false,
        hasLines: false,
        hasPolygons: false,
        isSinglePoint: false,
        isSingleLine: false,
        isSinglePolygon: false,
        isMultiplePoints: false,
        isMixed: false,
      };
    }

    const types = [...new Set(selectedFeatures.map(f => f.feature.geometry.type))];
    const pointCount = selectedFeatures.filter(f => f.feature.geometry.type === 'Point').length;
    const lineCount = selectedFeatures.filter(f => f.feature.geometry.type === 'LineString').length;
    const polygonCount = selectedFeatures.filter(f => f.feature.geometry.type === 'Polygon').length;

    return {
      count: selectedFeatures.length,
      types,
      hasPoints: pointCount > 0,
      hasLines: lineCount > 0,
      hasPolygons: polygonCount > 0,
      isSinglePoint: selectedFeatures.length === 1 && pointCount === 1,
      isSingleLine: selectedFeatures.length === 1 && lineCount === 1,
      isSinglePolygon: selectedFeatures.length === 1 && polygonCount === 1,
      isMultiplePoints: pointCount > 1 && lineCount === 0 && polygonCount === 0,
      isMixed: types.length > 1,
    };
  }, [selectedFeatures]);

  // Determine which operations are available based on selection
  const availableOperations = useMemo(() => {
    const { count, isSinglePoint, isSingleLine, isSinglePolygon, isMultiplePoints } = selectionAnalysis;

    if (count === 0) {
      return {
        canEdit: false,
        canMove: false,
        canRotate: false,
        canScale: false,
        canDelete: false,
        editLabel: 'Editar',
        editDescription: '',
        moveLabel: 'Mover',
        moveDescription: '',
      };
    }

    // Single point: Edit/Move are the same (change coordinates), no rotate/scale
    if (isSinglePoint) {
      return {
        canEdit: true,
        canMove: false, // Hide move, edit does the same thing
        canRotate: false,
        canScale: false,
        canDelete: true,
        editLabel: 'Editar Coordenadas',
        editDescription: 'Altere a posição do ponto',
        moveLabel: 'Mover',
        moveDescription: '',
      };
    }

    // Multiple points only: Can move all together, rotate around centroid, scale
    if (isMultiplePoints) {
      return {
        canEdit: false, // Can't edit vertices of multiple points
        canMove: true,
        canRotate: true,
        canScale: true,
        canDelete: true,
        editLabel: 'Editar',
        editDescription: '',
        moveLabel: 'Mover Todos',
        moveDescription: 'Move todos os pontos juntos',
      };
    }

    // Single line or polygon: Can edit vertices, move, rotate, scale
    if (isSingleLine || isSinglePolygon) {
      return {
        canEdit: true,
        canMove: true,
        canRotate: true,
        canScale: true,
        canDelete: true,
        editLabel: 'Editar Vértices',
        editDescription: 'Edite os vértices da geometria',
        moveLabel: 'Mover',
        moveDescription: 'Move a geometria inteira',
      };
    }

    // Multiple geometries (any type): Can move, rotate, scale together
    return {
      canEdit: false, // Can't edit vertices of multiple geometries
      canMove: true,
      canRotate: true,
      canScale: true,
      canDelete: true,
      editLabel: 'Editar',
      editDescription: '',
      moveLabel: 'Mover Todos',
      moveDescription: 'Move todas as geometrias juntas',
    };
  }, [selectionAnalysis]);

  // Get geometry type icon
  const getGeometryIcon = (type: string) => {
    switch (type) {
      case 'Point': return '📍';
      case 'LineString': return '📏';
      case 'Polygon': return '⬡';
      case 'MultiPoint': return '📍📍';
      case 'MultiLineString': return '📏📏';
      case 'MultiPolygon': return '⬡⬡';
      default: return '📐';
    }
  };

  // Get geometry type name in Portuguese
  const getGeometryName = (type: string) => {
    switch (type) {
      case 'Point': return 'Ponto';
      case 'LineString': return 'Linha';
      case 'Polygon': return 'Polígono';
      case 'MultiPoint': return 'Multi-Ponto';
      case 'MultiLineString': return 'Multi-Linha';
      case 'MultiPolygon': return 'Multi-Polígono';
      default: return type;
    }
  };

  // Calculate area for polygons (approximate)
  const calculateArea = (geometry: any): number | null => {
    if (geometry.type !== 'Polygon' && geometry.type !== 'MultiPolygon') return null;
    // Simple shoelace formula for approximate area in degrees (not accurate for real-world use)
    const coords = geometry.type === 'Polygon' ? geometry.coordinates[0] : geometry.coordinates[0][0];
    if (!coords || coords.length < 3) return null;
    let area = 0;
    for (let i = 0; i < coords.length - 1; i++) {
      area += coords[i][0] * coords[i + 1][1];
      area -= coords[i + 1][0] * coords[i][1];
    }
    // Convert to approximate m² (very rough)
    return Math.abs(area / 2) * 111319.9 * 111319.9 * Math.cos((coords[0][1] * Math.PI) / 180);
  };

  // Handle click on feature item (toggle selection)
  const handleFeatureClick = (index: number, event: React.MouseEvent) => {
    if (event.ctrlKey || event.metaKey) {
      // Multi-select with Ctrl/Cmd
      if (selectedIndexes.includes(index)) {
        setSelectedIndexes(selectedIndexes.filter(i => i !== index));
      } else {
        setSelectedIndexes([...selectedIndexes, index]);
      }
    } else {
      // Single select
      setSelectedIndexes([index]);
    }
  };

  // Handle delete selected
  const handleDelete = () => {
    if (selectedIndexes.length > 0) {
      deleteFeatures(selectedIndexes);
    }
  };

  // Handle edit (switch to modify mode)
  const handleEdit = () => {
    if (selectedIndexes.length > 0) {
      setMode('modify');
    }
  };

  // Handle move (switch to translate mode)
  const handleMove = () => {
    if (selectedIndexes.length > 0) {
      setMode('translate');
    }
  };

  // Handle rotate
  const handleRotate = () => {
    if (selectedIndexes.length > 0) {
      setMode('rotate');
    }
  };

  // Handle scale
  const handleScale = () => {
    if (selectedIndexes.length > 0) {
      setMode('scale');
    }
  };

  // Handle clear selection
  const handleClearSelection = () => {
    setSelectedIndexes([]);
  };

  // Handle select all
  const handleSelectAll = () => {
    setSelectedIndexes(features.features.map((_, idx) => idx));
  };

  return (
    <div className="h-full bg-gray-800 text-white flex flex-col">
      {/* Header */}
      <div className="p-3 border-b border-gray-700">
        <div className="flex items-center justify-between">
          <span className="text-xs text-gray-400">
            {selectedFeatures.length} de {features.features.length} selecionado(s)
          </span>
          <div className="flex gap-1">
            <button
              onClick={handleSelectAll}
              disabled={features.features.length === 0}
              className="px-2 py-0.5 text-xs text-gray-400 hover:text-white disabled:opacity-50"
              title="Selecionar tudo"
            >
              Tudo
            </button>
            <button
              onClick={handleClearSelection}
              disabled={selectedFeatures.length === 0}
              className="px-2 py-0.5 text-xs text-gray-400 hover:text-white disabled:opacity-50"
              title="Limpar seleção"
            >
              Limpar
            </button>
          </div>
        </div>
      </div>

      {/* Feature list */}
      <div className="flex-1 overflow-auto p-3">
        {selectedFeatures.length === 0 ? (
          <div className="text-center py-8">
            <div className="text-3xl mb-2 opacity-50">⬚</div>
            <p className="text-xs text-gray-500">Nenhuma geometria selecionada</p>
            <p className="text-xs text-gray-600 mt-1">
              Clique em uma geometria no mapa para selecioná-la
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {selectedFeatures.map(({ index, feature }) => {
              const area = calculateArea(feature.geometry);
              return (
                <div
                  key={feature.properties?.id || index}
                  onClick={(e) => handleFeatureClick(index, e)}
                  className="p-2 bg-gray-700 rounded border border-emerald-500 cursor-pointer hover:bg-gray-600"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-emerald-400">
                      {getGeometryIcon(feature.geometry.type)}
                    </span>
                    <span className="text-sm flex-1">
                      {getGeometryName(feature.geometry.type)} #{index + 1}
                    </span>
                    <span className="text-[10px] text-gray-500">
                      {new Date(feature.properties?.createdAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  {area !== null && (
                    <div className="text-xs text-gray-400 mt-1">
                      Área: {area < 1000 ? area.toFixed(2) + ' m²' : (area / 1000).toFixed(2) + ' km²'}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Operations */}
      {selectedFeatures.length > 0 && (
        <div className="p-3 border-t border-gray-700">
          <h4 className="text-xs font-semibold text-gray-400 mb-2">OPERAÇÕES</h4>

          {/* Warning when in drawing mode */}
          {isActivelyDrawing && (
            <div className="text-[10px] text-yellow-400 mb-2 p-1.5 bg-yellow-900/30 rounded">
              Finalize a criação para editar geometrias
            </div>
          )}

          {/* Selection summary */}
          <div className="text-[10px] text-gray-500 mb-2">
            {selectionAnalysis.isSinglePoint && '1 ponto selecionado'}
            {selectionAnalysis.isMultiplePoints && `${selectionAnalysis.count} pontos selecionados`}
            {selectionAnalysis.isSingleLine && '1 linha selecionada'}
            {selectionAnalysis.isSinglePolygon && '1 polígono selecionado'}
            {!selectionAnalysis.isSinglePoint && !selectionAnalysis.isMultiplePoints &&
             !selectionAnalysis.isSingleLine && !selectionAnalysis.isSinglePolygon &&
             `${selectionAnalysis.count} geometrias selecionadas`}
          </div>

          <div className={`space-y-2 ${isActivelyDrawing ? 'opacity-50 pointer-events-none' : ''}`}>
            {/* Edit button - only for single geometries */}
            {availableOperations.canEdit && (
              <button
                onClick={handleEdit}
                disabled={isActivelyDrawing}
                className="w-full px-2 py-2 bg-emerald-700 hover:bg-emerald-600 rounded text-xs flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                title={isActivelyDrawing ? 'Finalize a criação primeiro' : availableOperations.editDescription}
              >
                <span>✏️</span>
                <div className="text-left">
                  <div>{availableOperations.editLabel}</div>
                  {availableOperations.editDescription && (
                    <div className="text-[10px] text-emerald-200/70">{availableOperations.editDescription}</div>
                  )}
                </div>
              </button>
            )}

            {/* Transform operations in a grid */}
            <div className="grid grid-cols-3 gap-1">
              {availableOperations.canMove && (
                <button
                  onClick={handleMove}
                  disabled={isActivelyDrawing}
                  className="px-2 py-1.5 bg-gray-700 hover:bg-gray-600 rounded text-xs flex flex-col items-center gap-0.5 disabled:opacity-50 disabled:cursor-not-allowed"
                  title={isActivelyDrawing ? 'Finalize a criação primeiro' : availableOperations.moveDescription}
                >
                  <span>↔️</span>
                  <span className="text-[10px]">Mover</span>
                </button>
              )}
              {availableOperations.canRotate && (
                <button
                  onClick={handleRotate}
                  disabled={isActivelyDrawing}
                  className="px-2 py-1.5 bg-gray-700 hover:bg-gray-600 rounded text-xs flex flex-col items-center gap-0.5 disabled:opacity-50 disabled:cursor-not-allowed"
                  title={isActivelyDrawing ? 'Finalize a criação primeiro' : 'Rotacionar em torno do centroide'}
                >
                  <span>🔄</span>
                  <span className="text-[10px]">Rotacionar</span>
                </button>
              )}
              {availableOperations.canScale && (
                <button
                  onClick={handleScale}
                  disabled={isActivelyDrawing}
                  className="px-2 py-1.5 bg-gray-700 hover:bg-gray-600 rounded text-xs flex flex-col items-center gap-0.5 disabled:opacity-50 disabled:cursor-not-allowed"
                  title={isActivelyDrawing ? 'Finalize a criação primeiro' : 'Escalar a partir do centroide'}
                >
                  <span>⤢</span>
                  <span className="text-[10px]">Escalar</span>
                </button>
              )}
            </div>

            {/* Delete button - always available even during drawing */}
            {availableOperations.canDelete && (
              <button
                onClick={handleDelete}
                className="w-full px-2 py-1.5 bg-red-900/50 hover:bg-red-800/50 text-red-300 rounded text-xs flex items-center justify-center gap-1"
              >
                🗑️ Excluir {selectedFeatures.length > 1 ? `(${selectedFeatures.length})` : ''}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function MockLayersPanel() {
  const [layers] = useState([
    { id: 1, name: 'Lotes', visible: true, color: '#3b82f6' },
    { id: 2, name: 'Edificações', visible: true, color: '#22c55e' },
    { id: 3, name: 'Vias', visible: false, color: '#f59e0b' },
    { id: 4, name: 'Hidrografia', visible: false, color: '#06b6d4' },
  ]);

  return (
    <div className="h-full bg-gray-800 text-white p-3 overflow-auto">
      <div className="mb-3">
        <input
          type="text"
          placeholder="🔍 Buscar camada..."
          className="w-full px-2 py-1.5 bg-gray-700 border border-gray-600 rounded text-xs"
        />
      </div>
      <div className="space-y-1">
        {layers.map((layer) => (
          <div key={layer.id} className="flex items-center gap-2 p-2 bg-gray-700 rounded hover:bg-gray-600">
            <input type="checkbox" checked={layer.visible} readOnly className="w-3 h-3" />
            <div className="w-3 h-3 rounded" style={{ backgroundColor: layer.color }} />
            <span className="text-sm flex-1">{layer.name}</span>
            <button className="text-gray-400 hover:text-white text-xs">⚙️</button>
          </div>
        ))}
      </div>
      <button className="mt-3 w-full px-2 py-1.5 bg-emerald-600 hover:bg-emerald-500 rounded text-xs">
        + Adicionar Camada
      </button>
    </div>
  );
}

function MockAttributesPanel() {
  return (
    <div className="h-full bg-gray-800 text-white p-3 overflow-auto">
      <div className="text-xs text-gray-400 mb-3">Feature selecionada: Polígono #1</div>
      <div className="space-y-2">
        {[
          { key: 'id', value: '42' },
          { key: 'inscricao', value: '001.001.0042' },
          { key: 'area', value: '450.25' },
          { key: 'bairro', value: 'Centro' },
          { key: 'zona', value: 'Urbana' },
        ].map((attr) => (
          <div key={attr.key} className="flex gap-2">
            <label className="text-xs text-gray-400 w-20">{attr.key}</label>
            <input
              type="text"
              value={attr.value}
              readOnly
              className="flex-1 px-2 py-1 bg-gray-700 border border-gray-600 rounded text-xs"
            />
          </div>
        ))}
      </div>
      <button className="mt-3 w-full px-2 py-1.5 bg-blue-600 hover:bg-blue-500 rounded text-xs">
        💾 Salvar Alterações
      </button>
    </div>
  );
}

function MockAnalysisPanel() {
  return (
    <div className="h-full bg-gray-800 text-white p-3 overflow-auto">
      <div className="space-y-2">
        {[
          { name: 'Buffer', desc: 'Criar área de influência' },
          { name: 'Interseção', desc: 'Cruzar duas camadas' },
          { name: 'União', desc: 'Unir geometrias' },
          { name: 'Diferença', desc: 'Subtrair geometrias' },
        ].map((tool) => (
          <button key={tool.name} className="w-full p-2 bg-gray-700 hover:bg-gray-600 rounded text-left text-sm">
            <div className="font-medium">{tool.name}</div>
            <div className="text-xs text-gray-400">{tool.desc}</div>
          </button>
        ))}
      </div>
    </div>
  );
}

function MockHistoryPanel() {
  const history = [
    { id: 1, action: 'Criar polígono', time: '10:45', reverted: false },
    { id: 2, action: 'Mover polígono #1', time: '10:43', reverted: false },
    { id: 3, action: 'Editar vértices', time: '10:40', reverted: true },
    { id: 4, action: 'Criar ponto', time: '10:38', reverted: false },
  ];

  return (
    <div className="h-full bg-gray-800 text-white p-3 overflow-auto">
      <div className="space-y-1">
        {history.map((item) => (
          <div
            key={item.id}
            className={`flex items-center gap-2 p-2 rounded text-xs ${
              item.reverted ? 'bg-gray-700/50 text-gray-500 line-through' : 'bg-gray-700'
            }`}
          >
            <span className="flex-1">{item.action}</span>
            <span className="text-gray-500">{item.time}</span>
            <button className="text-gray-400 hover:text-white" title="Reverter">↩️</button>
          </div>
        ))}
      </div>
      <button className="mt-3 w-full px-2 py-1.5 bg-gray-700 hover:bg-gray-600 rounded text-xs">
        🗑️ Limpar Histórico
      </button>
    </div>
  );
}

function MockAttributeTable() {
  const data = [
    { id: 1, inscricao: '001.001.0001', area: 450.25, bairro: 'Centro' },
    { id: 2, inscricao: '001.001.0002', area: 320.10, bairro: 'Centro' },
    { id: 3, inscricao: '001.002.0001', area: 580.75, bairro: 'Jardim' },
    { id: 4, inscricao: '001.002.0002', area: 410.50, bairro: 'Jardim' },
    { id: 5, inscricao: '001.003.0001', area: 290.00, bairro: 'Industrial' },
  ];

  return (
    <div className="h-full bg-gray-800 text-white flex flex-col">
      <div className="flex items-center gap-2 px-3 py-2 border-b border-gray-700 bg-gray-800">
        <span className="text-xs text-gray-400">cadastro.lotes</span>
        <span className="text-xs bg-gray-700 px-1.5 py-0.5 rounded">{data.length}</span>
        <div className="flex-1" />
        <input type="text" placeholder="🔍 Filtrar..." className="px-2 py-1 bg-gray-700 border border-gray-600 rounded text-xs w-32" />
      </div>
      <div className="flex-1 overflow-auto">
        <table className="w-full text-xs">
          <thead className="bg-gray-700 sticky top-0">
            <tr>
              <th className="px-3 py-2 text-left text-gray-400 font-medium">ID</th>
              <th className="px-3 py-2 text-left text-gray-400 font-medium">Inscrição</th>
              <th className="px-3 py-2 text-left text-gray-400 font-medium">Área</th>
              <th className="px-3 py-2 text-left text-gray-400 font-medium">Bairro</th>
            </tr>
          </thead>
          <tbody>
            {data.map((row, i) => (
              <tr key={row.id} className={`border-b border-gray-700 hover:bg-gray-700 ${i === 0 ? 'bg-emerald-900/30' : ''}`}>
                <td className="px-3 py-2">{row.id}</td>
                <td className="px-3 py-2">{row.inscricao}</td>
                <td className="px-3 py-2">{row.area.toFixed(2)}</td>
                <td className="px-3 py-2">{row.bairro}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ============================================================================
// Tool Options Components
// ============================================================================

// Empty state when no tool is selected
function EmptyToolOptions() {
  return (
    <div className="h-full flex flex-col items-center justify-center text-center p-4">
      <div className="text-4xl mb-3 opacity-50">🔧</div>
      <h3 className="text-sm font-medium text-gray-400 mb-1">Nenhuma ferramenta selecionada</h3>
      <p className="text-xs text-gray-500">
        Selecione uma ferramenta no Ribbon para ver suas opções
      </p>
    </div>
  );
}

// Point creation options - bidirectional sync with map
function PointToolOptions() {
  const { drawingCoordinates, setDrawingCoordinates, clearDrawingCoordinates, features, finishDrawing, isDrawing, mode } = useEditorStore();
  const [srid, setSrid] = useState('4326');

  // Local state for text inputs (allows typing partial values)
  const [inputX, setInputX] = useState('');
  const [inputY, setInputY] = useState('');

  // Track which input has focus (to prevent store from overwriting user input)
  const [focusedInput, setFocusedInput] = useState<'x' | 'y' | null>(null);

  // Track the last coordinate we synced FROM the store (to detect external changes)
  const lastSyncedCoordRef = useRef<string | null>(null);

  // Get current coordinate from store
  const currentCoord = drawingCoordinates[0] || null;

  // Global keyboard listener for Enter when in point drawing mode
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      // Only handle Enter key when in point drawing mode and not focused on inputs
      if (e.key === 'Enter' && mode === 'draw-point' && isDrawing && focusedInput === null) {
        // Check if we have valid coordinates in the store
        if (currentCoord) {
          e.preventDefault();
          finishDrawing();
          // Clear local inputs
          setInputX('');
          setInputY('');
          lastSyncedCoordRef.current = null;
        }
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [mode, isDrawing, focusedInput, currentCoord, finishDrawing]);

  // Sync from store to inputs ONLY when:
  // 1. No input is focused (user is not typing)
  // 2. The coordinate actually changed from external source (map click)
  useEffect(() => {
    // Don't sync while user is typing in an input
    if (focusedInput !== null) {
      return;
    }

    if (currentCoord) {
      const coordKey = `${currentCoord[0]},${currentCoord[1]}`;
      // Only update if this is a NEW coordinate we didn't create ourselves
      if (lastSyncedCoordRef.current !== coordKey) {
        setInputX(currentCoord[0].toFixed(6));
        setInputY(currentCoord[1].toFixed(6));
        lastSyncedCoordRef.current = coordKey;
      }
    } else if (lastSyncedCoordRef.current !== null) {
      // No coordinate and we had one before - clear inputs
      setInputX('');
      setInputY('');
      lastSyncedCoordRef.current = null;
    }
  }, [currentCoord, focusedInput]);

  // Update store when user types valid coordinates
  const handleXChange = (value: string) => {
    setInputX(value);
    const x = parseFloat(value);
    const y = currentCoord ? currentCoord[1] : parseFloat(inputY);
    if (!isNaN(x) && !isNaN(y)) {
      setDrawingCoordinates([[x, y]]);
      // Mark this as our own update so useEffect won't overwrite
      lastSyncedCoordRef.current = `${x},${y}`;
    }
  };

  const handleYChange = (value: string) => {
    setInputY(value);
    const x = currentCoord ? currentCoord[0] : parseFloat(inputX);
    const y = parseFloat(value);
    if (!isNaN(x) && !isNaN(y)) {
      setDrawingCoordinates([[x, y]]);
      // Mark this as our own update so useEffect won't overwrite
      lastSyncedCoordRef.current = `${x},${y}`;
    }
  };

  // Create point when Enter is pressed
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      // Parse current input values to create a valid coordinate
      const x = parseFloat(inputX);
      const y = parseFloat(inputY);

      if (!isNaN(x) && !isNaN(y) && isDrawing) {
        // Ensure store has the latest coordinates from inputs
        setDrawingCoordinates([[x, y]]);

        // Small delay to ensure state is updated before finishing
        setTimeout(() => {
          finishDrawing();
          // Clear inputs for next point
          setInputX('');
          setInputY('');
          lastSyncedCoordRef.current = null;
        }, 0);
      }
    }
  };

  return (
    <div className="p-3 space-y-4">
      <div className="flex items-center gap-2 pb-2 border-b border-gray-700">
        <span className="text-lg">📍</span>
        <h3 className="text-sm font-medium text-white">Criar Ponto</h3>
        <span className="ml-auto text-xs text-gray-500">{features.features.length} criados</span>
      </div>

      {/* Coordinates - bidirectional sync */}
      <section>
        <h4 className="text-xs font-semibold text-gray-400 uppercase mb-2">Coordenadas</h4>
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <label className="text-xs text-gray-400 w-8">Lon:</label>
            <input
              type="text"
              value={inputX}
              onChange={(e) => handleXChange(e.target.value)}
              onKeyDown={handleKeyDown}
              onFocus={() => setFocusedInput('x')}
              onBlur={() => setFocusedInput(null)}
              placeholder="-49.254300"
              className="flex-1 px-2 py-1.5 bg-gray-700 border border-gray-600 rounded text-xs text-white font-mono focus:border-emerald-500 focus:outline-none"
            />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs text-gray-400 w-8">Lat:</label>
            <input
              type="text"
              value={inputY}
              onChange={(e) => handleYChange(e.target.value)}
              onKeyDown={handleKeyDown}
              onFocus={() => setFocusedInput('y')}
              onBlur={() => setFocusedInput(null)}
              placeholder="-16.686900"
              className="flex-1 px-2 py-1.5 bg-gray-700 border border-gray-600 rounded text-xs text-white font-mono focus:border-emerald-500 focus:outline-none"
            />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs text-gray-400 w-8">SRID:</label>
            <select
              value={srid}
              onChange={(e) => setSrid(e.target.value)}
              className="flex-1 px-2 py-1.5 bg-gray-700 border border-gray-600 rounded text-xs text-white focus:border-emerald-500 focus:outline-none"
            >
              <option value="4326">EPSG:4326 (WGS84)</option>
              <option value="31982">EPSG:31982 (SIRGAS 2000 / UTM 22S)</option>
              <option value="31983">EPSG:31983 (SIRGAS 2000 / UTM 23S)</option>
            </select>
          </div>
        </div>
      </section>

      {/* Status indicator */}
      {(() => {
        const x = parseFloat(inputX);
        const y = parseFloat(inputY);
        const hasValidCoords = !isNaN(x) && !isNaN(y);
        const hasInput = inputX !== '' || inputY !== '';

        if (hasValidCoords && isDrawing) {
          return (
            <div className="rounded p-2 bg-emerald-900/30 border border-emerald-700/50">
              <p className="text-xs text-emerald-300">
                Coordenadas válidas - pronto para criar
              </p>
            </div>
          );
        } else if (hasInput && !hasValidCoords) {
          return (
            <div className="rounded p-2 bg-yellow-900/30 border border-yellow-700/50">
              <p className="text-xs text-yellow-300">
                Coordenadas inválidas
              </p>
            </div>
          );
        } else {
          return (
            <div className="rounded p-2 bg-gray-800 border border-gray-700">
              <p className="text-xs text-gray-400">
                Clique no mapa ou digite as coordenadas
              </p>
            </div>
          );
        }
      })()}

      {/* Action Buttons */}
      <div className="flex gap-2">
        <button
          onClick={() => {
            clearDrawingCoordinates();
            setInputX('');
            setInputY('');
            lastSyncedCoordRef.current = null;
          }}
          className="flex-1 px-3 py-1.5 bg-gray-700 hover:bg-gray-600 border border-gray-600 rounded text-xs text-gray-300"
        >
          Cancelar
        </button>
        <button
          onClick={() => {
            const x = parseFloat(inputX);
            const y = parseFloat(inputY);
            if (!isNaN(x) && !isNaN(y) && isDrawing) {
              setDrawingCoordinates([[x, y]]);
              setTimeout(() => {
                finishDrawing();
                setInputX('');
                setInputY('');
                lastSyncedCoordRef.current = null;
              }, 0);
            }
          }}
          disabled={(() => {
            const x = parseFloat(inputX);
            const y = parseFloat(inputY);
            return isNaN(x) || isNaN(y) || !isDrawing;
          })()}
          className={`flex-1 px-3 py-1.5 rounded text-xs ${
            (() => {
              const x = parseFloat(inputX);
              const y = parseFloat(inputY);
              return !isNaN(x) && !isNaN(y) && isDrawing;
            })()
              ? 'bg-emerald-600 hover:bg-emerald-500 text-white'
              : 'bg-gray-700 text-gray-500 cursor-not-allowed'
          }`}
        >
          Finalizar
        </button>
      </div>
    </div>
  );
}

// ============================================================================
// ExtrudeToolOptions Component
// ============================================================================

function ExtrudeToolOptions() {
  const { features, selectedIndexes } = useEditorStore();

  // Get selected polygons
  const selectedPolygons = selectedIndexes
    .map(idx => ({ index: idx, feature: features.features[idx] }))
    .filter(item => item.feature?.geometry?.type === 'Polygon');

  const hasPolygonSelected = selectedPolygons.length > 0;

  return (
    <div className="p-3 space-y-4">
      <div className="flex items-center gap-2 pb-2 border-b border-gray-700">
        <span className="text-lg">↗️</span>
        <h3 className="text-sm font-medium text-white">Extrudar</h3>
      </div>

      {!hasPolygonSelected ? (
        <div className="text-center py-6">
          <div className="text-3xl mb-2 opacity-50">⬡</div>
          <p className="text-xs text-gray-400">Selecione um polígono para extrudar</p>
          <p className="text-xs text-gray-500 mt-1">
            Clique em um polígono no mapa para selecioná-lo
          </p>
        </div>
      ) : (
        <>
          <section>
            <h4 className="text-xs font-semibold text-gray-400 uppercase mb-2">
              Polígonos Selecionados ({selectedPolygons.length})
            </h4>
            <div className="space-y-1 max-h-32 overflow-y-auto">
              {selectedPolygons.map(({ index, feature }) => {
                const coords = (feature.geometry as any).coordinates?.[0] || [];
                const vertexCount = coords.length > 0 ? coords.length - 1 : 0;
                return (
                  <div key={index} className="flex items-center gap-2 p-2 bg-gray-700 rounded text-xs">
                    <span className="text-emerald-400">⬡</span>
                    <span className="text-gray-300">Polígono #{index + 1}</span>
                    <span className="ml-auto text-gray-500">{vertexCount} vértices</span>
                  </div>
                );
              })}
            </div>
          </section>

          <div className="bg-blue-900/30 border border-blue-700/50 rounded p-3">
            <h4 className="text-xs font-semibold text-blue-300 mb-2">Como usar:</h4>
            <ol className="text-xs text-blue-200 space-y-1 list-decimal list-inside">
              <li>Posicione o cursor sobre uma aresta do polígono</li>
              <li>Clique e arraste para extrudar a aresta</li>
              <li>Solte para confirmar a extrusão</li>
            </ol>
          </div>

          <div className="bg-amber-900/30 border border-amber-700/50 rounded p-2">
            <p className="text-xs text-amber-300">
              💡 A extrusão "puxa" a aresta selecionada, criando novos vértices e expandindo o polígono.
            </p>
          </div>
        </>
      )}
    </div>
  );
}

// ============================================================================
// ElevationToolOptions Component - 3D height editing
// ============================================================================

function ElevationToolOptions() {
  const { features, selectedIndexes } = useEditorStore();

  // Get selected features (any geometry type can have elevation)
  const selectedFeatures = selectedIndexes
    .map(idx => ({ index: idx, feature: features.features[idx] }))
    .filter(item => item.feature != null);

  const hasSelection = selectedFeatures.length > 0;

  // Get geometry type icon
  const getGeometryIcon = (type: string) => {
    switch (type) {
      case 'Point': return '📍';
      case 'LineString': return '📏';
      case 'Polygon': return '⬡';
      default: return '📐';
    }
  };

  return (
    <div className="p-3 space-y-4">
      <div className="flex items-center gap-2 pb-2 border-b border-gray-700">
        <span className="text-lg">⬆️</span>
        <h3 className="text-sm font-medium text-white">Elevação</h3>
      </div>

      {!hasSelection ? (
        <div className="text-center py-6">
          <div className="text-3xl mb-2 opacity-50">📐</div>
          <p className="text-xs text-gray-400">Selecione uma geometria para editar elevação</p>
          <p className="text-xs text-gray-500 mt-1">
            Clique em uma geometria no mapa para selecioná-la
          </p>
        </div>
      ) : (
        <>
          <section>
            <h4 className="text-xs font-semibold text-gray-400 uppercase mb-2">
              Geometrias Selecionadas ({selectedFeatures.length})
            </h4>
            <div className="space-y-1 max-h-32 overflow-y-auto">
              {selectedFeatures.map(({ index, feature }) => {
                const geomType = feature.geometry?.type || 'Unknown';
                return (
                  <div key={index} className="flex items-center gap-2 p-2 bg-gray-700 rounded text-xs">
                    <span className="text-emerald-400">{getGeometryIcon(geomType)}</span>
                    <span className="text-gray-300">{geomType} #{index + 1}</span>
                  </div>
                );
              })}
            </div>
          </section>

          <div className="bg-blue-900/30 border border-blue-700/50 rounded p-3">
            <h4 className="text-xs font-semibold text-blue-300 mb-2">Como usar:</h4>
            <ol className="text-xs text-blue-200 space-y-1 list-decimal list-inside">
              <li>Posicione o cursor sobre um vértice</li>
              <li>Clique e arraste <strong>verticalmente</strong></li>
              <li>Arraste para cima = aumenta elevação (Z)</li>
              <li>Arraste para baixo = diminui elevação (Z)</li>
            </ol>
          </div>

          <div className="bg-purple-900/30 border border-purple-700/50 rounded p-2">
            <p className="text-xs text-purple-300">
              🏔️ A elevação modifica a coordenada Z dos vértices.
            </p>
          </div>
        </>
      )}
    </div>
  );
}

// Geometry edit options - for editing a single selected geometry
function GeometryEditOptions() {
  const { features, selectedIndexes } = useEditorStore();
  const [srid, setSrid] = useState('4326');

  // Get the single selected feature
  const selectedIndex = selectedIndexes.length === 1 ? selectedIndexes[0] : -1;
  const selectedFeature = selectedIndex >= 0 ? features.features[selectedIndex] : null;

  // Get geometry type info
  const getGeometryIcon = (type: string) => {
    switch (type) {
      case 'Point': return '📍';
      case 'LineString': return '📏';
      case 'Polygon': return '⬡';
      default: return '📐';
    }
  };

  const getGeometryName = (type: string) => {
    switch (type) {
      case 'Point': return 'Ponto';
      case 'LineString': return 'Linha';
      case 'Polygon': return 'Polígono';
      default: return type;
    }
  };

  // For points, we can edit directly
  // For lines/polygons, we show a list of vertices
  if (!selectedFeature) {
    return (
      <div className="p-3 space-y-4">
        <div className="flex items-center gap-2 pb-2 border-b border-gray-700">
          <span className="text-lg">✏️</span>
          <h3 className="text-sm font-medium text-white">Editar Geometria</h3>
        </div>
        <div className="text-center py-8">
          <div className="text-3xl mb-2 opacity-50">⬚</div>
          <p className="text-xs text-gray-500">Nenhuma geometria selecionada</p>
          <p className="text-xs text-gray-600 mt-1">
            Selecione uma geometria para editar suas coordenadas
          </p>
        </div>
      </div>
    );
  }

  const geometry = selectedFeature.geometry as any; // Type assertion for flexibility
  const geometryType = geometry.type as string;

  // Point editing component
  if (geometryType === 'Point') {
    return <PointEditOptions feature={selectedFeature} featureIndex={selectedIndex} />;
  }

  // For LineString and Polygon, show vertex list
  let coordinates: number[][] = [];
  if (geometryType === 'Polygon' && geometry.coordinates?.[0]) {
    coordinates = geometry.coordinates[0].slice(0, -1); // Remove closing point
  } else if (geometryType === 'LineString' && geometry.coordinates) {
    coordinates = geometry.coordinates;
  }

  return (
    <div className="p-3 space-y-4">
      <div className="flex items-center gap-2 pb-2 border-b border-gray-700">
        <span className="text-lg">{getGeometryIcon(geometryType)}</span>
        <h3 className="text-sm font-medium text-white">Editar {getGeometryName(geometryType)}</h3>
        <span className="ml-auto text-xs text-gray-500">{coordinates.length} vértices</span>
      </div>

      {/* Vertex list */}
      <section>
        <h4 className="text-xs font-semibold text-gray-400 uppercase mb-2">Vértices</h4>
        <div className="space-y-1 max-h-64 overflow-auto">
          {coordinates.map((coord: number[], idx: number) => (
            <div key={idx} className="flex items-center gap-2 p-2 bg-gray-700 rounded text-xs">
              <span className="text-gray-500 w-6">{idx + 1}</span>
              <span className="font-mono text-gray-300 flex-1">
                {coord[0].toFixed(6)}, {coord[1].toFixed(6)}
              </span>
            </div>
          ))}
        </div>
      </section>

      {/* Info */}
      <div className="rounded p-2 bg-blue-900/30 border border-blue-700/50">
        <p className="text-xs text-blue-300">
          💡 Arraste os vértices no mapa para editar
        </p>
      </div>

      {/* SRID */}
      <section>
        <div className="flex items-center gap-2">
          <label className="text-xs text-gray-400 w-8">SRID:</label>
          <select
            value={srid}
            onChange={(e) => setSrid(e.target.value)}
            className="flex-1 px-2 py-1.5 bg-gray-700 border border-gray-600 rounded text-xs text-white focus:border-emerald-500 focus:outline-none"
          >
            <option value="4326">EPSG:4326 (WGS84)</option>
            <option value="31982">EPSG:31982 (SIRGAS 2000 / UTM 22S)</option>
            <option value="31983">EPSG:31983 (SIRGAS 2000 / UTM 23S)</option>
          </select>
        </div>
      </section>
    </div>
  );
}

// Point edit options - bidirectional sync for editing existing point
function PointEditOptions({ feature, featureIndex }: { feature: any; featureIndex: number }) {
  const { updateFeature, setMode } = useEditorStore();
  const [srid, setSrid] = useState('4326');

  // Get current coordinates from feature
  const coordinates = feature.geometry.coordinates as [number, number];

  // Local state for text inputs
  const [inputX, setInputX] = useState(coordinates[0].toFixed(6));
  const [inputY, setInputY] = useState(coordinates[1].toFixed(6));

  // Track which input has focus
  const [focusedInput, setFocusedInput] = useState<'x' | 'y' | null>(null);

  // Track the last coordinate we synced FROM the feature
  const lastSyncedCoordRef = useRef<string>(`${coordinates[0]},${coordinates[1]}`);

  // Sync from feature to inputs when feature changes externally (e.g., drag on map)
  useEffect(() => {
    if (focusedInput !== null) return;

    const coordKey = `${coordinates[0]},${coordinates[1]}`;
    if (lastSyncedCoordRef.current !== coordKey) {
      setInputX(coordinates[0].toFixed(6));
      setInputY(coordinates[1].toFixed(6));
      lastSyncedCoordRef.current = coordKey;
    }
  }, [coordinates, focusedInput]);

  // Global keyboard listener for Enter to finish editing
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Enter' && focusedInput === null) {
        e.preventDefault();
        // Exit edit mode
        setMode('view');
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [focusedInput, setMode]);

  // Handle Enter in input fields
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      // Save current values and exit edit mode
      const x = parseFloat(inputX);
      const y = parseFloat(inputY);
      if (!isNaN(x) && !isNaN(y)) {
        const updatedFeature = {
          ...feature,
          geometry: {
            ...feature.geometry,
            coordinates: [x, y],
          },
        };
        updateFeature(featureIndex, updatedFeature);
      }
      // Exit edit mode
      setMode('view');
    }
  };

  // Update feature when user types valid coordinates
  const handleXChange = (value: string) => {
    setInputX(value);
    const x = parseFloat(value);
    const y = parseFloat(inputY);
    if (!isNaN(x) && !isNaN(y)) {
      const updatedFeature = {
        ...feature,
        geometry: {
          ...feature.geometry,
          coordinates: [x, y],
        },
      };
      updateFeature(featureIndex, updatedFeature);
      lastSyncedCoordRef.current = `${x},${y}`;
    }
  };

  const handleYChange = (value: string) => {
    setInputY(value);
    const x = parseFloat(inputX);
    const y = parseFloat(value);
    if (!isNaN(x) && !isNaN(y)) {
      const updatedFeature = {
        ...feature,
        geometry: {
          ...feature.geometry,
          coordinates: [x, y],
        },
      };
      updateFeature(featureIndex, updatedFeature);
      lastSyncedCoordRef.current = `${x},${y}`;
    }
  };

  return (
    <div className="p-3 space-y-4">
      <div className="flex items-center gap-2 pb-2 border-b border-gray-700">
        <span className="text-lg">📍</span>
        <h3 className="text-sm font-medium text-white">Editar Ponto</h3>
        <span className="ml-auto text-xs text-gray-500">#{featureIndex + 1}</span>
      </div>

      {/* Coordinates - bidirectional sync */}
      <section>
        <h4 className="text-xs font-semibold text-gray-400 uppercase mb-2">Coordenadas</h4>
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <label className="text-xs text-gray-400 w-8">Lon:</label>
            <input
              type="text"
              value={inputX}
              onChange={(e) => handleXChange(e.target.value)}
              onKeyDown={handleKeyDown}
              onFocus={() => setFocusedInput('x')}
              onBlur={() => setFocusedInput(null)}
              className="flex-1 px-2 py-1.5 bg-gray-700 border border-gray-600 rounded text-xs text-white font-mono focus:border-emerald-500 focus:outline-none"
            />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs text-gray-400 w-8">Lat:</label>
            <input
              type="text"
              value={inputY}
              onChange={(e) => handleYChange(e.target.value)}
              onKeyDown={handleKeyDown}
              onFocus={() => setFocusedInput('y')}
              onBlur={() => setFocusedInput(null)}
              className="flex-1 px-2 py-1.5 bg-gray-700 border border-gray-600 rounded text-xs text-white font-mono focus:border-emerald-500 focus:outline-none"
            />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs text-gray-400 w-8">SRID:</label>
            <select
              value={srid}
              onChange={(e) => setSrid(e.target.value)}
              className="flex-1 px-2 py-1.5 bg-gray-700 border border-gray-600 rounded text-xs text-white focus:border-emerald-500 focus:outline-none"
            >
              <option value="4326">EPSG:4326 (WGS84)</option>
              <option value="31982">EPSG:31982 (SIRGAS 2000 / UTM 22S)</option>
              <option value="31983">EPSG:31983 (SIRGAS 2000 / UTM 23S)</option>
            </select>
          </div>
        </div>
      </section>

      {/* Info */}
      <div className="rounded p-2 bg-emerald-900/30 border border-emerald-700/50">
        <p className="text-xs text-emerald-300">
          ↵ Enter para finalizar • Edite ou arraste no mapa
        </p>
      </div>

      {/* Feature info */}
      <section>
        <h4 className="text-xs font-semibold text-gray-400 uppercase mb-2">Informações</h4>
        <div className="text-xs text-gray-400 space-y-1">
          <div className="flex justify-between">
            <span>Criado:</span>
            <span className="text-gray-300">
              {feature.properties?.createdAt
                ? new Date(feature.properties.createdAt).toLocaleString('pt-BR')
                : '-'}
            </span>
          </div>
          <div className="flex justify-between">
            <span>Modificado:</span>
            <span className="text-gray-300">
              {feature.properties?.updatedAt
                ? new Date(feature.properties.updatedAt).toLocaleString('pt-BR')
                : '-'}
            </span>
          </div>
        </div>
      </section>
    </div>
  );
}

// Rectangle creation options
function RectangleToolOptions() {
  const {
    drawingCoordinates,
    updateDrawingCoordinate,
    setDrawingCoordinates,
    clearDrawingCoordinates,
    finishDrawing,
    isDrawing,
    mode,
    features
  } = useEditorStore();

  const [inputCorner1X, setInputCorner1X] = useState('');
  const [inputCorner1Y, setInputCorner1Y] = useState('');
  const [inputCorner2X, setInputCorner2X] = useState('');
  const [inputCorner2Y, setInputCorner2Y] = useState('');
  const [inputWidth, setInputWidth] = useState('');
  const [inputHeight, setInputHeight] = useState('');
  const [focusedField, setFocusedField] = useState<string | null>(null);

  const corner1 = drawingCoordinates[0] || null;
  const corner2 = drawingCoordinates[1] || null;

  // Calculate dimensions in meters
  const dimensions = useMemo(() => {
    if (!corner1 || !corner2) return null;
    const avgLat = (corner1[1] + corner2[1]) / 2;
    const width = (corner2[0] - corner1[0]) * 111320 * Math.cos(avgLat * Math.PI / 180);
    const height = (corner2[1] - corner1[1]) * 110540;
    return { width, height };
  }, [corner1, corner2]);

  // Sync coordinate inputs from store
  useEffect(() => {
    if (focusedField === 'corner1x' || focusedField === 'corner1y') return;
    if (corner1) {
      setInputCorner1X(corner1[0].toFixed(6));
      setInputCorner1Y(corner1[1].toFixed(6));
    } else {
      setInputCorner1X('');
      setInputCorner1Y('');
    }
  }, [corner1, focusedField]);

  useEffect(() => {
    if (focusedField === 'corner2x' || focusedField === 'corner2y') return;
    if (corner2) {
      setInputCorner2X(corner2[0].toFixed(6));
      setInputCorner2Y(corner2[1].toFixed(6));
    } else {
      setInputCorner2X('');
      setInputCorner2Y('');
    }
  }, [corner2, focusedField]);

  // Sync dimension inputs from calculated values
  useEffect(() => {
    if (focusedField === 'width' || focusedField === 'height') return;
    if (dimensions) {
      setInputWidth(Math.abs(dimensions.width).toFixed(2));
      setInputHeight(Math.abs(dimensions.height).toFixed(2));
    } else {
      setInputWidth('');
      setInputHeight('');
    }
  }, [dimensions, focusedField]);

  // Global keyboard listener
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (mode !== 'draw-rectangle' && mode !== 'draw-square') return;
      if (e.target instanceof HTMLInputElement) return;

      if (e.key === 'Enter' && isDrawing && drawingCoordinates.length >= 2) {
        e.preventDefault();
        finishDrawing();
      }

      if (e.key === 'Escape') {
        e.preventDefault();
        clearDrawingCoordinates();
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [mode, isDrawing, drawingCoordinates.length, finishDrawing, clearDrawingCoordinates]);

  const handleCorner1Change = (axis: 'x' | 'y', value: string) => {
    if (axis === 'x') setInputCorner1X(value);
    else setInputCorner1Y(value);

    const x = axis === 'x' ? parseFloat(value) : parseFloat(inputCorner1X);
    const y = axis === 'y' ? parseFloat(value) : parseFloat(inputCorner1Y);

    if (!isNaN(x) && !isNaN(y)) {
      updateDrawingCoordinate(0, [x, y]);
    }
  };

  const handleCorner2Change = (axis: 'x' | 'y', value: string) => {
    if (axis === 'x') setInputCorner2X(value);
    else setInputCorner2Y(value);

    const x = axis === 'x' ? parseFloat(value) : parseFloat(inputCorner2X);
    const y = axis === 'y' ? parseFloat(value) : parseFloat(inputCorner2Y);

    if (!isNaN(x) && !isNaN(y) && drawingCoordinates.length >= 2) {
      updateDrawingCoordinate(1, [x, y]);
    }
  };

  const isSquare = mode === 'draw-square';

  // Handle dimension changes - recalculate corner 2 based on corner 1 + dimensions
  const handleWidthChange = (value: string) => {
    setInputWidth(value);
    if (!corner1) return;

    const widthMeters = parseFloat(value);
    if (isNaN(widthMeters)) return;

    // For square, sync height with width
    if (isSquare) {
      setInputHeight(value);
    }

    // Convert meters to longitude degrees
    // 1 degree longitude ≈ 111320 * cos(latitude) meters
    const lonDelta = widthMeters / (111320 * Math.cos(corner1[1] * Math.PI / 180));
    const newCorner2X = corner1[0] + lonDelta;

    // For square, height = width
    const heightMeters = isSquare ? widthMeters : (corner2 ? Math.abs(corner2[1] - corner1[1]) * 110540 : 0);
    const latDelta = heightMeters / 110540;
    const newCorner2Y = isSquare ? corner1[1] + latDelta : (corner2 ? corner2[1] : corner1[1]);

    if (drawingCoordinates.length >= 2) {
      updateDrawingCoordinate(1, [newCorner2X, newCorner2Y]);
    } else {
      setDrawingCoordinates([corner1, [newCorner2X, newCorner2Y]]);
    }
  };

  const handleHeightChange = (value: string) => {
    setInputHeight(value);
    if (!corner1) return;

    const heightMeters = parseFloat(value);
    if (isNaN(heightMeters)) return;

    // For square, sync width with height
    if (isSquare) {
      setInputWidth(value);
    }

    // Convert meters to latitude degrees
    // 1 degree latitude ≈ 110540 meters
    const latDelta = heightMeters / 110540;
    const newCorner2Y = corner1[1] + latDelta;

    // For square, width = height
    const widthMeters = isSquare ? heightMeters : (corner2 ? Math.abs(corner2[0] - corner1[0]) * 111320 * Math.cos(corner1[1] * Math.PI / 180) : 0);
    const lonDelta = widthMeters / (111320 * Math.cos(corner1[1] * Math.PI / 180));
    const newCorner2X = isSquare ? corner1[0] + lonDelta : (corner2 ? corner2[0] : corner1[0]);

    if (drawingCoordinates.length >= 2) {
      updateDrawingCoordinate(1, [newCorner2X, newCorner2Y]);
    } else {
      setDrawingCoordinates([corner1, [newCorner2X, newCorner2Y]]);
    }
  };

  // For square mode, handle single "Lado" (side) change
  const handleSideChange = (value: string) => {
    setInputWidth(value);
    setInputHeight(value);
    if (!corner1) return;

    const sideMeters = parseFloat(value);
    if (isNaN(sideMeters)) return;

    const lonDelta = sideMeters / (111320 * Math.cos(corner1[1] * Math.PI / 180));
    const latDelta = sideMeters / 110540;
    const newCorner2X = corner1[0] + lonDelta;
    const newCorner2Y = corner1[1] + latDelta;

    if (drawingCoordinates.length >= 2) {
      updateDrawingCoordinate(1, [newCorner2X, newCorner2Y]);
    } else {
      setDrawingCoordinates([corner1, [newCorner2X, newCorner2Y]]);
    }
  };

  const handleFinish = () => {
    if (drawingCoordinates.length >= 2) {
      finishDrawing();
    }
  };

  const handleCancel = () => {
    clearDrawingCoordinates();
  };

  const canFinish = drawingCoordinates.length >= 2;

  return (
    <div className="p-3 space-y-4">
      <div className="flex items-center gap-2 pb-2 border-b border-gray-700">
        <span className="text-lg">{isSquare ? '⬜' : '▭'}</span>
        <h3 className="text-sm font-medium text-white">
          {isSquare ? 'Criar Quadrado' : 'Criar Retângulo'}
        </h3>
        <span className="ml-auto text-xs text-gray-500">{features.features.length} criados</span>
      </div>

      <div className="rounded p-2 bg-blue-900/30 border border-blue-700/50">
        <p className="text-xs text-blue-300">
          {!corner1
            ? '1. Clique no mapa para definir o primeiro canto'
            : !corner2
              ? '2. Clique no mapa ou defina dimensões'
              : 'Pronto! Enter para finalizar'}
        </p>
      </div>

      {/* Corner 1 */}
      <section>
        <h4 className="text-xs font-semibold text-gray-400 uppercase mb-2">Canto 1</h4>
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <label className="text-xs text-gray-400 w-8">Lon:</label>
            <input
              type="text"
              value={inputCorner1X}
              onChange={(e) => handleCorner1Change('x', e.target.value)}
              onFocus={() => setFocusedField('corner1x')}
              onBlur={() => setFocusedField(null)}
              placeholder="-49.254300"
              className="flex-1 px-2 py-1.5 bg-gray-700 border border-gray-600 rounded text-xs text-white font-mono focus:border-blue-500 focus:outline-none"
            />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs text-gray-400 w-8">Lat:</label>
            <input
              type="text"
              value={inputCorner1Y}
              onChange={(e) => handleCorner1Change('y', e.target.value)}
              onFocus={() => setFocusedField('corner1y')}
              onBlur={() => setFocusedField(null)}
              placeholder="-16.686900"
              className="flex-1 px-2 py-1.5 bg-gray-700 border border-gray-600 rounded text-xs text-white font-mono focus:border-blue-500 focus:outline-none"
            />
          </div>
        </div>
      </section>

      {/* Dimensions - editable, updates corner 2 */}
      <section>
        <h4 className="text-xs font-semibold text-gray-400 uppercase mb-2">
          {isSquare ? 'Dimensão' : 'Dimensões'}
        </h4>
        <div className="space-y-2">
          {isSquare ? (
            /* Square: single "Lado" field */
            <div className="flex items-center gap-2">
              <label className="text-xs text-gray-400 w-16">Lado:</label>
              <input
                type="text"
                value={inputWidth}
                onChange={(e) => handleSideChange(e.target.value)}
                onFocus={() => setFocusedField('width')}
                onBlur={() => setFocusedField(null)}
                placeholder="100.00"
                disabled={!corner1}
                className="flex-1 px-2 py-1.5 bg-gray-700 border border-gray-600 rounded text-xs text-white font-mono focus:border-blue-500 focus:outline-none disabled:opacity-50"
              />
              <span className="text-xs text-gray-500">m</span>
            </div>
          ) : (
            /* Rectangle: separate width/height fields */
            <div className="flex items-center gap-2">
              <label className="text-xs text-gray-400 w-16">Largura:</label>
              <input
                type="text"
                value={inputWidth}
                onChange={(e) => handleWidthChange(e.target.value)}
                onFocus={() => setFocusedField('width')}
                onBlur={() => setFocusedField(null)}
                placeholder="100.00"
                disabled={!corner1}
                className="flex-1 px-2 py-1.5 bg-gray-700 border border-gray-600 rounded text-xs text-white font-mono focus:border-blue-500 focus:outline-none disabled:opacity-50"
              />
              <span className="text-xs text-gray-500">m</span>
            </div>
          )}
          {/* Height field only for rectangle */}
          {!isSquare && (
            <div className="flex items-center gap-2">
              <label className="text-xs text-gray-400 w-16">Altura:</label>
              <input
                type="text"
                value={inputHeight}
                onChange={(e) => handleHeightChange(e.target.value)}
                onFocus={() => setFocusedField('height')}
                onBlur={() => setFocusedField(null)}
                placeholder="50.00"
                disabled={!corner1}
                className="flex-1 px-2 py-1.5 bg-gray-700 border border-gray-600 rounded text-xs text-white font-mono focus:border-blue-500 focus:outline-none disabled:opacity-50"
              />
              <span className="text-xs text-gray-500">m</span>
            </div>
          )}
        </div>
      </section>

      {/* Corner 2 - calculated or manual */}
      <section>
        <h4 className="text-xs font-semibold text-gray-400 uppercase mb-2">Canto 2 (oposto)</h4>
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <label className="text-xs text-gray-400 w-8">Lon:</label>
            <input
              type="text"
              value={inputCorner2X}
              onChange={(e) => handleCorner2Change('x', e.target.value)}
              onFocus={() => setFocusedField('corner2x')}
              onBlur={() => setFocusedField(null)}
              placeholder="-49.253300"
              disabled={!corner1}
              className="flex-1 px-2 py-1.5 bg-gray-700 border border-gray-600 rounded text-xs text-white font-mono focus:border-blue-500 focus:outline-none disabled:opacity-50"
            />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs text-gray-400 w-8">Lat:</label>
            <input
              type="text"
              value={inputCorner2Y}
              onChange={(e) => handleCorner2Change('y', e.target.value)}
              onFocus={() => setFocusedField('corner2y')}
              onBlur={() => setFocusedField(null)}
              placeholder="-16.685900"
              disabled={!corner1}
              className="flex-1 px-2 py-1.5 bg-gray-700 border border-gray-600 rounded text-xs text-white font-mono focus:border-blue-500 focus:outline-none disabled:opacity-50"
            />
          </div>
        </div>
      </section>

      {/* Status */}
      <div className={`rounded p-2 ${
        canFinish
          ? 'bg-emerald-900/30 border border-emerald-700/50'
          : 'bg-gray-800 border border-gray-700'
      }`}>
        <p className={`text-xs ${canFinish ? 'text-emerald-300' : 'text-gray-400'}`}>
          {canFinish
            ? 'Retângulo definido - pronto para finalizar'
            : 'Defina os dois cantos ou use dimensões'
          }
        </p>
      </div>

      {/* Action Buttons */}
      <div className="flex gap-2">
        <button
          onClick={handleCancel}
          className="flex-1 px-3 py-1.5 bg-gray-700 hover:bg-gray-600 border border-gray-600 rounded text-xs text-gray-300"
        >
          Cancelar
        </button>
        <button
          onClick={handleFinish}
          disabled={!canFinish}
          className={`flex-1 px-3 py-1.5 rounded text-xs ${
            canFinish
              ? 'bg-emerald-600 hover:bg-emerald-500 text-white'
              : 'bg-gray-700 text-gray-500 cursor-not-allowed'
          }`}
        >
          Finalizar
        </button>
      </div>
    </div>
  );
}

// ============================================================================
// Rectangle3PtsToolOptions Component (3-point rotated rectangle)
// ============================================================================

function Rectangle3PtsToolOptions() {
  const {
    drawingCoordinates,
    updateDrawingCoordinate,
    clearDrawingCoordinates,
    finishDrawing,
    isDrawing,
    mode,
    features,
    activeVertexIndex,
    setActiveVertexIndex
  } = useEditorStore();

  // Global keyboard listener
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (mode !== 'draw-rectangle-3pts') return;
      if (e.target instanceof HTMLInputElement) return;

      if (e.key === 'Enter' && isDrawing && drawingCoordinates.length >= 3) {
        e.preventDefault();
        finishDrawing();
      }

      if (e.key === 'Escape') {
        e.preventDefault();
        clearDrawingCoordinates();
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [mode, isDrawing, drawingCoordinates.length, finishDrawing, clearDrawingCoordinates]);

  const handleSelectVertex = (index: number) => {
    if (activeVertexIndex === index) {
      setActiveVertexIndex(null);
    } else {
      setActiveVertexIndex(index);
    }
  };

  const handleRemoveVertex = (index: number) => {
    const { removeDrawingCoordinate } = useEditorStore.getState();
    removeDrawingCoordinate(index);
    if (activeVertexIndex === index) {
      setActiveVertexIndex(null);
    } else if (activeVertexIndex !== null && activeVertexIndex > index) {
      setActiveVertexIndex(activeVertexIndex - 1);
    }
  };

  // Calculate dimensions from 3 points
  const dimensions = useMemo(() => {
    if (drawingCoordinates.length < 2) return null;

    const [x1, y1] = drawingCoordinates[0];
    const [x2, y2] = drawingCoordinates[1];

    // Base width (distance from p1 to p2)
    const avgLat = (y1 + y2) / 2;
    const dxMeters = (x2 - x1) * 111320 * Math.cos(avgLat * Math.PI / 180);
    const dyMeters = (y2 - y1) * 110540;
    const baseWidth = Math.sqrt(dxMeters * dxMeters + dyMeters * dyMeters);

    // Calculate angle of the base edge
    const angle = Math.atan2(y2 - y1, x2 - x1) * 180 / Math.PI;

    let height = 0;
    if (drawingCoordinates.length >= 3) {
      const [x3, y3] = drawingCoordinates[2];
      // Project p3 onto line p1-p2 to get perpendicular distance (height)
      const dx = x2 - x1;
      const dy = y2 - y1;
      const len2 = dx * dx + dy * dy;
      if (len2 > 0) {
        const t = ((x3 - x1) * dx + (y3 - y1) * dy) / len2;
        const projX = x1 + t * dx;
        const projY = y1 + t * dy;
        const perpDxMeters = (x3 - projX) * 111320 * Math.cos(y3 * Math.PI / 180);
        const perpDyMeters = (y3 - projY) * 110540;
        height = Math.sqrt(perpDxMeters * perpDxMeters + perpDyMeters * perpDyMeters);
      }
    }

    return { width: baseWidth, height, angle };
  }, [drawingCoordinates]);

  const handleFinish = () => {
    if (drawingCoordinates.length >= 3) {
      finishDrawing();
    }
  };

  const handleCancel = () => {
    clearDrawingCoordinates();
  };

  const canFinish = drawingCoordinates.length >= 3;

  return (
    <div className="p-3 space-y-4">
      <div className="flex items-center gap-2 pb-2 border-b border-gray-700">
        <span className="text-lg">⊟</span>
        <h3 className="text-sm font-medium text-white">Retângulo 3 Pontos</h3>
        <span className="ml-auto text-xs text-gray-500">{features.features.length} criados</span>
      </div>

      <div className="rounded p-2 bg-blue-900/30 border border-blue-700/50">
        <p className="text-xs text-blue-300">
          {drawingCoordinates.length === 0
            ? '1. Clique no mapa: primeiro ponto da base'
            : drawingCoordinates.length === 1
              ? '2. Clique no mapa: segundo ponto da base (largura)'
              : drawingCoordinates.length === 2
                ? '3. Clique no mapa: define a altura'
                : 'Pronto! Enter para finalizar'}
        </p>
      </div>

      {/* Vertex List */}
      <section>
        <div className="flex items-center justify-between mb-2">
          <h4 className="text-xs font-semibold text-gray-400 uppercase">
            Pontos ({drawingCoordinates.length}/3)
          </h4>
          <span className="text-xs text-gray-500">Lon / Lat</span>
        </div>
        <div className="space-y-1 max-h-48 overflow-y-auto">
          {drawingCoordinates.map((coord, index) => (
            <VertexRow
              key={index}
              index={index}
              coord={coord}
              isSelected={activeVertexIndex === index}
              onUpdate={updateDrawingCoordinate}
              onRemove={handleRemoveVertex}
              onSelect={handleSelectVertex}
            />
          ))}

          {drawingCoordinates.length < 3 && (
            <div className="text-xs text-gray-500 italic py-2">
              {drawingCoordinates.length === 0 && 'Clique no mapa para adicionar o primeiro ponto'}
              {drawingCoordinates.length === 1 && 'Clique para definir a largura da base'}
              {drawingCoordinates.length === 2 && 'Clique para definir a altura'}
            </div>
          )}
        </div>
      </section>

      {/* Dimensions */}
      {dimensions && (
        <section>
          <h4 className="text-xs font-semibold text-gray-400 uppercase mb-2">Dimensões</h4>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="p-2 bg-gray-700/50 rounded">
              <span className="text-gray-400">Largura:</span>
              <span className="text-white ml-1">{dimensions.width.toFixed(2)} m</span>
            </div>
            <div className="p-2 bg-gray-700/50 rounded">
              <span className="text-gray-400">Altura:</span>
              <span className="text-white ml-1">{dimensions.height.toFixed(2)} m</span>
            </div>
            <div className="p-2 bg-gray-700/50 rounded col-span-2">
              <span className="text-gray-400">Ângulo:</span>
              <span className="text-white ml-1">{dimensions.angle.toFixed(1)}°</span>
            </div>
          </div>
        </section>
      )}

      {/* Status */}
      <div className={`rounded p-2 ${
        canFinish
          ? 'bg-emerald-900/30 border border-emerald-700/50'
          : 'bg-gray-800 border border-gray-700'
      }`}>
        <p className={`text-xs ${canFinish ? 'text-emerald-300' : 'text-gray-400'}`}>
          {canFinish
            ? 'Retângulo definido - pronto para finalizar'
            : `${drawingCoordinates.length}/3 pontos - mínimo 3 para finalizar`
          }
        </p>
      </div>

      {/* Action Buttons */}
      <div className="flex gap-2">
        <button
          onClick={handleCancel}
          className="flex-1 px-3 py-1.5 bg-gray-700 hover:bg-gray-600 border border-gray-600 rounded text-xs text-gray-300"
        >
          Cancelar
        </button>
        <button
          onClick={handleFinish}
          disabled={!canFinish}
          className={`flex-1 px-3 py-1.5 rounded text-xs ${
            canFinish
              ? 'bg-emerald-600 hover:bg-emerald-500 text-white'
              : 'bg-gray-700 text-gray-500 cursor-not-allowed'
          }`}
        >
          Finalizar
        </button>
      </div>
    </div>
  );
}

// Dedicated Snap Panel
function SnapPanel() {
  const {
    snapEnabled,
    toggleSnap,
    snapMode,
    setSnapMode,
    snapPixels,
    setSnapPixels,
    snapGuidesEnabled,
    toggleSnapGuides,
    snapReferenceFeatures,
    clearSnapReferences,
    features,
  } = useEditorStore();

  const refCount = snapReferenceFeatures.length;
  const featureCount = features.features.length;

  return (
    <div className="h-full overflow-y-auto bg-gray-900">
      <div className="p-3 space-y-4">
        {/* Enable toggle */}
        <label className="flex items-center gap-3 p-2 bg-gray-800 rounded cursor-pointer hover:bg-gray-700">
          <input
            type="checkbox"
            checked={snapEnabled}
            onChange={toggleSnap}
            className="w-4 h-4 rounded bg-gray-700 border-gray-600 text-emerald-500 focus:ring-emerald-500"
          />
          <div>
            <div className="text-sm text-white">Snap habilitado</div>
            <div className="text-xs text-gray-500">Atalho: S</div>
          </div>
        </label>

        {/* Snap mode */}
        <section>
          <h4 className="text-xs font-semibold text-gray-400 uppercase mb-2">Modo de Snap</h4>
          <div className="space-y-1">
            {[
              { key: 'vertex', label: 'Vértices', icon: '◆', desc: 'Snap para pontos' },
              { key: 'edge', label: 'Arestas', icon: '─', desc: 'Snap para linhas' },
              { key: 'both', label: 'Ambos', icon: '◈', desc: 'Vértices + Arestas' },
            ].map((option) => (
              <label
                key={option.key}
                className={`flex items-center gap-2 p-2 rounded cursor-pointer transition-colors ${
                  snapMode === option.key
                    ? 'bg-emerald-900/50 border border-emerald-600'
                    : 'bg-gray-800 hover:bg-gray-700'
                }`}
              >
                <input
                  type="radio"
                  name="snapModePanel"
                  checked={snapMode === option.key}
                  onChange={() => setSnapMode(option.key as 'vertex' | 'edge' | 'both')}
                  disabled={!snapEnabled}
                  className="w-3.5 h-3.5 bg-gray-700 border-gray-600 text-emerald-500 focus:ring-emerald-500 disabled:opacity-50"
                />
                <span className="text-gray-400 w-4 text-center">{option.icon}</span>
                <div className="flex-1">
                  <span className={`text-xs ${snapEnabled ? 'text-gray-300' : 'text-gray-500'}`}>
                    {option.label}
                  </span>
                  <span className={`text-xs ml-2 ${snapEnabled ? 'text-gray-500' : 'text-gray-600'}`}>
                    - {option.desc}
                  </span>
                </div>
              </label>
            ))}
          </div>
        </section>

        {/* Snap guides toggle */}
        <section>
          <h4 className="text-xs font-semibold text-gray-400 uppercase mb-2">Guias Ortogonais</h4>
          <label className="flex items-center gap-3 p-2 bg-gray-800 rounded cursor-pointer hover:bg-gray-700">
            <input
              type="checkbox"
              checked={snapGuidesEnabled}
              onChange={toggleSnapGuides}
              disabled={!snapEnabled}
              className="w-4 h-4 rounded bg-gray-700 border-gray-600 text-emerald-500 focus:ring-emerald-500 disabled:opacity-50"
            />
            <div>
              <div className={`text-sm ${snapEnabled ? 'text-white' : 'text-gray-500'}`}>
                Guias durante desenho
              </div>
              <div className="text-xs text-gray-500">Linhas H/V automáticas</div>
            </div>
          </label>
        </section>

        {/* Tolerance */}
        <section>
          <h4 className="text-xs font-semibold text-gray-400 uppercase mb-2">Tolerância</h4>
          <div className="bg-gray-800 rounded p-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-gray-400">Distância</span>
              <span className="text-xs text-white font-mono">{snapPixels} px</span>
            </div>
            <input
              type="range"
              min="1"
              max="50"
              value={snapPixels}
              onChange={(e) => setSnapPixels(Number(e.target.value))}
              disabled={!snapEnabled}
              className="w-full h-1.5 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-emerald-500 disabled:opacity-50"
            />
            <div className="flex justify-between text-[10px] text-gray-500 mt-1">
              <span>1px</span>
              <span>50px</span>
            </div>
          </div>
        </section>

        {/* Reference features info */}
        <section>
          <h4 className="text-xs font-semibold text-gray-400 uppercase mb-2">Referências</h4>
          <div className="bg-gray-800 rounded p-3 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-400">Features de referência:</span>
              <span className="text-xs text-cyan-400 font-mono">{refCount}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-400">Features desenhadas:</span>
              <span className="text-xs text-blue-400 font-mono">{featureCount}</span>
            </div>
            {refCount > 0 && (
              <button
                onClick={clearSnapReferences}
                className="w-full py-1.5 px-3 text-xs bg-red-900/50 hover:bg-red-900/70 text-red-300 rounded border border-red-700/50"
              >
                Limpar Referências
              </button>
            )}
          </div>
        </section>

        {/* Legend */}
        <section>
          <h4 className="text-xs font-semibold text-gray-400 uppercase mb-2">Legenda</h4>
          <div className="bg-gray-800 rounded p-2 space-y-1.5 text-xs">
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-green-500"></span>
              <span className="text-gray-300">Snap em vértice</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-orange-400"></span>
              <span className="text-gray-300">Snap em aresta</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-cyan-400"></span>
              <span className="text-gray-300">Snap em guia</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-yellow-400"></span>
              <span className="text-gray-300">Interseção de guias</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-fuchsia-400/50"></span>
              <span className="text-gray-300">Vértices disponíveis</span>
            </div>
          </div>
        </section>

        {/* Instructions */}
        <div className="bg-blue-900/30 border border-blue-700/50 rounded p-2">
          <p className="text-xs text-blue-300 leading-relaxed">
            💡 Durante o desenho, mova o cursor próximo a vértices/arestas para ver o snap.
            O indicador pulsa quando o snap está ativo.
          </p>
        </div>
      </div>
    </div>
  );
}

// Buffer tool options
function BufferToolOptions({ onApply }: { onApply?: () => void }) {
  const [distance, setDistance] = useState('100');
  const [unit, setUnit] = useState('meters');
  const [segments, setSegments] = useState('8');
  const [dissolve, setDissolve] = useState(true);
  const [keepOriginal, setKeepOriginal] = useState(false);
  const [output, setOutput] = useState<'new' | 'same'>('new');

  const selectedCount = 3; // Mock value

  return (
    <div className="p-3 space-y-4">
      <div className="flex items-center gap-2 pb-2 border-b border-gray-700">
        <span className="text-lg">⭕</span>
        <h3 className="text-sm font-medium text-white">Buffer</h3>
      </div>

      {/* Selection info */}
      <div className="bg-blue-900/30 border border-blue-700/50 rounded p-2">
        <p className="text-xs text-blue-300">
          📊 {selectedCount} geometria(s) selecionada(s)
        </p>
      </div>

      {/* Distance */}
      <section>
        <h4 className="text-xs font-semibold text-gray-400 uppercase mb-2">Distância</h4>
        <div className="flex gap-2">
          <input
            type="text"
            value={distance}
            onChange={(e) => setDistance(e.target.value)}
            className="flex-1 px-2 py-1.5 bg-gray-700 border border-gray-600 rounded text-xs text-white font-mono focus:border-emerald-500 focus:outline-none"
          />
          <select
            value={unit}
            onChange={(e) => setUnit(e.target.value)}
            className="px-2 py-1.5 bg-gray-700 border border-gray-600 rounded text-xs text-white focus:border-emerald-500 focus:outline-none"
          >
            <option value="meters">metros</option>
            <option value="kilometers">km</option>
            <option value="feet">pés</option>
          </select>
        </div>
      </section>

      {/* Options */}
      <section>
        <h4 className="text-xs font-semibold text-gray-400 uppercase mb-2">Opções</h4>
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <label className="text-xs text-gray-400 w-20">Segmentos:</label>
            <input
              type="text"
              value={segments}
              onChange={(e) => setSegments(e.target.value)}
              className="flex-1 px-2 py-1.5 bg-gray-700 border border-gray-600 rounded text-xs text-white font-mono focus:border-emerald-500 focus:outline-none"
            />
          </div>
          <label className="flex items-center gap-2 p-2 bg-gray-800 rounded cursor-pointer hover:bg-gray-700">
            <input
              type="checkbox"
              checked={dissolve}
              onChange={(e) => setDissolve(e.target.checked)}
              className="w-3.5 h-3.5 rounded bg-gray-700 border-gray-600 text-emerald-500 focus:ring-emerald-500"
            />
            <span className="text-xs text-gray-300">Dissolver resultado</span>
          </label>
          <label className="flex items-center gap-2 p-2 bg-gray-800 rounded cursor-pointer hover:bg-gray-700">
            <input
              type="checkbox"
              checked={keepOriginal}
              onChange={(e) => setKeepOriginal(e.target.checked)}
              className="w-3.5 h-3.5 rounded bg-gray-700 border-gray-600 text-emerald-500 focus:ring-emerald-500"
            />
            <span className="text-xs text-gray-300">Manter geometria original</span>
          </label>
        </div>
      </section>

      {/* Output */}
      <section>
        <h4 className="text-xs font-semibold text-gray-400 uppercase mb-2">Saída</h4>
        <div className="space-y-1">
          <label className="flex items-center gap-2 p-2 bg-gray-800 rounded cursor-pointer hover:bg-gray-700">
            <input
              type="radio"
              name="output"
              checked={output === 'new'}
              onChange={() => setOutput('new')}
              className="w-3.5 h-3.5 bg-gray-700 border-gray-600 text-emerald-500 focus:ring-emerald-500"
            />
            <span className="text-xs text-gray-300">Nova camada</span>
          </label>
          <label className="flex items-center gap-2 p-2 bg-gray-800 rounded cursor-pointer hover:bg-gray-700">
            <input
              type="radio"
              name="output"
              checked={output === 'same'}
              onChange={() => setOutput('same')}
              className="w-3.5 h-3.5 bg-gray-700 border-gray-600 text-emerald-500 focus:ring-emerald-500"
            />
            <span className="text-xs text-gray-300">Mesma camada</span>
          </label>
        </div>
      </section>

      {/* Actions */}
      <div className="flex gap-2 pt-2">
        <button className="flex-1 px-3 py-2 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded text-xs">
          Cancelar
        </button>
        <button
          onClick={onApply}
          className="flex-1 px-3 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-xs font-medium"
        >
          ▶ Executar
        </button>
      </div>
    </div>
  );
}

// Measure tool options
function MeasureToolOptions() {
  const [measurements] = useState([
    { id: 1, type: 'distance', value: '234.56 m' },
    { id: 2, type: 'area', value: '1.234,56 m²' },
  ]);

  return (
    <div className="p-3 space-y-4">
      <div className="flex items-center gap-2 pb-2 border-b border-gray-700">
        <span className="text-lg">📏</span>
        <h3 className="text-sm font-medium text-white">Medições</h3>
      </div>

      {/* Measurements list */}
      {measurements.length > 0 ? (
        <section>
          <h4 className="text-xs font-semibold text-gray-400 uppercase mb-2">Resultados</h4>
          <div className="space-y-1">
            {measurements.map((m) => (
              <div
                key={m.id}
                className="flex items-center justify-between p-2 bg-gray-800 rounded"
              >
                <div className="flex items-center gap-2">
                  <span className="text-sm">{m.type === 'distance' ? '📏' : '📐'}</span>
                  <span className="text-xs text-gray-300">{m.type === 'distance' ? 'Distância' : 'Área'}</span>
                </div>
                <span className="text-xs text-white font-mono">{m.value}</span>
              </div>
            ))}
          </div>
        </section>
      ) : (
        <div className="text-center py-4">
          <p className="text-xs text-gray-500">Nenhuma medição realizada</p>
        </div>
      )}

      {/* Settings */}
      <section>
        <h4 className="text-xs font-semibold text-gray-400 uppercase mb-2">Configurações</h4>
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <label className="text-xs text-gray-400 w-16">Unidade:</label>
            <select className="flex-1 px-2 py-1.5 bg-gray-700 border border-gray-600 rounded text-xs text-white focus:border-emerald-500 focus:outline-none">
              <option value="m">Metros</option>
              <option value="km">Quilômetros</option>
              <option value="ft">Pés</option>
            </select>
          </div>
          <label className="flex items-center gap-2 p-2 bg-gray-800 rounded cursor-pointer hover:bg-gray-700">
            <input
              type="checkbox"
              defaultChecked
              className="w-3.5 h-3.5 rounded bg-gray-700 border-gray-600 text-emerald-500 focus:ring-emerald-500"
            />
            <span className="text-xs text-gray-300">Mostrar labels no mapa</span>
          </label>
        </div>
      </section>

      {/* Actions */}
      <div className="flex gap-2 pt-2">
        <button className="flex-1 px-3 py-2 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded text-xs">
          🗑️ Limpar
        </button>
        <button className="flex-1 px-3 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded text-xs">
          📤 Exportar
        </button>
      </div>
    </div>
  );
}

// Main Tool Options Panel - switches based on active tool
interface ToolOptionsPanelProps {
  activeTool: string | null;
  activeTab: RibbonTab;
}

function ToolOptionsPanel({ activeTool, activeTab }: ToolOptionsPanelProps) {
  // Get mode from store (for when edit is triggered from SelectionPanel)
  const { mode: storeMode, selectedIndexes } = useEditorStore();

  // Find tool info for display
  const toolInfo = activeTool
    ? RIBBON_TOOLS[activeTab]?.flatMap(g => g.tools).find(t => t.id === activeTool)
    : null;

  // Render options based on active tool
  const renderOptions = () => {
    // Check if we're in modify mode from the store (e.g., from SelectionPanel)
    // Show GeometryEditOptions even if activeTool is not 'modify'
    if (storeMode === 'modify' && selectedIndexes.length === 1) {
      return <GeometryEditOptions />;
    }

    if (!activeTool) return <EmptyToolOptions />;

    // Point tools
    if (activeTool === 'draw-point') return <PointToolOptions />;

    // Line tools
    if (activeTool === 'draw-line') return <LineToolOptions />;

    // Polygon tools
    if (activeTool === 'draw-polygon' || activeTool === 'draw-90deg-polygon') {
      return <PolygonToolOptions />;
    }

    // Circle tool
    if (activeTool === 'draw-circle') return <CircleToolOptions />;

    // Ellipse tool
    if (activeTool === 'draw-ellipse') return <EllipseToolOptions />;

    // Geometry edit mode (from selection panel or edit tab)
    if (activeTool === 'modify') return <GeometryEditOptions />;

    // Extrude tool
    if (activeTool === 'extrude') return <ExtrudeToolOptions />;

    // Elevation tool (3D height)
    if (activeTool === 'elevation') return <ElevationToolOptions />;

    // Rectangle/Square tools (2 points)
    if (['draw-rectangle', 'draw-square'].includes(activeTool)) {
      return <RectangleToolOptions />;
    }

    // Rectangle 3 points (rotated)
    if (activeTool === 'draw-rectangle-3pts') {
      return <Rectangle3PtsToolOptions />;
    }

    // Buffer
    if (activeTool === 'buffer') return <BufferToolOptions />;

    // Measure tools
    if (['measure-distance', 'measure-area', 'measure-angle', 'measure-perimeter'].includes(activeTool)) {
      return <MeasureToolOptions />;
    }

    // Generic fallback for other tools
    return (
      <div className="p-3 space-y-4">
        <div className="flex items-center gap-2 pb-2 border-b border-gray-700">
          <span className="text-lg">{toolInfo?.icon || '🔧'}</span>
          <h3 className="text-sm font-medium text-white">{toolInfo?.label || activeTool}</h3>
        </div>
        <div className="bg-yellow-900/30 border border-yellow-700/50 rounded p-3">
          <p className="text-xs text-yellow-300">
            ⚠️ Opções para esta ferramenta ainda não implementadas
          </p>
          <p className="text-xs text-yellow-200/60 mt-1">
            Tool ID: {activeTool}
          </p>
        </div>
      </div>
    );
  };

  return (
    <div className="h-full bg-gray-800 text-white overflow-auto">
      {renderOptions()}
    </div>
  );
}

// ============================================================================
// LineToolOptions Component
// ============================================================================

// Inline vertex editor row
function VertexRow({
  index,
  coord,
  isSelected,
  onUpdate,
  onRemove,
  onSelect
}: {
  index: number;
  coord: [number, number];
  isSelected: boolean;
  onUpdate: (index: number, coord: [number, number]) => void;
  onRemove: (index: number) => void;
  onSelect: (index: number) => void;
}) {
  const [localX, setLocalX] = useState(coord[0].toFixed(6));
  const [localY, setLocalY] = useState(coord[1].toFixed(6));
  const [focused, setFocused] = useState(false);

  // Sync from props when not focused
  useEffect(() => {
    if (!focused) {
      setLocalX(coord[0].toFixed(6));
      setLocalY(coord[1].toFixed(6));
    }
  }, [coord, focused]);

  const handleXChange = (value: string) => {
    setLocalX(value);
    const x = parseFloat(value);
    if (!isNaN(x)) {
      onUpdate(index, [x, coord[1]]);
    }
  };

  const handleYChange = (value: string) => {
    setLocalY(value);
    const y = parseFloat(value);
    if (!isNaN(y)) {
      onUpdate(index, [coord[0], y]);
    }
  };

  return (
    <div
      className={`flex items-center gap-1 px-2 py-1.5 rounded ${
        isSelected ? 'bg-yellow-900/50 border border-yellow-600' : 'bg-gray-700/50'
      }`}
    >
      <span
        className="text-xs text-gray-400 w-5 cursor-pointer hover:text-white"
        onClick={() => onSelect(index)}
        title="Clique para selecionar (editar via mapa)"
      >
        #{index + 1}
      </span>
      <input
        type="text"
        value={localX}
        onChange={(e) => handleXChange(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        className="w-24 px-1.5 py-0.5 bg-gray-800 border border-gray-600 rounded text-xs text-white font-mono focus:border-blue-500 focus:outline-none"
        title="Longitude"
      />
      <input
        type="text"
        value={localY}
        onChange={(e) => handleYChange(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        className="w-24 px-1.5 py-0.5 bg-gray-800 border border-gray-600 rounded text-xs text-white font-mono focus:border-blue-500 focus:outline-none"
        title="Latitude"
      />
      <button
        onClick={() => onRemove(index)}
        className="text-red-400 hover:text-red-300 text-xs px-1 ml-auto"
        title="Remover vértice"
      >
        ✕
      </button>
    </div>
  );
}

function LineToolOptions() {
  const {
    drawingCoordinates,
    updateDrawingCoordinate,
    removeDrawingCoordinate,
    clearDrawingCoordinates,
    finishDrawing,
    isDrawing,
    mode,
    features,
    activeVertexIndex,
    setActiveVertexIndex
  } = useEditorStore();

  // Global keyboard listener for Enter and Escape
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (mode !== 'draw-line') return;

      // Don't trigger if user is typing in an input
      if (e.target instanceof HTMLInputElement) return;

      if (e.key === 'Enter' && isDrawing) {
        if (drawingCoordinates.length >= 2) {
          e.preventDefault();
          finishDrawing();
        }
      }

      if (e.key === 'Escape') {
        e.preventDefault();
        clearDrawingCoordinates();
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [mode, isDrawing, drawingCoordinates.length, finishDrawing, clearDrawingCoordinates]);

  // Handle vertex selection for map-based editing
  const handleSelectVertex = (index: number) => {
    if (activeVertexIndex === index) {
      // Clicking same vertex deselects it
      setActiveVertexIndex(null);
    } else {
      setActiveVertexIndex(index);
    }
  };

  // Remove a vertex
  const handleRemoveVertex = (index: number) => {
    removeDrawingCoordinate(index);
    if (activeVertexIndex === index) {
      setActiveVertexIndex(null);
    } else if (activeVertexIndex !== null && activeVertexIndex > index) {
      setActiveVertexIndex(activeVertexIndex - 1);
    }
  };

  // Handle finish
  const handleFinish = () => {
    if (drawingCoordinates.length >= 2) {
      finishDrawing();
    }
  };

  // Handle cancel
  const handleCancel = () => {
    clearDrawingCoordinates();
  };

  const canFinish = drawingCoordinates.length >= 2;

  return (
    <div className="p-3 space-y-4">
      {/* Header */}
      <div className="flex items-center gap-2 pb-2 border-b border-gray-700">
        <span className="text-lg">📏</span>
        <h3 className="text-sm font-medium text-white">Criar Linha</h3>
        <span className="ml-auto text-xs text-gray-500">{features.features.length} criadas</span>
      </div>

      {/* Vertex List with inline editing */}
      <section>
        <div className="flex items-center justify-between mb-2">
          <h4 className="text-xs font-semibold text-gray-400 uppercase">
            Vértices ({drawingCoordinates.length})
          </h4>
          <span className="text-xs text-gray-500">Lon / Lat</span>
        </div>
        <div className="space-y-1 max-h-60 overflow-y-auto">
          {drawingCoordinates.map((coord, index) => (
            <VertexRow
              key={index}
              index={index}
              coord={coord}
              isSelected={activeVertexIndex === index}
              onUpdate={updateDrawingCoordinate}
              onRemove={handleRemoveVertex}
              onSelect={handleSelectVertex}
            />
          ))}

          {drawingCoordinates.length === 0 && (
            <div className="text-xs text-gray-500 italic py-2">
              Clique no mapa para adicionar o primeiro vértice
            </div>
          )}
        </div>
      </section>

      {/* Status */}
      <div className={`rounded p-2 ${
        canFinish
          ? 'bg-emerald-900/30 border border-emerald-700/50'
          : 'bg-gray-800 border border-gray-700'
      }`}>
        <p className={`text-xs ${canFinish ? 'text-emerald-300' : 'text-gray-400'}`}>
          {canFinish
            ? `${drawingCoordinates.length} vértices - pronto para finalizar`
            : `${drawingCoordinates.length} vértice${drawingCoordinates.length !== 1 ? 's' : ''} - mínimo 2 para finalizar`
          }
        </p>
        {canFinish && (
          <p className="text-xs text-emerald-400 mt-1">
            ↵ Enter ou duplo-clique para finalizar
          </p>
        )}
      </div>

      {/* Action Buttons */}
      <div className="flex gap-2">
        <button
          onClick={handleCancel}
          className="flex-1 px-3 py-1.5 bg-gray-700 hover:bg-gray-600 border border-gray-600 rounded text-xs text-gray-300"
        >
          Cancelar
        </button>
        <button
          onClick={handleFinish}
          disabled={!canFinish}
          className={`flex-1 px-3 py-1.5 rounded text-xs ${
            canFinish
              ? 'bg-emerald-600 hover:bg-emerald-500 text-white'
              : 'bg-gray-700 text-gray-500 cursor-not-allowed'
          }`}
        >
          Finalizar
        </button>
      </div>
    </div>
  );
}

// ============================================================================
// PolygonToolOptions Component (similar to Line but min 3 vertices)
// ============================================================================

function PolygonToolOptions() {
  const {
    drawingCoordinates,
    updateDrawingCoordinate,
    removeDrawingCoordinate,
    clearDrawingCoordinates,
    finishDrawing,
    isDrawing,
    mode,
    features,
    activeVertexIndex,
    setActiveVertexIndex
  } = useEditorStore();

  // Global keyboard listener for Enter and Escape
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (mode !== 'draw-polygon' && mode !== 'draw-90deg-polygon') return;
      if (e.target instanceof HTMLInputElement) return;

      if (e.key === 'Enter' && isDrawing) {
        if (drawingCoordinates.length >= 3) {
          e.preventDefault();
          finishDrawing();
        }
      }

      if (e.key === 'Escape') {
        e.preventDefault();
        clearDrawingCoordinates();
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [mode, isDrawing, drawingCoordinates.length, finishDrawing, clearDrawingCoordinates]);

  const handleSelectVertex = (index: number) => {
    if (activeVertexIndex === index) {
      setActiveVertexIndex(null);
    } else {
      setActiveVertexIndex(index);
    }
  };

  const handleRemoveVertex = (index: number) => {
    removeDrawingCoordinate(index);
    if (activeVertexIndex === index) {
      setActiveVertexIndex(null);
    } else if (activeVertexIndex !== null && activeVertexIndex > index) {
      setActiveVertexIndex(activeVertexIndex - 1);
    }
  };

  const handleFinish = () => {
    if (drawingCoordinates.length >= 3) {
      finishDrawing();
    }
  };

  const handleCancel = () => {
    clearDrawingCoordinates();
  };

  const canFinish = drawingCoordinates.length >= 3;
  const icon = mode === 'draw-90deg-polygon' ? '📐' : '⬡';
  const title = mode === 'draw-90deg-polygon' ? 'Criar Polígono 90°' : 'Criar Polígono';

  return (
    <div className="p-3 space-y-4">
      <div className="flex items-center gap-2 pb-2 border-b border-gray-700">
        <span className="text-lg">{icon}</span>
        <h3 className="text-sm font-medium text-white">{title}</h3>
        <span className="ml-auto text-xs text-gray-500">{features.features.length} criados</span>
      </div>

      <section>
        <div className="flex items-center justify-between mb-2">
          <h4 className="text-xs font-semibold text-gray-400 uppercase">
            Vértices ({drawingCoordinates.length})
          </h4>
          <span className="text-xs text-gray-500">Lon / Lat</span>
        </div>
        <div className="space-y-1 max-h-60 overflow-y-auto">
          {drawingCoordinates.map((coord, index) => (
            <VertexRow
              key={index}
              index={index}
              coord={coord}
              isSelected={activeVertexIndex === index}
              onUpdate={updateDrawingCoordinate}
              onRemove={handleRemoveVertex}
              onSelect={handleSelectVertex}
            />
          ))}

          {drawingCoordinates.length === 0 && (
            <div className="text-xs text-gray-500 italic py-2">
              Clique no mapa para adicionar o primeiro vértice
            </div>
          )}
        </div>
      </section>

      {mode === 'draw-90deg-polygon' && (
        <div className="bg-orange-900/30 border border-orange-700/50 rounded p-2">
          <p className="text-xs text-orange-300">
            <strong>Modo 90°:</strong> Os vértices são alinhados automaticamente na horizontal ou vertical em relação ao ponto anterior.
          </p>
        </div>
      )}

      <div className={`rounded p-2 ${
        canFinish
          ? 'bg-emerald-900/30 border border-emerald-700/50'
          : 'bg-gray-800 border border-gray-700'
      }`}>
        <p className={`text-xs ${canFinish ? 'text-emerald-300' : 'text-gray-400'}`}>
          {canFinish
            ? `${drawingCoordinates.length} vértices - pronto para finalizar`
            : `${drawingCoordinates.length} vértice${drawingCoordinates.length !== 1 ? 's' : ''} - mínimo 3 para finalizar`
          }
        </p>
        {canFinish && (
          <p className="text-xs text-emerald-400 mt-1">
            ↵ Enter ou duplo-clique para finalizar
          </p>
        )}
      </div>

      <div className="flex gap-2">
        <button
          onClick={handleCancel}
          className="flex-1 px-3 py-1.5 bg-gray-700 hover:bg-gray-600 border border-gray-600 rounded text-xs text-gray-300"
        >
          Cancelar
        </button>
        <button
          onClick={handleFinish}
          disabled={!canFinish}
          className={`flex-1 px-3 py-1.5 rounded text-xs ${
            canFinish
              ? 'bg-emerald-600 hover:bg-emerald-500 text-white'
              : 'bg-gray-700 text-gray-500 cursor-not-allowed'
          }`}
        >
          Finalizar
        </button>
      </div>
    </div>
  );
}

// ============================================================================
// CircleToolOptions Component (center + radius)
// ============================================================================

function CircleToolOptions() {
  const {
    drawingCoordinates,
    updateDrawingCoordinate,
    clearDrawingCoordinates,
    finishDrawing,
    isDrawing,
    mode,
    features
  } = useEditorStore();

  const [inputCenterX, setInputCenterX] = useState('');
  const [inputCenterY, setInputCenterY] = useState('');
  const [inputRadius, setInputRadius] = useState('');
  const [focused, setFocused] = useState(false);

  const center = drawingCoordinates[0] || null;
  const radiusPoint = drawingCoordinates[1] || null;

  // Calculate radius in meters (approximate)
  const radiusMeters = useMemo(() => {
    if (!center || !radiusPoint) return null;
    const dx = (radiusPoint[0] - center[0]) * 111320 * Math.cos(center[1] * Math.PI / 180);
    const dy = (radiusPoint[1] - center[1]) * 110540;
    return Math.sqrt(dx * dx + dy * dy);
  }, [center, radiusPoint]);

  // Sync inputs from store
  useEffect(() => {
    if (focused) return;
    if (center) {
      setInputCenterX(center[0].toFixed(6));
      setInputCenterY(center[1].toFixed(6));
    }
    if (radiusMeters !== null) {
      setInputRadius(radiusMeters.toFixed(2));
    }
  }, [center, radiusMeters, focused]);

  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (mode !== 'draw-circle') return;
      if (e.target instanceof HTMLInputElement) return;

      if (e.key === 'Enter' && isDrawing && drawingCoordinates.length >= 2) {
        e.preventDefault();
        finishDrawing();
      }

      if (e.key === 'Escape') {
        e.preventDefault();
        clearDrawingCoordinates();
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [mode, isDrawing, drawingCoordinates.length, finishDrawing, clearDrawingCoordinates]);

  const handleCenterChange = (axis: 'x' | 'y', value: string) => {
    if (axis === 'x') setInputCenterX(value);
    else setInputCenterY(value);

    const x = axis === 'x' ? parseFloat(value) : parseFloat(inputCenterX);
    const y = axis === 'y' ? parseFloat(value) : parseFloat(inputCenterY);

    if (!isNaN(x) && !isNaN(y)) {
      updateDrawingCoordinate(0, [x, y]);
    }
  };

  const handleFinish = () => {
    if (drawingCoordinates.length >= 2) {
      finishDrawing();
    }
  };

  const handleCancel = () => {
    clearDrawingCoordinates();
  };

  const canFinish = drawingCoordinates.length >= 2;

  return (
    <div className="p-3 space-y-4">
      <div className="flex items-center gap-2 pb-2 border-b border-gray-700">
        <span className="text-lg">⭕</span>
        <h3 className="text-sm font-medium text-white">Criar Círculo</h3>
        <span className="ml-auto text-xs text-gray-500">{features.features.length} criados</span>
      </div>

      <div className="rounded p-2 bg-blue-900/30 border border-blue-700/50">
        <p className="text-xs text-blue-300">
          {!center
            ? '1. Clique no mapa para definir o centro'
            : !radiusPoint
              ? '2. Clique no mapa para definir o raio'
              : 'Pronto! Enter para finalizar'}
        </p>
      </div>

      <section>
        <h4 className="text-xs font-semibold text-gray-400 uppercase mb-2">Centro</h4>
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <label className="text-xs text-gray-400 w-8">Lon:</label>
            <input
              type="text"
              value={inputCenterX}
              onChange={(e) => handleCenterChange('x', e.target.value)}
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
              placeholder="-49.254300"
              className="flex-1 px-2 py-1.5 bg-gray-700 border border-gray-600 rounded text-xs text-white font-mono focus:border-blue-500 focus:outline-none"
            />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs text-gray-400 w-8">Lat:</label>
            <input
              type="text"
              value={inputCenterY}
              onChange={(e) => handleCenterChange('y', e.target.value)}
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
              placeholder="-16.686900"
              className="flex-1 px-2 py-1.5 bg-gray-700 border border-gray-600 rounded text-xs text-white font-mono focus:border-blue-500 focus:outline-none"
            />
          </div>
        </div>
      </section>

      <section>
        <h4 className="text-xs font-semibold text-gray-400 uppercase mb-2">Raio</h4>
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={inputRadius}
            readOnly
            placeholder="Clique no mapa"
            className="flex-1 px-2 py-1.5 bg-gray-800 border border-gray-600 rounded text-xs text-white font-mono"
          />
          <span className="text-xs text-gray-500">metros</span>
        </div>
      </section>

      <div className={`rounded p-2 ${
        canFinish
          ? 'bg-emerald-900/30 border border-emerald-700/50'
          : 'bg-gray-800 border border-gray-700'
      }`}>
        <p className={`text-xs ${canFinish ? 'text-emerald-300' : 'text-gray-400'}`}>
          {canFinish
            ? `Raio: ${radiusMeters?.toFixed(2) || '?'} m - pronto para finalizar`
            : 'Defina centro e raio'
          }
        </p>
      </div>

      <div className="flex gap-2">
        <button
          onClick={handleCancel}
          className="flex-1 px-3 py-1.5 bg-gray-700 hover:bg-gray-600 border border-gray-600 rounded text-xs text-gray-300"
        >
          Cancelar
        </button>
        <button
          onClick={handleFinish}
          disabled={!canFinish}
          className={`flex-1 px-3 py-1.5 rounded text-xs ${
            canFinish
              ? 'bg-emerald-600 hover:bg-emerald-500 text-white'
              : 'bg-gray-700 text-gray-500 cursor-not-allowed'
          }`}
        >
          Finalizar
        </button>
      </div>
    </div>
  );
}

// ============================================================================
// EllipseToolOptions Component (bounding box)
// ============================================================================

function EllipseToolOptions() {
  const {
    drawingCoordinates,
    clearDrawingCoordinates,
    finishDrawing,
    isDrawing,
    mode,
    features
  } = useEditorStore();

  const corner1 = drawingCoordinates[0] || null;
  const corner2 = drawingCoordinates[1] || null;

  // Calculate dimensions
  const dimensions = useMemo(() => {
    if (!corner1 || !corner2) return null;
    const width = Math.abs(corner2[0] - corner1[0]) * 111320 * Math.cos(((corner1[1] + corner2[1]) / 2) * Math.PI / 180);
    const height = Math.abs(corner2[1] - corner1[1]) * 110540;
    return { width, height };
  }, [corner1, corner2]);

  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (mode !== 'draw-ellipse') return;
      if (e.target instanceof HTMLInputElement) return;

      if (e.key === 'Enter' && isDrawing && drawingCoordinates.length >= 2) {
        e.preventDefault();
        finishDrawing();
      }

      if (e.key === 'Escape') {
        e.preventDefault();
        clearDrawingCoordinates();
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [mode, isDrawing, drawingCoordinates.length, finishDrawing, clearDrawingCoordinates]);

  const handleFinish = () => {
    if (drawingCoordinates.length >= 2) {
      finishDrawing();
    }
  };

  const handleCancel = () => {
    clearDrawingCoordinates();
  };

  const canFinish = drawingCoordinates.length >= 2;

  return (
    <div className="p-3 space-y-4">
      <div className="flex items-center gap-2 pb-2 border-b border-gray-700">
        <span className="text-lg">⬭</span>
        <h3 className="text-sm font-medium text-white">Criar Elipse</h3>
        <span className="ml-auto text-xs text-gray-500">{features.features.length} criadas</span>
      </div>

      <div className="rounded p-2 bg-blue-900/30 border border-blue-700/50">
        <p className="text-xs text-blue-300">
          {!corner1
            ? '1. Clique no mapa para definir o primeiro canto'
            : !corner2
              ? '2. Clique no mapa para definir o canto oposto'
              : 'Pronto! Enter para finalizar'}
        </p>
      </div>

      {dimensions && (
        <section>
          <h4 className="text-xs font-semibold text-gray-400 uppercase mb-2">Dimensões</h4>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="p-2 bg-gray-700/50 rounded">
              <span className="text-gray-400">Largura:</span>
              <span className="text-white ml-1">{dimensions.width.toFixed(2)} m</span>
            </div>
            <div className="p-2 bg-gray-700/50 rounded">
              <span className="text-gray-400">Altura:</span>
              <span className="text-white ml-1">{dimensions.height.toFixed(2)} m</span>
            </div>
          </div>
        </section>
      )}

      <div className={`rounded p-2 ${
        canFinish
          ? 'bg-emerald-900/30 border border-emerald-700/50'
          : 'bg-gray-800 border border-gray-700'
      }`}>
        <p className={`text-xs ${canFinish ? 'text-emerald-300' : 'text-gray-400'}`}>
          {canFinish
            ? 'Elipse definida - pronto para finalizar'
            : 'Defina os dois cantos do retângulo delimitador'
          }
        </p>
      </div>

      <div className="flex gap-2">
        <button
          onClick={handleCancel}
          className="flex-1 px-3 py-1.5 bg-gray-700 hover:bg-gray-600 border border-gray-600 rounded text-xs text-gray-300"
        >
          Cancelar
        </button>
        <button
          onClick={handleFinish}
          disabled={!canFinish}
          className={`flex-1 px-3 py-1.5 rounded text-xs ${
            canFinish
              ? 'bg-emerald-600 hover:bg-emerald-500 text-white'
              : 'bg-gray-700 text-gray-500 cursor-not-allowed'
          }`}
        >
          Finalizar
        </button>
      </div>
    </div>
  );
}

// ============================================================================
// Ribbon Components
// ============================================================================

interface RibbonTabBarProps {
  activeTab: RibbonTab;
  onTabChange: (tab: RibbonTab) => void;
  onTabDoubleClick: (tab: RibbonTab) => void;
  ribbonExpanded: boolean;
  onToggleExpand: () => void;
}

function RibbonTabBar({
  activeTab,
  onTabChange,
  onTabDoubleClick,
  ribbonExpanded,
  onToggleExpand,
}: RibbonTabBarProps) {
  const lastClickTime = useRef<number>(0);
  const lastClickTab = useRef<RibbonTab | null>(null);

  const handleTabClick = (tab: RibbonTab) => {
    const now = Date.now();
    const isDoubleClick = lastClickTab.current === tab && now - lastClickTime.current < 300;

    if (isDoubleClick) {
      onTabDoubleClick(tab);
    } else {
      onTabChange(tab);
    }

    lastClickTime.current = now;
    lastClickTab.current = tab;
  };

  return (
    <div className="h-9 bg-gray-900 border-b border-gray-700 flex items-center flex-shrink-0">
      {/* Logo */}
      <div className="w-10 h-full flex items-center justify-center border-r border-gray-700">
        <span className="text-base">🗺️</span>
      </div>

      {/* Arquivo Menu */}
      <button className="px-3 h-full text-xs text-gray-400 hover:text-white hover:bg-gray-800 border-r border-gray-700">
        Arquivo
      </button>

      {/* Tool Tabs */}
      <div className="flex-1 flex items-center h-full">
        {RIBBON_TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => handleTabClick(tab.id)}
            className={`px-4 h-full flex items-center gap-1.5 text-xs transition-colors border-b-2 ${
              activeTab === tab.id
                ? 'bg-gray-800 text-emerald-400 border-emerald-400'
                : 'text-gray-400 hover:text-white hover:bg-gray-800/50 border-transparent'
            }`}
          >
            <span>{tab.icon}</span>
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Right Actions */}
      <div className="flex items-center gap-1 px-2 border-l border-gray-700">
        <button
          title="Desfazer (Ctrl+Z)"
          className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-700 rounded text-sm"
        >
          ↩️
        </button>
        <button
          title="Refazer (Ctrl+Y)"
          className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-700 rounded text-sm"
        >
          ↪️
        </button>
        <div className="w-px h-4 bg-gray-700 mx-1" />
        <button
          onClick={onToggleExpand}
          title={ribbonExpanded ? 'Recolher Ribbon (Ctrl+F1)' : 'Expandir Ribbon (Ctrl+F1)'}
          className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-700 rounded text-sm"
        >
          {ribbonExpanded ? '🔼' : '🔽'}
        </button>
        <button
          title="Configurações"
          className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-700 rounded text-sm"
        >
          ⚙️
        </button>
      </div>
    </div>
  );
}

interface RibbonPanelProps {
  activeTab: RibbonTab;
  activeTool: string | null;
  onToolSelect: (toolId: string) => void;
  expanded: boolean;
  // For panel toggle buttons
  visiblePanels?: string[];
  onTogglePanel?: (panelId: string) => void;
}

// Map tool IDs to panel IDs
const TOOL_TO_PANEL: Record<string, string> = {
  'panel-layers': 'layers',
  'panel-selection': 'selection',
  'panel-options': 'options',
  'panel-attributes': 'attributes',
  'panel-history': 'history',
  'panel-analysis': 'analysis',
  'panel-table': 'table',
};

function RibbonPanel({
  activeTab,
  activeTool,
  onToolSelect,
  expanded,
  visiblePanels = [],
  onTogglePanel,
}: RibbonPanelProps) {
  const groups = RIBBON_TOOLS[activeTab];

  if (!expanded) return null;

  // Check if a tool is "active"
  const isToolActive = (toolId: string) => {
    // For panel toggles, check if panel is visible
    const panelId = TOOL_TO_PANEL[toolId];
    if (panelId) return visiblePanels.includes(panelId);
    // For regular tools, check if selected
    return activeTool === toolId;
  };

  // Handle tool click
  const handleToolClick = (toolId: string) => {
    const panelId = TOOL_TO_PANEL[toolId];
    if (panelId && onTogglePanel) {
      // It's a panel toggle
      onTogglePanel(panelId);
    } else {
      // Regular tool
      onToolSelect(toolId);
    }
  };

  return (
    <div className="h-16 bg-gray-850 border-b border-gray-700 flex items-stretch px-2 flex-shrink-0 bg-gradient-to-b from-gray-800 to-gray-900">
      {groups.map((group, groupIndex) => (
        <div key={group.name} className="flex items-stretch">
          {/* Group Tools */}
          <div className="flex items-center gap-0.5 px-2">
            {group.tools.map((tool) => {
              const isActive = isToolActive(tool.id);

              return (
                <button
                  key={tool.id}
                  onClick={() => handleToolClick(tool.id)}
                  disabled={tool.disabled}
                  title={`${tool.label}${tool.shortcut ? ` (${tool.shortcut})` : ''}`}
                  className={`flex flex-col items-center justify-center px-2 py-1 rounded transition-colors min-w-[44px] h-12 ${
                    isActive
                      ? 'bg-emerald-600 text-white'
                      : 'text-gray-300 hover:text-white hover:bg-gray-700'
                  } ${tool.disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  <span className="text-lg leading-none">{tool.icon}</span>
                  <span className="text-[9px] mt-1 leading-none opacity-80 truncate max-w-[44px]">
                    {tool.label}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Group Separator with Label */}
          {groupIndex < groups.length - 1 && (
            <div className="flex flex-col items-center justify-end py-1">
              <div className="flex-1 w-px bg-gray-600" />
              <span className="text-[8px] text-gray-500 mt-1 px-1">{group.name}</span>
            </div>
          )}

          {/* Last group label */}
          {groupIndex === groups.length - 1 && (
            <div className="flex flex-col items-center justify-end py-1 pl-1">
              <span className="text-[8px] text-gray-500">{group.name}</span>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// ============================================================================
// FlexLayout Model Builder
// ============================================================================

function buildModel(visiblePanels: string[]): IJsonModel {
  // Separate panels by location
  const leftPanels = PANELS.filter(p => p.defaultLocation === 'left' && visiblePanels.includes(p.id));
  const rightPanels = PANELS.filter(p => p.defaultLocation === 'right' && visiblePanels.includes(p.id));
  const bottomPanels = PANELS.filter(p => p.defaultLocation === 'bottom' && visiblePanels.includes(p.id));

  const borders = [];

  // Left border
  if (leftPanels.length > 0) {
    borders.push({
      type: 'border',
      location: 'left',
      size: 280,
      barSize: 36,
      selected: 0,
      children: leftPanels.map(p => ({
        type: 'tab',
        id: p.id,
        name: p.name,
        component: p.component,
        enableClose: true,
      })),
    });
  }

  // Right border
  if (rightPanels.length > 0) {
    borders.push({
      type: 'border',
      location: 'right',
      size: 280,
      barSize: 36,
      selected: 0,
      children: rightPanels.map(p => ({
        type: 'tab',
        id: p.id,
        name: p.name,
        component: p.component,
        enableClose: true,
      })),
    });
  }

  // Bottom border
  if (bottomPanels.length > 0) {
    borders.push({
      type: 'border',
      location: 'bottom',
      size: 200,
      selected: 0,
      children: bottomPanels.map(p => ({
        type: 'tab',
        id: p.id,
        name: p.name,
        component: p.component,
        enableClose: true,
      })),
    });
  }

  return {
    global: {
      tabEnableClose: true,
      tabEnableRename: false,
      tabSetMinWidth: 100,
      tabSetMinHeight: 100,
      borderMinSize: 100,
      splitterSize: 4,
      splitterExtra: 4,
      borderEnableAutoHide: true,
      tabSetEnableTabStrip: true, // Always show tab strip
    },
    borders: borders as IJsonModel['borders'],
    layout: {
      type: 'row',
      weight: 100,
      children: [
        {
          type: 'tabset',
          weight: 100,
          tabLocation: 'top',
          enableTabStrip: true, // Force show tab strip
          children: [
            {
              type: 'tab',
              id: 'map',
              name: 'Mapa',
              component: 'map',
              enableClose: false,
            },
          ],
        },
      ],
    },
  };
}

// ============================================================================
// Main Component
// ============================================================================

export function FlexLayoutTest() {
  const layoutRef = useRef<Layout>(null);

  // Load saved visible panels (with migration for new default panels)
  const [visiblePanels, setVisiblePanels] = useState<string[]>(() => {
    const saved = localStorage.getItem('flexlayout-visible-panels');
    if (saved) {
      const parsed = JSON.parse(saved) as string[];
      // Add any new default panels that weren't in saved config
      const newDefaults = DEFAULT_VISIBLE_PANELS.filter(p => !parsed.includes(p));
      if (newDefaults.length > 0) {
        const merged = [...parsed, ...newDefaults];
        localStorage.setItem('flexlayout-visible-panels', JSON.stringify(merged));
        return merged;
      }
      return parsed;
    }
    return DEFAULT_VISIBLE_PANELS;
  });

  const [model, setModel] = useState(() => Model.fromJson(buildModel(visiblePanels)));

  // Map counter for creating new maps
  const mapCounterRef = useRef(1);

  // Ribbon state
  const [activeRibbonTab, setActiveRibbonTab] = useState<RibbonTab>('criar');
  const [activeTool, setActiveTool] = useState<string | null>(null);
  const [ribbonExpanded, setRibbonExpanded] = useState(true);

  // Selection mode state
  const [selectionMode, setSelectionMode] = useState<'single' | 'multi' | null>(null);

  // Editor store for drawing modes and feature info
  const { setMode, setIsDrawing, setSilentMode, features, selectedIndexes } = useEditorStore();

  // Drawing modes that map to editable-layers
  const DRAWING_MODES: Record<string, DrawingMode> = {
    'draw-point': 'draw-point',
    'draw-line': 'draw-line',
    'draw-polygon': 'draw-polygon',
    'draw-rectangle': 'draw-rectangle',
    'draw-rectangle-3pts': 'draw-rectangle-3pts',
    'draw-square': 'draw-square',
    'draw-circle': 'draw-circle',
    'draw-ellipse': 'draw-ellipse',
    'draw-lasso': 'draw-lasso',
    'draw-90deg-polygon': 'draw-90deg-polygon',
    'modify': 'modify',
    'translate': 'translate',
    'rotate': 'rotate',
    'scale': 'scale',
    'transform': 'transform',
    'extrude': 'extrude',
    'elevation': 'elevation',
    'measure-distance': 'measure-distance',
    'measure-area': 'measure-area',
  };

  // Handle tool selection - sync with editor store
  const handleToolSelect = useCallback((toolId: string) => {
    // Toggle off if clicking same tool
    if (activeTool === toolId) {
      setActiveTool(null);
      setMode('view');
      setIsDrawing(false);
      setSilentMode(false);
      setSelectionMode(null);
      return;
    }

    setActiveTool(toolId);

    // Check if this is a selection mode
    if (toolId === 'select-single') {
      setMode('view');
      setIsDrawing(false);
      setSilentMode(false);
      setSelectionMode('single');
      return;
    }
    if (toolId === 'select-multi') {
      setMode('view');
      setIsDrawing(false);
      setSilentMode(false);
      setSelectionMode('multi');
      return;
    }

    // Not a selection tool - clear selection mode
    setSelectionMode(null);

    // Check if this is a drawing/editing mode
    const drawingMode = DRAWING_MODES[toolId];
    if (drawingMode) {
      setMode(drawingMode);
      // Enable drawing state for creation modes
      const creationModes = ['draw-point', 'draw-line', 'draw-polygon', 'draw-rectangle', 'draw-rectangle-3pts', 'draw-square', 'draw-circle', 'draw-ellipse', 'draw-lasso', 'draw-90deg-polygon'];
      if (creationModes.includes(toolId)) {
        setIsDrawing(true);
        // No silent mode - use Enter to create (bidirectional sync with panel)
        setSilentMode(false);
      }
    } else {
      setMode('view');
      setIsDrawing(false);
      setSilentMode(false);
    }
  }, [activeTool, setMode, setIsDrawing, setSilentMode]);

  // Save visible panels
  useEffect(() => {
    localStorage.setItem('flexlayout-visible-panels', JSON.stringify(visiblePanels));
  }, [visiblePanels]);

  // Add new map tab
  const addNewMap = useCallback(() => {
    mapCounterRef.current += 1;
    const mapNumber = mapCounterRef.current;
    const mapId = `map-${mapNumber}`;

    // Find the tabset containing the current map
    const mapNode = model.getNodeById('map');
    if (mapNode) {
      const parent = mapNode.getParent();
      if (parent) {
        model.doAction(
          Actions.addNode(
            {
              type: 'tab',
              id: mapId,
              name: `Mapa ${mapNumber}`,
              component: 'map',
              config: { mapNumber },
            },
            parent.getId(),
            DockLocation.CENTER,
            -1
          )
        );
      }
    }
  }, [model]);

  // Factory function
  const factory = useCallback((node: TabNode) => {
    const component = node.getComponent();

    switch (component) {
      case 'map':
        return <MapView selectionMode={selectionMode} />;
      case 'selection': return <SelectionPanel />;
      case 'layers': return <MockLayersPanel />;
      case 'snap': return <SnapPanel />;
      case 'attributes': return <MockAttributesPanel />;
      case 'analysis': return <MockAnalysisPanel />;
      case 'table': return <MockAttributeTable />;
      case 'history': return <MockHistoryPanel />;
      case 'options': return <ToolOptionsPanel activeTool={activeTool} activeTab={activeRibbonTab} />;
      default: return <div className="p-4 text-gray-400">Component: {component}</div>;
    }
  }, [activeTool, activeRibbonTab, selectionMode]);

  // Render tabset with add button for map tabsets
  const onRenderTabSet = useCallback((node: TabSetNode | BorderNode, renderValues: ITabSetRenderValues) => {
    // Only add button to TabSetNodes, not BorderNodes
    if (!(node instanceof TabSetNode)) return;

    // Check if this tabset contains any map tabs
    const hasMapTab = node.getChildren().some((child) => {
      if (child instanceof TabNode) {
        return child.getComponent() === 'map';
      }
      return false;
    });

    if (hasMapTab) {
      // Add a button to the tabset header (using buttons array)
      renderValues.buttons.push(
        <button
          key="add-map"
          onClick={(e) => {
            e.stopPropagation();
            addNewMap();
          }}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '24px',
            height: '24px',
            marginLeft: '4px',
            backgroundColor: 'transparent',
            border: '1px solid #4b5563',
            borderRadius: '4px',
            color: '#9ca3af',
            cursor: 'pointer',
            fontSize: '16px',
            lineHeight: 1,
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = '#10b981';
            e.currentTarget.style.borderColor = '#10b981';
            e.currentTarget.style.color = 'white';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'transparent';
            e.currentTarget.style.borderColor = '#4b5563';
            e.currentTarget.style.color = '#9ca3af';
          }}
          title="Adicionar novo mapa"
        >
          +
        </button>
      );
    }
  }, [addNewMap]);

  // Toggle panel visibility
  const togglePanel = useCallback((panelId: string) => {
    setVisiblePanels(prev => {
      const newPanels = prev.includes(panelId)
        ? prev.filter(id => id !== panelId)
        : [...prev, panelId];

      // Rebuild model with new panels
      setModel(Model.fromJson(buildModel(newPanels)));
      return newPanels;
    });
  }, []);

  // Handle tab close from FlexLayout
  const handleAction = useCallback((action: Action) => {
    if (action.type === Actions.DELETE_TAB) {
      const tabId = (action as any).data.node;
      // Remove from visible panels when closed via X button
      setVisiblePanels(prev => prev.filter(id => id !== tabId));
    }
    return action;
  }, []);

  // Ribbon handlers
  const handleRibbonTabChange = useCallback((tab: RibbonTab) => {
    if (tab !== activeRibbonTab) {
      setActiveRibbonTab(tab);
      setActiveTool(null);
      // If ribbon is collapsed, expand it when switching tabs
      if (!ribbonExpanded) {
        setRibbonExpanded(true);
      }
    }
  }, [activeRibbonTab, ribbonExpanded]);

  const handleRibbonTabDoubleClick = useCallback((tab: RibbonTab) => {
    if (tab === activeRibbonTab) {
      setRibbonExpanded(!ribbonExpanded);
    }
  }, [activeRibbonTab, ribbonExpanded]);

  return (
    <div className="h-screen flex flex-col bg-gray-900">
      {/* Ribbon Tab Bar (Line 1) */}
      <RibbonTabBar
        activeTab={activeRibbonTab}
        onTabChange={handleRibbonTabChange}
        onTabDoubleClick={handleRibbonTabDoubleClick}
        ribbonExpanded={ribbonExpanded}
        onToggleExpand={() => setRibbonExpanded(!ribbonExpanded)}
      />

      {/* Ribbon Panel (Line 2) - Collapsible */}
      <RibbonPanel
        activeTab={activeRibbonTab}
        activeTool={activeTool}
        onToolSelect={handleToolSelect}
        expanded={ribbonExpanded}
        visiblePanels={visiblePanels}
        onTogglePanel={togglePanel}
      />

      {/* FlexLayout */}
      <div className="flex-1 relative">
        <Layout
          ref={layoutRef}
          model={model}
          factory={factory}
          onAction={handleAction}
          onRenderTabSet={onRenderTabSet}
          realtimeResize={true}
        />
      </div>

      {/* Status Bar (bottom) */}
      <div className="h-6 bg-gray-900 border-t border-gray-700 flex items-center px-3 text-xs text-gray-400 flex-shrink-0">
        <span>📍 -49.2543, -16.6869</span>
        <span className="mx-3 text-gray-600">|</span>
        <span>🔍 Zoom: 15.2</span>
        <span className="mx-3 text-gray-600">|</span>
        <span>
          {selectionMode ? (
            <span className="text-blue-400">⬚ Seleção {selectionMode === 'single' ? 'Simples' : 'Múltipla'}</span>
          ) : (
            <>✏️ {activeTool ? RIBBON_TOOLS[activeRibbonTab].flatMap(g => g.tools).find(t => t.id === activeTool)?.label || activeTool : 'Nenhum'}</>
          )}
        </span>
        <span className="mx-3 text-gray-600">|</span>
        <span>
          📊 {features.features.length} geometria{features.features.length !== 1 ? 's' : ''}
          {selectedIndexes.length > 0 && (
            <span className="text-emerald-400 ml-1">({selectedIndexes.length} selecionada{selectedIndexes.length !== 1 ? 's' : ''})</span>
          )}
        </span>
        <span className="flex-1" />
        <span className="text-emerald-400">● Conectado</span>
        <span className="mx-3 text-gray-600">|</span>
        <a href="/" className="text-gray-400 hover:text-white">
          ← Voltar
        </a>
      </div>
    </div>
  );
}

export default FlexLayoutTest;
