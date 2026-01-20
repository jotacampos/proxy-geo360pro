import { useState, useEffect, useCallback } from 'react';
import { DraggablePanel } from '../ui/DraggablePanel';
import { useEditorStore, hexToRgba } from '../../stores';

// Drawing types based on old deck.gl viewer (EditToolbar.tsx)
type DrawingType =
  | 'draw-point' | 'draw-line' | 'draw-polygon' | 'draw-lasso' | 'extend-line'
  | 'draw-rectangle' | 'draw-rectangle-center' | 'draw-rectangle-3pts'
  | 'draw-square' | 'draw-square-center'
  | 'draw-circle' | 'draw-circle-diameter' | 'resize-circle'
  | 'draw-ellipse' | 'draw-ellipse-3pts' | 'draw-90deg-polygon';

interface DrawingPanelProps {
  isOpen: boolean;
  onClose: () => void;
  onDeactivate: () => void;
  drawingType: DrawingType;
}

interface DrawingOptions {
  snapEnabled: boolean;
  fillColor: string;
  strokeColor: string;
  strokeWidth: number;
  fillOpacity: number;
}

const DRAWING_LABELS: Record<DrawingType, string> = {
  'draw-point': 'Ponto',
  'draw-line': 'Linha',
  'draw-polygon': 'Polígono',
  'draw-lasso': 'Laço',
  'extend-line': 'Estender Linha',
  'draw-rectangle': 'Retângulo',
  'draw-rectangle-center': 'Retângulo Centro',
  'draw-rectangle-3pts': 'Retângulo 3 Pontos',
  'draw-square': 'Quadrado',
  'draw-square-center': 'Quadrado Centro',
  'draw-circle': 'Círculo',
  'draw-circle-diameter': 'Círculo Diâmetro',
  'resize-circle': 'Redimensionar Círculo',
  'draw-ellipse': 'Elipse',
  'draw-ellipse-3pts': 'Elipse 3 Pontos',
  'draw-90deg-polygon': 'Polígono 90°',
};

const DRAWING_ICONS: Record<DrawingType, string> = {
  'draw-point': '📍',
  'draw-line': '📏',
  'draw-polygon': '⬡',
  'draw-lasso': '〰️',
  'extend-line': '➡️',
  'draw-rectangle': '▭',
  'draw-rectangle-center': '⊞',
  'draw-rectangle-3pts': '⊟',
  'draw-square': '⬜',
  'draw-square-center': '◻️',
  'draw-circle': '⭕',
  'draw-circle-diameter': '⊖',
  'resize-circle': '↔️',
  'draw-ellipse': '⬭',
  'draw-ellipse-3pts': '⬯',
  'draw-90deg-polygon': '📐',
};

const DRAWING_HINTS: Record<DrawingType, string> = {
  'draw-point': 'Clique no mapa para definir a posição do ponto.',
  'draw-line': 'Clique no mapa para adicionar vértices. Duplo clique para finalizar.',
  'draw-polygon': 'Clique no mapa para adicionar vértices. Duplo clique para finalizar.',
  'draw-lasso': 'Clique no mapa para adicionar vértices. Duplo clique para finalizar.',
  'extend-line': 'Clique no mapa para definir ponto de extensão.',
  'draw-rectangle': 'Clique no mapa para o primeiro canto, depois para o segundo.',
  'draw-rectangle-center': 'Clique no mapa para o centro, depois para o canto.',
  'draw-rectangle-3pts': 'Clique no mapa para definir os 3 pontos.',
  'draw-square': 'Clique no mapa para o primeiro canto, depois para o segundo.',
  'draw-square-center': 'Clique no mapa para o centro, depois para o canto.',
  'draw-circle': 'Clique no mapa para o centro, depois para definir o raio.',
  'draw-circle-diameter': 'Clique no mapa para definir as extremidades do diâmetro.',
  'resize-circle': 'Clique no mapa para definir novo raio.',
  'draw-ellipse': 'Clique no mapa para o primeiro canto, depois para o segundo.',
  'draw-ellipse-3pts': 'Clique no mapa para definir os 3 pontos.',
  'draw-90deg-polygon': 'Clique no mapa para adicionar vértices. Duplo clique para finalizar.',
};

