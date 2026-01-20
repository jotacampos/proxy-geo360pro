import type { RibbonTab } from './CompactRibbon';

interface ToolButton {
  id: string;
  icon: string;
  label: string;
  shortcut?: string;
  disabled?: boolean;
  separator?: boolean; // Separador visual após este item
}

// Ferramentas baseadas no viewer-deckgl antigo, reorganizadas
const TOOLS: Record<RibbonTab, ToolButton[]> = {
  selecao: [
    { id: 'select-single', icon: '👆', label: 'Simples' },
    { id: 'select-multi', icon: '👆+', label: 'Múltipla', separator: true },
    { id: 'select-rectangle', icon: '⬚', label: 'Retângulo' },
    { id: 'select-lasso', icon: '⭕', label: 'Laço' },
  ],
  criar: [
    // Básico
    { id: 'draw-point', icon: '📍', label: 'Ponto', shortcut: 'P' },
    { id: 'draw-line', icon: '📏', label: 'Linha', shortcut: 'L' },
    { id: 'draw-polygon', icon: '⬡', label: 'Polígono', shortcut: 'G' },
    { id: 'draw-lasso', icon: '〰️', label: 'Laço', separator: true },
    // Retângulos
    { id: 'draw-rectangle', icon: '▭', label: 'Retângulo', shortcut: 'T' },
    { id: 'draw-square', icon: '⬜', label: 'Quadrado' },
    { id: 'draw-rectangle-3pts', icon: '⊟', label: '3 Pontos', separator: true },
    // Círculos
    { id: 'draw-circle', icon: '⭕', label: 'Círculo', shortcut: 'C' },
    { id: 'draw-ellipse', icon: '⬭', label: 'Elipse', separator: true },
    // Especial
    { id: 'draw-90deg-polygon', icon: '📐', label: '90°' },
    { id: 'extend-line', icon: '➡️', label: 'Estender' },
  ],
  editar: [
    // Geometria
    { id: 'modify', icon: '✏️', label: 'Vértices', shortcut: 'E' },
    { id: 'split-polygon', icon: '✂️', label: 'Dividir' },
    { id: 'extrude', icon: '↗️', label: 'Extrudar', separator: true },
    // Transformar
    { id: 'translate', icon: '↔️', label: 'Mover', shortcut: 'M' },
    { id: 'rotate', icon: '🔄', label: 'Rotacionar' },
    { id: 'scale', icon: '⤢', label: 'Escalar' },
    { id: 'transform', icon: '⧉', label: 'Livre', separator: true },
    // Ações
    { id: 'duplicate', icon: '📋', label: 'Duplicar' },
    { id: 'composite-draw-modify', icon: '🔀', label: 'Composto' },
    { id: 'delete', icon: '🗑️', label: 'Excluir', shortcut: 'D' },
  ],
  analise: [
    // Operações Espaciais
    { id: 'buffer', icon: '⭕', label: 'Buffer' },
    { id: 'union', icon: '🔗', label: 'Unir' },
    { id: 'intersect', icon: '∩', label: 'Interseção' },
    { id: 'difference', icon: '➖', label: 'Diferença', separator: true },
    // Dividir
    { id: 'clip', icon: '✂️', label: 'Cortar' },
    { id: 'split', icon: '⚔️', label: 'Dividir', separator: true },
    // Simplificar
    { id: 'simplify', icon: '〰️', label: 'Simplificar' },
    { id: 'smooth', icon: '🌊', label: 'Suavizar' },
  ],
  medicao: [
    { id: 'measure-distance', icon: '📏', label: 'Distância' },
    { id: 'measure-area', icon: '📐', label: 'Área' },
    { id: 'measure-angle', icon: '∠', label: 'Ângulo' },
  ],
  ferramentas: [
    { id: 'snap-toggle', icon: '🧲', label: 'Snap', shortcut: 'S', separator: true },
    { id: 'tabela-atributos', icon: '📋', label: 'Tabela' },
    { id: 'propriedades', icon: '⚙️', label: 'Propriedades', separator: true },
    { id: 'download-geojson', icon: '📤', label: 'Baixar' },
    { id: 'load-geojson', icon: '📂', label: 'Carregar' },
    { id: 'clear-all', icon: '🗑️', label: 'Limpar' },
  ],
};

interface FloatingToolbarProps {
  activeTab: RibbonTab;
  activeTool: string | null;
  onToolSelect: (toolId: string | null) => void;
  centerX?: number; // Position to center the toolbar (from active tab)
}

export function FloatingToolbar({ activeTab, activeTool, onToolSelect, centerX }: FloatingToolbarProps) {
  const tools = TOOLS[activeTab];

  // Calculate the left position based on centerX
  // If centerX is provided, use it; otherwise fall back to center of screen
  const positionStyle = centerX
    ? { left: `${centerX}px`, transform: 'translateX(-50%)' }
    : { left: '50%', transform: 'translateX(-50%)' };

  return (
    <div className="fixed z-50" style={{ ...positionStyle, top: '48px' }}>
      <div className="bg-gray-900/95 backdrop-blur-sm border border-gray-700 rounded-lg shadow-xl px-2 py-1.5 flex items-center gap-0.5">
        {tools.map((tool, index) => (
          <div key={tool.id} className="flex items-center">
            <button
              onClick={() => onToolSelect(activeTool === tool.id ? null : tool.id)}
              disabled={tool.disabled}
              title={`${tool.label}${tool.shortcut ? ` (${tool.shortcut})` : ''}`}
              className={`flex flex-col items-center justify-center px-2 py-1 rounded transition-colors min-w-[36px] ${
                activeTool === tool.id
                  ? 'bg-emerald-600 text-white'
                  : 'text-gray-300 hover:text-white hover:bg-gray-700'
              } ${tool.disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              <span className="text-base leading-none">{tool.icon}</span>
              <span className="text-[8px] mt-0.5 leading-none opacity-80 truncate max-w-[36px]">{tool.label}</span>
            </button>
            {/* Separador visual */}
            {tool.separator && index < tools.length - 1 && (
              <div className="w-px h-8 bg-gray-600 mx-1" />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
