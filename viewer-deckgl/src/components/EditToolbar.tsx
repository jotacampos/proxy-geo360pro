import { useRef } from 'react';
import { useStore } from '../store';
import type { EditModeType, SnapMode, BooleanOperation } from '../types';
import type { FeatureCollection } from 'geojson';

interface ToolButton {
  mode: EditModeType;
  icon: string;
  label: string;
  shortcut?: string;
  group?: 'nav' | 'select' | 'basic' | 'shapes' | 'transform' | 'composite' | 'measure';
}

const TOOLS: ToolButton[] = [
  // Navigation
  { mode: 'view', icon: '🖐️', label: 'Navegar', shortcut: 'V', group: 'nav' },
  { mode: 'select-snap-ref', icon: '🎯', label: 'Sel. Referência', shortcut: 'R', group: 'nav' },

  // Selection tools
  { mode: 'select-rectangle', icon: '⬚', label: 'Seleção Retângulo', group: 'select' },
  { mode: 'select-lasso', icon: '⭕', label: 'Seleção Laço', group: 'select' },

  // Basic drawing
  { mode: 'draw-point', icon: '📍', label: 'Ponto', shortcut: 'P', group: 'basic' },
  { mode: 'draw-line', icon: '📏', label: 'Linha', shortcut: 'L', group: 'basic' },
  { mode: 'draw-polygon', icon: '⬡', label: 'Polígono', shortcut: 'G', group: 'basic' },
  { mode: 'draw-lasso', icon: '〰️', label: 'Laço', group: 'basic' },
  { mode: 'extend-line', icon: '➡️', label: 'Estender Linha', group: 'basic' },

  // Shapes
  { mode: 'draw-rectangle', icon: '▭', label: 'Retângulo', shortcut: 'T', group: 'shapes' },
  { mode: 'draw-rectangle-center', icon: '⊞', label: 'Ret. Centro', group: 'shapes' },
  { mode: 'draw-rectangle-3pts', icon: '⊟', label: 'Ret. 3 Pontos', group: 'shapes' },
  { mode: 'draw-square', icon: '⬜', label: 'Quadrado', group: 'shapes' },
  { mode: 'draw-square-center', icon: '◻️', label: 'Quad. Centro', group: 'shapes' },
  { mode: 'draw-circle', icon: '⭕', label: 'Círculo', shortcut: 'C', group: 'shapes' },
  { mode: 'draw-circle-diameter', icon: '⊖', label: 'Círc. Diâmetro', group: 'shapes' },
  { mode: 'resize-circle', icon: '↔️', label: 'Redim. Círculo', group: 'shapes' },
  { mode: 'draw-ellipse', icon: '⬭', label: 'Elipse', group: 'shapes' },
  { mode: 'draw-ellipse-3pts', icon: '⬯', label: 'Elipse 3 Pontos', group: 'shapes' },
  { mode: 'draw-90deg-polygon', icon: '📐', label: 'Polígono 90°', group: 'shapes' },

  // Transform operations
  { mode: 'modify', icon: '✏️', label: 'Editar Vértices', shortcut: 'E', group: 'transform' },
  { mode: 'translate', icon: '↔️', label: 'Mover', shortcut: 'M', group: 'transform' },
  { mode: 'rotate', icon: '🔄', label: 'Rotacionar', group: 'transform' },
  { mode: 'scale', icon: '⤢', label: 'Escalar', group: 'transform' },
  { mode: 'extrude', icon: '↗️', label: 'Extrudar', group: 'transform' },
  { mode: 'elevation', icon: '⬆️', label: 'Elevação', group: 'transform' },
  { mode: 'transform', icon: '⧉', label: 'Transformar', group: 'transform' },
  { mode: 'split-polygon', icon: '✂️', label: 'Dividir', group: 'transform' },
  { mode: 'duplicate', icon: '📋', label: 'Duplicar', group: 'transform' },
  { mode: 'delete', icon: '🗑️', label: 'Excluir', shortcut: 'D', group: 'transform' },

  // Composite modes
  { mode: 'composite-draw-modify', icon: '🔀', label: 'Desenhar + Editar', group: 'composite' },

  // Measurement
  { mode: 'measure-distance', icon: '📏', label: 'Medir Distância', group: 'measure' },
  { mode: 'measure-area', icon: '📐', label: 'Medir Área', group: 'measure' },
  { mode: 'measure-angle', icon: '∠', label: 'Medir Ângulo', group: 'measure' },
];