// Minimum vertices required for each type
const MIN_VERTICES: Record<DrawingType, number> = {
  'draw-point': 1,
  'draw-line': 2,
  'draw-polygon': 3,
  'draw-lasso': 3,
  'extend-line': 1,
  'draw-rectangle': 2,
  'draw-rectangle-center': 2,
  'draw-rectangle-3pts': 3,
  'draw-square': 2,
  'draw-square-center': 2,
  'draw-circle': 2,
  'draw-circle-diameter': 2,
  'resize-circle': 1,
  'draw-ellipse': 2,
  'draw-ellipse-3pts': 3,
  'draw-90deg-polygon': 3,
};

// Maximum vertices allowed for each type (null = unlimited)
const MAX_VERTICES: Record<DrawingType, number | null> = {
  'draw-point': 1,
  'draw-line': null, // unlimited
  'draw-polygon': null, // unlimited
  'draw-lasso': null, // unlimited
  'extend-line': 1,
  'draw-rectangle': 2,
  'draw-rectangle-center': 2,
  'draw-rectangle-3pts': 3,
  'draw-square': 2,
  'draw-square-center': 2,
  'draw-circle': 2,
  'draw-circle-diameter': 2,
  'resize-circle': 1,
  'draw-ellipse': 2,
  'draw-ellipse-3pts': 3,
  'draw-90deg-polygon': null, // unlimited
};

// Types that allow adding multiple vertices
const MULTI_VERTEX_TYPES: DrawingType[] = [
  'draw-line',
  'draw-polygon',
  'draw-lasso',
  'draw-90deg-polygon',
];

// Types that have fill (polygons, closed shapes)
const FILL_TYPES: DrawingType[] = [
  'draw-polygon', 'draw-lasso',
  'draw-rectangle', 'draw-rectangle-center', 'draw-rectangle-3pts',
  'draw-square', 'draw-square-center',
  'draw-circle', 'draw-circle-diameter', 'resize-circle',
  'draw-ellipse', 'draw-ellipse-3pts', 'draw-90deg-polygon'
];

const COLOR_PRESETS = [
  '#3B82F6', '#10B981', '#F59E0B', '#EF4444',
  '#8B5CF6', '#EC4899', '#06B6D4', '#84CC16',
];

