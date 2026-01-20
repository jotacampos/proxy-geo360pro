import { useState } from 'react';
import { ChevronRight, ChevronLeft, X, Pencil, Move, RotateCw, Maximize2, Copy, Trash2, Scissors, Merge, Circle } from 'lucide-react';
import { useStore } from '../../../store';

interface SelectionPanelProps {
  onToggleCollapse: () => void;
}

// Helper para obter ícone do tipo de geometria
function getGeomIcon(type: string): string {
  switch (type) {
    case 'Point':
    case 'MultiPoint':
      return '📍';
    case 'LineString':
    case 'MultiLineString':
      return '📏';
    case 'Polygon':
    case 'MultiPolygon':
      return '⬡';
    default:
      return '📐';
  }
}

// Helper para calcular área de polígono (simplificado)
function calculateArea(coordinates: number[][][]): number {
  if (!coordinates || !coordinates[0]) return 0;
  const ring = coordinates[0];
  let area = 0;
  for (let i = 0; i < ring.length - 1; i++) {
    area += ring[i][0] * ring[i + 1][1];
    area -= ring[i + 1][0] * ring[i][1];
  }
  return Math.abs(area / 2) * 111319.9 * 111319.9; // Aproximação para m²
}

export function SelectionPanel({ onToggleCollapse }: SelectionPanelProps) {
  const {
    features,
    selectedFeatureIndexes,
    selectFeature,
    editMode,
    setEditMode,
    deleteSelectedFeatures,
    copyFeatures,
    history,
    revertHistoryEntry,
  } = useStore();

  const [activeDetailIndex, setActiveDetailIndex] = useState(0);

  // Detectar se está em modo de desenho
  const isDrawing = editMode.startsWith('draw-') || editMode === 'measure-distance' || editMode === 'measure-area' || editMode === 'measure-angle';

  // Features selecionadas
  const selectedFeatures = selectedFeatureIndexes.map(i => features.features[i]).filter(Boolean);
  const hasSelection = selectedFeatures.length > 0;

  // Feature ativa para detalhes
  const activeFeature = selectedFeatures[activeDetailIndex] || selectedFeatures[0];

  // Contagem por tipo de geometria
  const polygonCount = selectedFeatures.filter(f => f.geometry?.type === 'Polygon' || f.geometry?.type === 'MultiPolygon').length;

  // Painel colapsado - apenas ícone
  if (!hasSelection && !isDrawing) {
    return (
      <div className="h-full bg-secondary flex flex-col items-center py-2 w-full">
        <button
          onClick={onToggleCollapse}
          className="p-2 hover:bg-gray-700 rounded transition-colors"
          title="Expandir painel de seleção"
        >
          <ChevronRight size={16} />
        </button>
        <div className="mt-4 text-xs text-gray-500 writing-vertical">
          SELEÇÃO
        </div>
      </div>
    );
  }

  // Durante desenho - mostra info do desenho
  if (isDrawing && !hasSelection) {
    const modeLabels: Record<string, string> = {
      'draw-point': 'Ponto',
      'draw-line': 'Linha',
      'draw-polygon': 'Polígono',
      'draw-rectangle': 'Retângulo',
      'draw-circle': 'Círculo',
      'draw-ellipse': 'Elipse',
      'draw-lasso': 'Laço',
      'measure-distance': 'Medir Distância',
      'measure-area': 'Medir Área',
      'measure-angle': 'Medir Ângulo',
    };

    return (
      <div className="h-full bg-secondary flex flex-col overflow-hidden">
        {/* Header */}
        <div className="p-3 border-b border-gray-700 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ChevronRight size={14} className="text-primary" />
            <span className="font-semibold text-sm">DESENHANDO</span>
          </div>
          <button
            onClick={() => setEditMode('view')}
            className="text-gray-400 hover:text-white p-1"
            title="Cancelar"
          >
            <X size={14} />
          </button>
        </div>

        {/* Info do desenho */}
        <div className="p-3">
          <div className="bg-gray-800 rounded-lg p-3">
            <div className="text-primary font-medium mb-2">
              {modeLabels[editMode] || editMode}
            </div>
            <div className="text-xs text-gray-400 space-y-1">
              <div>Clique para adicionar pontos</div>
              <div>Duplo-clique para finalizar</div>
              <div>ESC para cancelar</div>
            </div>
          </div>
        </div>

        {/* Botões */}
        <div className="p-3 border-t border-gray-700 mt-auto">
          <button
            onClick={() => setEditMode('view')}
            className="w-full px-3 py-2 bg-gray-700 hover:bg-gray-600 rounded text-sm transition-colors"
          >
            Cancelar
          </button>
        </div>
      </div>
    );
  }

  // Painel expandido com seleção
  return (
    <div className="h-full bg-secondary flex flex-col overflow-hidden">
      {/* Header */}
      <div className="p-3 border-b border-gray-700 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-2">
          <ChevronRight size={14} className="text-primary" />
          <span className="font-semibold text-sm">SELEÇÃO</span>
          <span className="text-xs bg-primary text-dark px-1.5 py-0.5 rounded">
            {selectedFeatures.length}
          </span>
        </div>
        <button
          onClick={onToggleCollapse}
          className="text-gray-400 hover:text-white p-1"
          title="Colapsar"
        >
          <ChevronLeft size={14} />
        </button>
      </div>

      {/* Conteúdo com scroll */}
      <div className="flex-1 overflow-y-auto">
        {/* Lista de selecionados */}
        <div className="p-3 border-b border-gray-700">
          <div className="text-xs text-gray-500 mb-2 uppercase tracking-wider">
            Objetos Selecionados
          </div>
          <div className="space-y-1 max-h-32 overflow-y-auto">
            {selectedFeatures.map((feature, idx) => {
              const geomType = feature.geometry?.type || 'Unknown';
              const featureIdx = selectedFeatureIndexes[idx];
              const isActive = idx === activeDetailIndex;
              const props = feature.properties || {};
              const label = props.name || props.id || props.inscricao || `#${featureIdx + 1}`;

              return (
                <div
                  key={featureIdx}
                  onClick={() => setActiveDetailIndex(idx)}
                  className={`
                    flex items-center gap-2 px-2 py-1.5 rounded cursor-pointer text-sm
                    ${isActive ? 'bg-primary/20 text-primary' : 'hover:bg-gray-700 text-gray-300'}
                  `}
                >
                  <span>{getGeomIcon(geomType)}</span>
                  <span className="flex-1 truncate">{label}</span>
                  <span className="text-xs text-gray-500">{geomType}</span>
                </div>
              );
            })}
          </div>

          {/* Ações de seleção */}
          <div className="flex gap-1 mt-2">
            <button
              onClick={() => selectFeature([])}
              className="flex-1 px-2 py-1 text-xs bg-gray-700 hover:bg-gray-600 rounded transition-colors"
            >
              Limpar
            </button>
            <button
              onClick={() => {
                // Zoom to selection - TODO: implementar
              }}
              className="flex-1 px-2 py-1 text-xs bg-gray-700 hover:bg-gray-600 rounded transition-colors"
            >
              Zoom
            </button>
          </div>
        </div>

        {/* Detalhes do objeto ativo */}
        {activeFeature && (
          <div className="p-3 border-b border-gray-700">
            <div className="flex items-center justify-between mb-2">
              <div className="text-xs text-gray-500 uppercase tracking-wider">
                Detalhes
              </div>
              {selectedFeatures.length > 1 && (
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setActiveDetailIndex(Math.max(0, activeDetailIndex - 1))}
                    disabled={activeDetailIndex === 0}
                    className="p-1 text-gray-400 hover:text-white disabled:opacity-30"
                  >
                    ◀
                  </button>
                  <span className="text-xs text-gray-500">
                    {activeDetailIndex + 1}/{selectedFeatures.length}
                  </span>
                  <button
                    onClick={() => setActiveDetailIndex(Math.min(selectedFeatures.length - 1, activeDetailIndex + 1))}
                    disabled={activeDetailIndex === selectedFeatures.length - 1}
                    className="p-1 text-gray-400 hover:text-white disabled:opacity-30"
                  >
                    ▶
                  </button>
                </div>
              )}
            </div>

            <div className="bg-gray-800 rounded-lg p-2 text-xs">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-lg">{getGeomIcon(activeFeature.geometry?.type || '')}</span>
                <span className="text-primary font-medium">
                  {activeFeature.geometry?.type}
                </span>
              </div>

              {/* Métricas */}
              {activeFeature.geometry?.type === 'Polygon' && (
                <div className="space-y-1 text-gray-400">
                  <div>Vértices: {(activeFeature.geometry as any).coordinates?.[0]?.length - 1 || 0}</div>
                  <div>Área: {calculateArea((activeFeature.geometry as any).coordinates).toFixed(2)} m²</div>
                </div>
              )}

              {/* Atributos */}
              {activeFeature.properties && Object.keys(activeFeature.properties).length > 0 && (
                <div className="mt-2 pt-2 border-t border-gray-700">
                  <div className="text-gray-500 mb-1">Atributos:</div>
                  {Object.entries(activeFeature.properties).slice(0, 5).map(([key, value]) => (
                    <div key={key} className="flex justify-between">
                      <span className="text-gray-500">{key}:</span>
                      <span className="text-gray-300 truncate ml-2">{String(value)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Ferramentas de Edição */}
        <div className="p-3 border-b border-gray-700">
          <div className="text-xs text-gray-500 mb-2 uppercase tracking-wider flex items-center gap-2">
            Edição
            <span className="text-green-500">🔓</span>
          </div>
          <div className="grid grid-cols-3 gap-1">
            <button
              onClick={() => setEditMode('modify')}
              className={`p-2 rounded text-xs flex flex-col items-center gap-1 transition-colors ${
                editMode === 'modify' ? 'bg-primary text-dark' : 'bg-gray-700 hover:bg-gray-600'
              }`}
              title="Editar vértices (E)"
            >
              <Pencil size={16} />
              <span>Editar</span>
            </button>
            <button
              onClick={() => setEditMode('translate')}
              className={`p-2 rounded text-xs flex flex-col items-center gap-1 transition-colors ${
                editMode === 'translate' ? 'bg-primary text-dark' : 'bg-gray-700 hover:bg-gray-600'
              }`}
              title="Mover (M)"
            >
              <Move size={16} />
              <span>Mover</span>
            </button>
            <button
              onClick={() => setEditMode('rotate')}
              className={`p-2 rounded text-xs flex flex-col items-center gap-1 transition-colors ${
                editMode === 'rotate' ? 'bg-primary text-dark' : 'bg-gray-700 hover:bg-gray-600'
              }`}
              title="Rotacionar"
            >
              <RotateCw size={16} />
              <span>Rotar</span>
            </button>
            <button
              onClick={() => setEditMode('scale')}
              className={`p-2 rounded text-xs flex flex-col items-center gap-1 transition-colors ${
                editMode === 'scale' ? 'bg-primary text-dark' : 'bg-gray-700 hover:bg-gray-600'
              }`}
              title="Escalar"
            >
              <Maximize2 size={16} />
              <span>Escalar</span>
            </button>
            <button
              onClick={copyFeatures}
              className="p-2 rounded text-xs flex flex-col items-center gap-1 bg-gray-700 hover:bg-gray-600 transition-colors"
              title="Duplicar (Ctrl+D)"
            >
              <Copy size={16} />
              <span>Copiar</span>
            </button>
            <button
              onClick={deleteSelectedFeatures}
              className="p-2 rounded text-xs flex flex-col items-center gap-1 bg-danger/80 hover:bg-danger transition-colors"
              title="Excluir (Delete)"
            >
              <Trash2 size={16} />
              <span>Excluir</span>
            </button>
          </div>
        </div>

        {/* Operações Espaciais */}
        <div className="p-3 border-b border-gray-700">
          <div className="text-xs text-gray-500 mb-2 uppercase tracking-wider">
            Operações
          </div>
          <div className="space-y-1">
            <button
              onClick={() => setEditMode('split-polygon')}
              disabled={polygonCount !== 1}
              className={`w-full px-3 py-2 rounded text-xs text-left flex items-center gap-2 transition-colors ${
                polygonCount === 1 ? 'bg-gray-700 hover:bg-gray-600' : 'bg-gray-800 text-gray-600 cursor-not-allowed'
              }`}
              title="Requer 1 polígono selecionado"
            >
              <Scissors size={14} />
              <span>Cortar</span>
              <span className="ml-auto text-gray-500">(1 pol.)</span>
            </button>
            <button
              disabled={polygonCount < 2}
              className={`w-full px-3 py-2 rounded text-xs text-left flex items-center gap-2 transition-colors ${
                polygonCount >= 2 ? 'bg-gray-700 hover:bg-gray-600' : 'bg-gray-800 text-gray-600 cursor-not-allowed'
              }`}
              title="Requer 2+ polígonos selecionados"
            >
              <Merge size={14} />
              <span>Unir</span>
              <span className="ml-auto text-gray-500">(2+ pol.)</span>
            </button>
            <button
              className="w-full px-3 py-2 rounded text-xs text-left flex items-center gap-2 bg-gray-700 hover:bg-gray-600 transition-colors"
              title="Criar buffer ao redor da seleção"
            >
              <Circle size={14} />
              <span>Buffer</span>
            </button>
          </div>
        </div>

        {/* Histórico */}
        <div className="p-3">
          <div className="text-xs text-gray-500 mb-2 uppercase tracking-wider">
            Histórico
          </div>
          {history.length === 0 ? (
            <div className="text-xs text-gray-600 text-center py-2">
              Nenhuma operação
            </div>
          ) : (
            <div className="space-y-1 max-h-32 overflow-y-auto">
              {history.slice(0, 5).map((entry, idx) => (
                <div
                  key={entry.id}
                  className={`
                    flex items-center gap-2 px-2 py-1.5 rounded text-xs
                    ${entry.isReverted ? 'bg-gray-800 text-gray-600 line-through' : 'bg-gray-700 text-gray-300'}
                  `}
                >
                  <span className={`w-2 h-2 rounded-full ${idx === 0 && !entry.isReverted ? 'bg-primary' : 'bg-gray-600'}`} />
                  <span className="flex-1 truncate">{entry.description}</span>
                  {!entry.isReverted && (
                    <button
                      onClick={() => revertHistoryEntry(entry.id)}
                      className="text-gray-500 hover:text-primary text-xs"
                    >
                      ↩
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