// Boolean operation options
const BOOLEAN_OPS: { value: BooleanOperation; label: string; icon: string }[] = [
  { value: null, label: 'Nenhuma', icon: '○' },
  { value: 'union', label: 'União', icon: '∪' },
  { value: 'difference', label: 'Diferença', icon: '−' },
  { value: 'intersection', label: 'Interseção', icon: '∩' },
];

// Snap mode options
const SNAP_MODES: { mode: SnapMode; icon: string; label: string }[] = [
  { mode: 'vertex', icon: '⚫', label: 'Vértice' },
  { mode: 'edge', icon: '➖', label: 'Aresta' },
  { mode: 'both', icon: '⚫➖', label: 'Ambos' },
];

// Helper to get geometry type icon
function getGeometryIcon(type: string): string {
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

// Helper to get a short label for a feature
function getFeatureLabel(feature: any, index: number): string {
  // Try to get a meaningful name from properties
  const props = feature.properties || {};
  if (props.name) return props.name;
  if (props.id) return `ID: ${props.id}`;
  if (props.inscricao) return props.inscricao;
  if (feature.id) return `#${feature.id}`;
  return `Ref ${index + 1}`;
}

export default function EditToolbar() {
  const {
    editMode,
    setEditMode,
    features,
    selectedFeatureIndexes,
    modeConfig,
    setModeConfig,
    updateFeatures,
    selectFeature,
    copyFeatures,
    pasteFeatures,
    deleteSelectedFeatures,
    downloadGeoJSON,
    loadGeoJSON,
    snapEnabled,
    snapMode,
    snapPixels,
    toggleSnap,
    setSnapMode,
    setSnapPixels,
    snapReferenceFeatures,
    removeSnapReference,
    clearSnapReferences,
    snapGuidesEnabled,
    toggleSnapGuides,
  } = useStore();

  // File input ref for loading GeoJSON
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Handle file upload
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const geojson = JSON.parse(event.target?.result as string) as FeatureCollection;
        loadGeoJSON(geojson);
      } catch (error) {
        console.error('Error parsing GeoJSON:', error);
        alert('Erro ao carregar arquivo. Verifique se é um GeoJSON válido.');
      }
    };
    reader.readAsText(file);

    // Reset input so same file can be loaded again
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Handle keyboard shortcuts
  const handleKeyDown = (e: KeyboardEvent) => {
    // Ignore if typing in input
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
      return;
    }

    const key = e.key.toUpperCase();
    const tool = TOOLS.find((t) => t.shortcut === key);
    if (tool) {
      setEditMode(tool.mode);
    }

    // S to toggle snap
    if (key === 'S') {
      toggleSnap();
    }

    // Escape to cancel/deselect
    if (e.key === 'Escape') {
      setEditMode('view');
      selectFeature([]);
    }
  };

  // Add keyboard listener
  if (typeof window !== 'undefined') {
    window.removeEventListener('keydown', handleKeyDown);
    window.addEventListener('keydown', handleKeyDown);
  }

  // Clear all features
  const handleClearAll = () => {
    if (window.confirm('Limpar todas as geometrias desenhadas?')) {
      updateFeatures({
        type: 'FeatureCollection',
        features: [],
      });
      selectFeature([]);
    }
  };

  // Group tools by category
  const navTools = TOOLS.filter(t => t.group === 'nav');
  const selectTools = TOOLS.filter(t => t.group === 'select');
  const basicTools = TOOLS.filter(t => t.group === 'basic');
  const shapeTools = TOOLS.filter(t => t.group === 'shapes');
  const transformTools = TOOLS.filter(t => t.group === 'transform');
  const compositeTools = TOOLS.filter(t => t.group === 'composite');
  const measureTools = TOOLS.filter(t => t.group === 'measure');

  // Check if current mode supports polygon options
  const isPolygonMode = editMode === 'draw-polygon' || editMode === 'composite-draw-modify';

  const renderToolButton = (tool: ToolButton) => (
    <button
      key={tool.mode}
      onClick={() => setEditMode(tool.mode)}
      title={`${tool.label}${tool.shortcut ? ` (${tool.shortcut})` : ''}`}
      className={`
        flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm transition-all
        ${
          editMode === tool.mode
            ? 'bg-primary text-dark font-semibold'
            : 'hover:bg-gray-700 text-gray-300'
        }
      `}
    >
      <span className="text-base">{tool.icon}</span>
      <span className="text-xs">{tool.label}</span>
      {tool.shortcut && (
        <span className="ml-auto text-xs opacity-50">{tool.shortcut}</span>
      )}
    </button>
  );

  return (
    <div className="absolute top-4 left-4 z-10">
      {/* Main toolbar */}
      <div className="bg-secondary/95 rounded-lg shadow-xl p-2 flex flex-col gap-0.5 max-h-[calc(100vh-120px)] overflow-y-auto">
        {/* Navigation */}
        <div className="text-xs text-gray-500 px-2 pt-1">Navegação</div>
        {navTools.map(renderToolButton)}

        <div className="h-px bg-gray-700 my-1" />

        {/* Selection tools */}
        <div className="text-xs text-gray-500 px-2 pt-1">Seleção</div>
        {selectTools.map(renderToolButton)}

        <div className="h-px bg-gray-700 my-1" />

        {/* Basic drawing */}
        <div className="text-xs text-gray-500 px-2 pt-1">Desenho</div>
        {basicTools.map(renderToolButton)}

        <div className="h-px bg-gray-700 my-1" />

        {/* Shapes */}
        <div className="text-xs text-gray-500 px-2 pt-1">Formas</div>
        {shapeTools.map(renderToolButton)}

        <div className="h-px bg-gray-700 my-1" />

        {/* Transform operations */}
        <div className="text-xs text-gray-500 px-2 pt-1">Transformar</div>
        {transformTools.map(renderToolButton)}

        <div className="h-px bg-gray-700 my-1" />

        {/* Composite modes */}
        <div className="text-xs text-gray-500 px-2 pt-1">Composto</div>
        {compositeTools.map(renderToolButton)}

        <div className="h-px bg-gray-700 my-1" />

        {/* Measurement */}
        <div className="text-xs text-gray-500 px-2 pt-1">Medição</div>
        {measureTools.map(renderToolButton)}

        <div className="h-px bg-gray-700 my-1" />

        {/* Polygon mode options (when drawing polygons) */}
        {isPolygonMode && (
          <>
            <div className="text-xs text-gray-500 px-2 pt-1">Opções Polígono</div>
            <div className="px-3 py-2 space-y-2">
              {/* Allow holes */}
              <label className="flex items-center gap-2 text-xs text-gray-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={modeConfig.allowHoles ?? true}
                  onChange={(e) => setModeConfig({ allowHoles: e.target.checked })}
                  className="w-3.5 h-3.5 accent-primary"
                />
                <span>Permitir furos</span>
              </label>

              {/* Boolean operation */}
              <div className="space-y-1">
                <span className="text-xs text-gray-400">Operação Booleana</span>
                <div className="flex gap-1">
                  {BOOLEAN_OPS.map((op) => (
                    <button
                      key={op.value ?? 'none'}
                      onClick={() => setModeConfig({ booleanOperation: op.value })}
                      title={op.label}
                      className={`
                        flex-1 px-2 py-1 rounded text-xs transition-all
                        ${
                          modeConfig.booleanOperation === op.value
                            ? 'bg-primary text-dark font-semibold'
                            : 'bg-gray-700 hover:bg-gray-600 text-gray-300'
                        }
                      `}
                    >
                      {op.icon}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div className="h-px bg-gray-700 my-1" />
          </>
        )}

        {/* Snap toggle */}
        <button
          onClick={toggleSnap}
          title={`Snap aos vértices (S) - ${snapEnabled ? 'ATIVO' : 'desativado'}`}
          className={`
            flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-all
            ${
              snapEnabled
                ? 'bg-warning text-dark font-semibold'
                : 'hover:bg-gray-700 text-gray-400'
            }
          `}
        >
          <span className="text-lg">🧲</span>
          <span>Snap</span>
          <span className="ml-auto text-xs opacity-50">S</span>
        </button>

        {/* Snap controls (visible when snap is enabled) */}
        {snapEnabled && (
          <div className="px-3 py-2 space-y-2">
            {/* Snap mode selection */}
            <div className="space-y-1">
              <span className="text-xs text-gray-400">Modo</span>
              <div className="flex gap-1">
                {SNAP_MODES.map((mode) => (
                  <button
                    key={mode.mode}
                    onClick={() => setSnapMode(mode.mode)}
                    title={mode.label}
                    className={`
                      flex-1 px-2 py-1 rounded text-xs transition-all
                      ${
                        snapMode === mode.mode
                          ? 'bg-warning text-dark font-semibold'
                          : 'bg-gray-700 hover:bg-gray-600 text-gray-300'
                      }
                    `}
                  >
                    {mode.icon}
                  </button>
                ))}
              </div>
              <div className="text-center text-xs text-gray-500">
                {snapMode === 'vertex' && 'Somente vértices'}
                {snapMode === 'edge' && 'Somente arestas'}
                {snapMode === 'both' && 'Vértices e arestas'}
              </div>
            </div>

            {/* Snap distance */}
            <div className="space-y-1">
              <div className="flex items-center justify-between text-xs text-gray-400">
                <span>Distância</span>
                <span className="font-mono">{snapPixels}px</span>
              </div>
              <input
                type="range"
                min="1"
                max="50"
                value={snapPixels}
                onChange={(e) => setSnapPixels(Number(e.target.value))}
                className="w-full h-1.5 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-warning"
                title={`Distância de snap: ${snapPixels} pixels`}
              />
            </div>

            {/* Snap guides toggle */}
            <div className="space-y-1">
              <button
                onClick={toggleSnapGuides}
                title="Guias ortogonais durante o desenho"
                className={`
                  w-full flex items-center gap-2 px-2 py-1.5 rounded text-xs transition-all
                  ${
                    snapGuidesEnabled
                      ? 'bg-info/80 text-dark font-semibold'
                      : 'bg-gray-700 hover:bg-gray-600 text-gray-300'
                  }
                `}
              >
                <span>📐</span>
                <span>Guias Ortogonais</span>
                <span className="ml-auto text-xs opacity-70">{snapGuidesEnabled ? 'ON' : 'OFF'}</span>
              </button>
              <div className="text-center text-xs text-gray-500">
                {snapGuidesEnabled
                  ? 'Linhas de guia H/V durante desenho'
                  : 'Desativado'}
              </div>
            </div>

            {/* Snap reference list */}
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-400">
                  {snapReferenceFeatures.length} ref(s)
                </span>
                {snapReferenceFeatures.length > 0 && (
                  <button
                    onClick={clearSnapReferences}
                    className="text-xs text-danger hover:text-danger/80"
                    title="Limpar todas as referências"
                  >
                    Limpar
                  </button>
                )}
              </div>

              {/* List of selected references */}
              {snapReferenceFeatures.length > 0 && (
                <div className="max-h-32 overflow-y-auto space-y-1 mt-1">
                  {snapReferenceFeatures.map((feature, index) => (
                    <div
                      key={index}
                      className="flex items-center gap-1.5 bg-gray-700/50 rounded px-2 py-1 text-xs"
                    >
                      <span title={feature.geometry?.type || 'Geometry'}>
                        {getGeometryIcon(feature.geometry?.type || '')}
                      </span>
                      <span className="flex-1 truncate text-gray-300" title={getFeatureLabel(feature, index)}>
                        {getFeatureLabel(feature, index)}
                      </span>
                      <button
                        onClick={() => removeSnapReference(index)}
                        className="text-gray-500 hover:text-danger transition-colors"
                        title="Remover referência"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Divider */}
        <div className="h-px bg-gray-700 my-1" />

        {/* Feature count and selection */}
        <div className="px-3 py-1 text-xs text-gray-500">
          {features.features.length} geometria(s)
          {selectedFeatureIndexes.length > 0 && (
            <span className="text-primary ml-1">
              ({selectedFeatureIndexes.length} sel.)
            </span>
          )}
        </div>

        {/* Copy/Paste buttons (when features selected) */}
        {selectedFeatureIndexes.length > 0 && (
          <div className="flex gap-1 px-1">
            <button
              onClick={copyFeatures}
              title="Copiar selecionados (Ctrl+C)"
              className="flex-1 px-2 py-1.5 bg-gray-700 hover:bg-gray-600 text-white rounded text-xs transition-colors"
            >
              📋 Copiar
            </button>
            <button
              onClick={deleteSelectedFeatures}
              title="Excluir selecionados (Del)"
              className="flex-1 px-2 py-1.5 bg-danger/80 hover:bg-danger text-white rounded text-xs transition-colors"
            >
              🗑️ Excluir
            </button>
          </div>
        )}

        {/* Paste button */}
        <div className="flex gap-1 px-1">
          <button
            onClick={pasteFeatures}
            title="Colar (Ctrl+V)"
            className="flex-1 px-2 py-1.5 bg-gray-700 hover:bg-gray-600 text-white rounded text-xs transition-colors"
          >
            📥 Colar
          </button>
        </div>

        <div className="h-px bg-gray-700 my-1" />

        {/* File operations */}
        <div className="flex gap-1 px-1">
          <button
            onClick={downloadGeoJSON}
            disabled={features.features.length === 0}
            title="Baixar GeoJSON"
            className="flex-1 px-2 py-1.5 bg-gray-700 hover:bg-gray-600 text-white rounded text-xs disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            📤 Baixar
          </button>
          <button
            onClick={() => fileInputRef.current?.click()}
            title="Carregar GeoJSON"
            className="flex-1 px-2 py-1.5 bg-gray-700 hover:bg-gray-600 text-white rounded text-xs transition-colors"
          >
            📂 Carregar
          </button>
        </div>

        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          accept=".geojson,.json"
          onChange={handleFileUpload}
          className="hidden"
        />

        {/* Clear all button */}
        <div className="px-1">
          <button
            onClick={handleClearAll}
            disabled={features.features.length === 0}
            title="Limpar tudo"
            className="w-full px-2 py-1.5 bg-danger/80 hover:bg-danger text-white rounded text-xs disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            🗑️ Limpar Tudo
          </button>
        </div>
      </div>

      {/* Help text */}
      <div className="mt-2 bg-secondary/80 rounded-lg px-3 py-2 text-xs text-gray-400 max-w-[220px]">
        {/* Navigation */}
        {editMode === 'view' && 'Navegue pelo mapa. Clique nas camadas para ver atributos.'}
        {editMode === 'select-snap-ref' && 'Clique nas geometrias das camadas para usar como referência de snap.'}

        {/* Selection */}
        {editMode === 'select-rectangle' && 'Desenhe um retângulo para selecionar múltiplas geometrias.'}
        {editMode === 'select-lasso' && 'Desenhe um laço para selecionar múltiplas geometrias.'}

        {/* Composite modes */}
        {editMode === 'composite-draw-modify' && 'Desenhe polígonos e edite vértices simultaneamente.'}

        {/* Basic drawing */}
        {editMode === 'draw-point' && 'Clique no mapa para adicionar pontos.'}
        {editMode === 'draw-line' && 'Clique para adicionar vértices. Duplo-clique para finalizar.'}
        {editMode === 'draw-polygon' && 'Clique para adicionar vértices. Duplo-clique para fechar o polígono.'}
        {editMode === 'draw-lasso' && 'Arraste para desenhar um polígono livre (estilo laço).'}
        {editMode === 'extend-line' && 'Clique em uma linha existente para estendê-la.'}

        {/* Shapes */}
        {editMode === 'draw-rectangle' && 'Clique em dois cantos opostos para criar um retângulo.'}
        {editMode === 'draw-rectangle-center' && 'Clique no centro e arraste para um canto.'}
        {editMode === 'draw-rectangle-3pts' && 'Clique em 3 pontos para definir o retângulo.'}
        {editMode === 'draw-square' && 'Clique em dois cantos opostos para criar um quadrado.'}
        {editMode === 'draw-square-center' && 'Clique no centro e arraste para um canto.'}
        {editMode === 'draw-circle' && 'Clique no centro e arraste para definir o raio.'}
        {editMode === 'draw-circle-diameter' && 'Clique nas duas extremidades do diâmetro.'}
        {editMode === 'resize-circle' && 'Arraste a borda de um círculo para redimensioná-lo.'}
        {editMode === 'draw-ellipse' && 'Clique em dois cantos do retângulo delimitador.'}
        {editMode === 'draw-ellipse-3pts' && 'Clique em 3 pontos na borda da elipse.'}
        {editMode === 'draw-90deg-polygon' && 'Clique para adicionar vértices com ângulos de 90°.'}

        {/* Transform operations */}
        {editMode === 'modify' && 'Selecione e arraste vértices. Clique na aresta para adicionar.'}
        {editMode === 'translate' && 'Selecione e arraste para mover a geometria.'}
        {editMode === 'rotate' && 'Selecione e arraste para rotacionar ao redor do centro.'}
        {editMode === 'scale' && 'Selecione e arraste para escalar a geometria.'}
        {editMode === 'extrude' && 'Selecione e arraste uma aresta para extrudá-la.'}
        {editMode === 'elevation' && 'Arraste para cima/baixo para ajustar a elevação (3D).'}
        {editMode === 'transform' && 'Selecione para mover, rotacionar e escalar combinados.'}
        {editMode === 'split-polygon' && 'Desenhe uma linha sobre um polígono para dividi-lo.'}
        {editMode === 'duplicate' && 'Clique em uma geometria para criar uma cópia.'}
        {editMode === 'delete' && 'Clique em uma geometria para excluí-la.'}

        {/* Measurement */}
        {editMode === 'measure-distance' && 'Clique para medir distância entre pontos.'}
        {editMode === 'measure-area' && 'Clique para criar polígono e medir sua área.'}
        {editMode === 'measure-angle' && 'Clique em 3 pontos para medir o ângulo.'}

        {snapEnabled && (
          <div className="mt-1 text-warning font-medium">🧲 Snap ATIVO</div>
        )}
        {snapEnabled && snapGuidesEnabled && (
          <div className="mt-1 text-info font-medium">📐 Guias ATIVAS</div>
        )}
        <div className="mt-1 text-gray-500">ESC para cancelar</div>
      </div>
    </div>
  );
}