export function DrawingPanel({ isOpen, onClose, onDeactivate, drawingType }: DrawingPanelProps) {
  const [options, setOptions] = useState<DrawingOptions>({
    snapEnabled: true,
    fillColor: '#3B82F6',
    strokeColor: '#1E40AF',
    strokeWidth: 2,
    fillOpacity: 50,
  });

  const [showStyleOptions, setShowStyleOptions] = useState(false);

  // Editor store
  const {
    drawingCoordinates,
    lastClickCoordinate,
    isDrawing,
    setDrawingStyle,
    setSnapEnabled,
    updateDrawingCoordinate,
    removeDrawingCoordinate,
    clearDrawingCoordinates,
    finishDrawing,
    setIsDrawing,
    silentMode,
    setSilentMode,
    activeVertexIndex,
    setActiveVertexIndex,
  } = useEditorStore();

  // Apply style when panel opens (mode and isDrawing are set by AppLayout)
  useEffect(() => {
    if (isOpen && drawingType) {
      // Apply style only - don't clear coordinates (they come from map click)
      setDrawingStyle({
        fillColor: hexToRgba(options.fillColor, Math.round(options.fillOpacity * 2.55)),
        strokeColor: hexToRgba(options.strokeColor),
        strokeWidth: options.strokeWidth,
      });
      setSnapEnabled(options.snapEnabled);
    }
  }, [isOpen, drawingType]);

  // Update style when options change
  useEffect(() => {
    if (isDrawing) {
      setDrawingStyle({
        fillColor: hexToRgba(options.fillColor, Math.round(options.fillOpacity * 2.55)),
        strokeColor: hexToRgba(options.strokeColor),
        strokeWidth: options.strokeWidth,
      });
      setSnapEnabled(options.snapEnabled);
    }
  }, [options, isDrawing]);

  // Handle cancel (deactivates the tool)
  const handleCancel = useCallback(() => {
    clearDrawingCoordinates();
    setIsDrawing(false);
    onDeactivate();
  }, [clearDrawingCoordinates, setIsDrawing, onDeactivate]);

  // Handle finish drawing (keeps tool active for more drawings)
  const handleFinish = useCallback(() => {
    if (drawingCoordinates.length >= MIN_VERTICES[drawingType]) {
      finishDrawing();
      // Close panel but keep tool active
      // User can click on map to create more features
      onClose();
    }
  }, [drawingCoordinates.length, drawingType, finishDrawing, onClose]);

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;

      if (e.key === 'Enter' && !e.shiftKey && document.activeElement?.tagName !== 'INPUT') {
        // Finish drawing
        if (drawingCoordinates.length >= MIN_VERTICES[drawingType]) {
          handleFinish();
        }
      } else if (e.key === 'Escape') {
        handleCancel();
      } else if (e.key === 'Backspace' && document.activeElement?.tagName !== 'INPUT') {
        // Remove last coordinate
        if (drawingCoordinates.length > 0) {
          removeDrawingCoordinate(drawingCoordinates.length - 1);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, drawingCoordinates, drawingType, handleFinish, handleCancel, removeDrawingCoordinate]);

  if (!isOpen) return null;

  const canFinish = drawingCoordinates.length >= MIN_VERTICES[drawingType];
  const verticesNeeded = MIN_VERTICES[drawingType] - drawingCoordinates.length;

  return (
    <DraggablePanel
      title={`${DRAWING_ICONS[drawingType]} ${DRAWING_LABELS[drawingType]}`}
      onClose={handleCancel}
      initialPosition={{ x: 16, y: 64 }}
      minWidth={320}
    >
      {/* Status */}
      <div className="px-3 py-2 bg-emerald-900/30 border-b border-gray-700">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-xs text-emerald-400">Desenhando...</span>
        </div>
        <p className="text-xs text-gray-400 mt-1">{DRAWING_HINTS[drawingType]}</p>
      </div>

      {/* Last click coordinate */}
      {lastClickCoordinate && (
        <div className="px-3 py-2 bg-gray-800/50 border-b border-gray-700">
          <div className="text-xs text-gray-400 mb-1">Último clique:</div>
          <div className="font-mono text-sm text-white">
            {lastClickCoordinate[0].toFixed(6)}, {lastClickCoordinate[1].toFixed(6)}
          </div>
        </div>
      )}

      {/* Coordinates list */}
      <div className="px-3 py-2 border-b border-gray-700">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs text-gray-400">
            Vértices ({drawingCoordinates.length}/{MAX_VERTICES[drawingType] ?? '∞'})
          </span>
          {drawingCoordinates.length > 0 && (
            <button
              onClick={clearDrawingCoordinates}
              className="text-xs text-red-400 hover:text-red-300"
            >
              Limpar
            </button>
          )}
        </div>

        {/* Vertex list */}
        <div className="max-h-32 overflow-y-auto space-y-1">
          {drawingCoordinates.length === 0 ? (
            <div className="text-xs text-gray-500 text-center py-2">
              Clique no mapa para posicionar o primeiro vértice
            </div>
          ) : (
            drawingCoordinates.map((coord, index) => (
              <CoordinateRow
                key={index}
                index={index}
                coordinate={coord}
                onUpdate={(newCoord) => updateDrawingCoordinate(index, newCoord)}
                onRemove={() => {
                  removeDrawingCoordinate(index);
                  // Adjust active index if needed
                  if (activeVertexIndex === index) {
                    setActiveVertexIndex(null);
                  } else if (activeVertexIndex !== null && activeVertexIndex > index) {
                    setActiveVertexIndex(activeVertexIndex - 1);
                  }
                }}
                isActive={activeVertexIndex === index}
                onSelect={() => setActiveVertexIndex(index)}
              />
            ))
          )}
        </div>

        {/* Mode indicator for multi-vertex types */}
        {MULTI_VERTEX_TYPES.includes(drawingType) && drawingCoordinates.length > 0 && (
          <div className="flex items-center justify-between mt-2 px-1">
            <span className="text-[10px] text-gray-400">
              {activeVertexIndex !== null
                ? `Editando vértice ${activeVertexIndex + 1} - clique no mapa para reposicionar`
                : 'Clique no mapa para adicionar vértices'
              }
            </span>
            {activeVertexIndex !== null && (
              <button
                onClick={() => setActiveVertexIndex(null)}
                className="text-[10px] text-blue-400 hover:text-blue-300"
              >
                Modo adicionar
              </button>
            )}
          </div>
        )}

        {/* Status message */}
        {!canFinish && drawingCoordinates.length > 0 && (
          <div className="text-xs text-amber-400 mt-2">
            {MULTI_VERTEX_TYPES.includes(drawingType)
              ? `Adicione mais ${verticesNeeded} vértice${verticesNeeded > 1 ? 's' : ''} para finalizar`
              : `Clique no mapa para definir o próximo ponto (faltam ${verticesNeeded})`
            }
          </div>
        )}
      </div>

      {/* Style options (collapsible) */}
      <div className="border-b border-gray-700">
        <button
          onClick={() => setShowStyleOptions(!showStyleOptions)}
          className="w-full px-3 py-2 flex items-center justify-between text-xs text-gray-400 hover:text-white hover:bg-gray-800/50"
        >
          <span>Opções de estilo</span>
          <span>{showStyleOptions ? '▲' : '▼'}</span>
        </button>

        {showStyleOptions && (
          <div className="px-3 pb-3 space-y-3">
            {/* Snap toggle */}
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={options.snapEnabled}
                onChange={(e) => setOptions({ ...options, snapEnabled: e.target.checked })}
                className="w-4 h-4 rounded bg-gray-700 border-gray-600 text-emerald-500 focus:ring-emerald-500"
              />
              <span className="text-xs text-gray-300">Snap habilitado</span>
            </label>

            {/* Fill color (for polygon types) */}
            {FILL_TYPES.includes(drawingType) && (
              <div>
                <label className="block text-xs text-gray-400 mb-1">Preenchimento</label>
                <div className="flex flex-wrap gap-1">
                  {COLOR_PRESETS.map((color) => (
                    <button
                      key={color}
                      onClick={() => setOptions({ ...options, fillColor: color })}
                      className={`w-5 h-5 rounded border ${
                        options.fillColor === color ? 'border-white' : 'border-transparent'
                      }`}
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Stroke color */}
            <div>
              <label className="block text-xs text-gray-400 mb-1">Borda</label>
              <div className="flex flex-wrap gap-1">
                {COLOR_PRESETS.map((color) => (
                  <button
                    key={color}
                    onClick={() => setOptions({ ...options, strokeColor: color })}
                    className={`w-5 h-5 rounded border ${
                      options.strokeColor === color ? 'border-white' : 'border-transparent'
                    }`}
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>
            </div>

            {/* Stroke width */}
            <div>
              <label className="block text-xs text-gray-400 mb-1">
                Espessura: {options.strokeWidth}px
              </label>
              <input
                type="range"
                min="1"
                max="10"
                value={options.strokeWidth}
                onChange={(e) => setOptions({ ...options, strokeWidth: Number(e.target.value) })}
                className="w-full h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-emerald-500"
              />
            </div>

            {/* Fill opacity */}
            {FILL_TYPES.includes(drawingType) && (
              <div>
                <label className="block text-xs text-gray-400 mb-1">
                  Opacidade: {options.fillOpacity}%
                </label>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={options.fillOpacity}
                  onChange={(e) => setOptions({ ...options, fillOpacity: Number(e.target.value) })}
                  className="w-full h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                />
              </div>
            )}
          </div>
        )}
      </div>

      {/* Silent mode option - only for point creation */}
      {drawingType === 'draw-point' && (
        <div className="px-3 py-2 border-b border-gray-700">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={silentMode}
              onChange={(e) => setSilentMode(e.target.checked)}
              className="w-4 h-4 rounded bg-gray-700 border-gray-600 text-emerald-500 focus:ring-emerald-500"
            />
            <span className="text-xs text-gray-300">Não exibir esta janela novamente</span>
          </label>
          <p className="text-[10px] text-gray-500 mt-1 ml-6">
            Clique na ferramenta novamente para reativar
          </p>
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-2 px-3 py-2">
        <button
          onClick={handleCancel}
          className="flex-1 px-3 py-1.5 bg-gray-700 hover:bg-gray-600 rounded text-sm text-gray-300"
        >
          Cancelar
        </button>
        <button
          onClick={handleFinish}
          disabled={!canFinish}
          className="flex-1 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 disabled:bg-gray-700 disabled:text-gray-500 rounded text-sm text-white"
        >
          Finalizar (Enter)
        </button>
      </div>

      {/* Keyboard hints */}
      <div className="px-3 py-1.5 bg-gray-800/50 text-[10px] text-gray-500">
        {MULTI_VERTEX_TYPES.includes(drawingType) && (
          <span className="mr-3">Duplo clique: finalizar</span>
        )}
        <span className="mr-3">Enter: finalizar</span>
        <span className="mr-3">Backspace: remover último</span>
        <span>Esc: cancelar</span>
      </div>
    </DraggablePanel>
  );
}

// Coordinate row component with inline editing
function CoordinateRow({
  index,
  coordinate,
  onUpdate,
  onRemove,
  isActive,
  onSelect,
}: {
  index: number;
  coordinate: [number, number];
  onUpdate: (coord: [number, number]) => void;
  onRemove: () => void;
  isActive: boolean;
  onSelect: () => void;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [editLon, setEditLon] = useState(coordinate[0].toString());
  const [editLat, setEditLat] = useState(coordinate[1].toString());

  // Update local state when coordinate prop changes (from map clicks)
  useEffect(() => {
    if (!isEditing) {
      setEditLon(coordinate[0].toString());
      setEditLat(coordinate[1].toString());
    }
  }, [coordinate, isEditing]);

  const handleSave = () => {
    const lon = parseFloat(editLon);
    const lat = parseFloat(editLat);
    if (!isNaN(lon) && !isNaN(lat)) {
      onUpdate([lon, lat]);
    }
    setIsEditing(false);
  };

  const handleCancel = () => {
    setEditLon(coordinate[0].toString());
    setEditLat(coordinate[1].toString());
    setIsEditing(false);
  };

  if (isEditing) {
    return (
      <div className="flex items-center gap-1 bg-gray-800 rounded p-1">
        <span className="text-[10px] text-gray-500 w-4">{index + 1}.</span>
        <input
          type="text"
          value={editLon}
          onChange={(e) => setEditLon(e.target.value)}
          className="flex-1 px-1 py-0.5 bg-gray-700 border border-gray-600 rounded text-[10px] font-mono text-white focus:outline-none focus:border-emerald-500"
          autoFocus
        />
        <input
          type="text"
          value={editLat}
          onChange={(e) => setEditLat(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleSave();
            if (e.key === 'Escape') handleCancel();
          }}
          className="flex-1 px-1 py-0.5 bg-gray-700 border border-gray-600 rounded text-[10px] font-mono text-white focus:outline-none focus:border-emerald-500"
        />
        <button onClick={handleSave} className="text-emerald-400 hover:text-emerald-300 text-xs px-1">✓</button>
        <button onClick={handleCancel} className="text-gray-400 hover:text-gray-300 text-xs px-1">✕</button>
      </div>
    );
  }

  return (
    <div className={`flex items-center gap-1 group rounded px-1 py-0.5 cursor-pointer ${
      isActive
        ? 'bg-emerald-900/30 border border-emerald-700/50'
        : 'hover:bg-gray-800/50'
    }`}
    onClick={onSelect}
    title="Clique para selecionar este vértice"
    >
      <span className={`text-[10px] w-4 ${isActive ? 'text-emerald-400' : 'text-gray-500'}`}>
        {index + 1}.
      </span>
      <span
        className={`flex-1 font-mono text-[11px] ${
          isActive ? 'text-emerald-300' : 'text-gray-300'
        }`}
      >
        {coordinate[0].toFixed(6)}, {coordinate[1].toFixed(6)}
      </span>
      {isActive && (
        <span className="text-[9px] text-emerald-400 mr-1">
          ativo
        </span>
      )}
      <button
        onClick={(e) => {
          e.stopPropagation();
          setIsEditing(true);
        }}
        className="opacity-0 group-hover:opacity-100 text-blue-400 hover:text-blue-300 text-xs px-1"
        title="Editar coordenadas"
      >
        ✎
      </button>
      <button
        onClick={(e) => {
          e.stopPropagation();
          onRemove();
        }}
        className="opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-300 text-xs px-1"
        title="Remover"
      >
        ✕
      </button>
    </div>
  );
}
