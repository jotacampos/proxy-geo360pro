import { useRef, useEffect, useCallback } from 'react';
import { Popover, PopoverItem, PopoverDivider } from '../ui/Popover';
import { useEditorStore } from '../../stores';

// Tabs baseadas na estrutura do viewer-deckgl antigo
export type RibbonTab = 'selecao' | 'criar' | 'editar' | 'analise' | 'medicao' | 'ferramentas';

const TABS: { id: RibbonTab; label: string; icon: string }[] = [
  { id: 'selecao', label: 'Seleção', icon: '⬚' },
  { id: 'criar', label: 'Criar', icon: '✏️' },
  { id: 'editar', label: 'Editar', icon: '⧉' },
  { id: 'analise', label: 'Análise', icon: '📊' },
  { id: 'medicao', label: 'Medição', icon: '📏' },
  { id: 'ferramentas', label: 'Ferramentas', icon: '🛠️' },
];

interface CompactRibbonProps {
  activeTab: RibbonTab;
  onTabChange: (tab: RibbonTab) => void;
  onTabPositionChange?: (centerX: number) => void;
}

export function CompactRibbon({ activeTab, onTabChange, onTabPositionChange }: CompactRibbonProps) {
  // Editor store for undo/redo
  const { undo, redo, canUndo, canRedo, history, historyIndex } = useEditorStore();

  const tabRefs = useRef<Record<RibbonTab, HTMLButtonElement | null>>({
    selecao: null,
    criar: null,
    editar: null,
    analise: null,
    medicao: null,
    ferramentas: null,
  });

  // Calculate and report tab center position
  const updateTabPosition = useCallback(() => {
    const tabElement = tabRefs.current[activeTab];
    if (tabElement && onTabPositionChange) {
      const rect = tabElement.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      onTabPositionChange(centerX);
    }
  }, [activeTab, onTabPositionChange]);

  // Update position when active tab changes or on resize
  useEffect(() => {
    updateTabPosition();
    window.addEventListener('resize', updateTabPosition);
    return () => window.removeEventListener('resize', updateTabPosition);
  }, [updateTabPosition]);

  return (
    <div className="h-9 bg-gray-900 border-b border-gray-700 flex items-center flex-shrink-0">
      {/* Logo */}
      <div className="w-10 h-full flex items-center justify-center border-r border-gray-700">
        <span className="text-base">🗺️</span>
      </div>

      {/* Tabs - Centered */}
      <div className="flex-1 flex items-center justify-center h-full">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            ref={(el) => { tabRefs.current[tab.id] = el; }}
            onClick={() => onTabChange(tab.id)}
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
      <div className="flex items-center gap-1 px-2">
        {/* Undo with history popover */}
        <Popover
          position="bottom-right"
          trigger={
            <button
              onClick={() => canUndo() && undo()}
              disabled={!canUndo()}
              title="Desfazer (Ctrl+Z)"
              className={`p-1.5 rounded text-sm ${
                canUndo()
                  ? 'text-gray-400 hover:text-white hover:bg-gray-700'
                  : 'text-gray-600 cursor-not-allowed'
              }`}
            >
              ↩️
            </button>
          }
        >
          <div className="px-3 py-2 text-xs font-semibold text-gray-400 uppercase">
            Histórico ({historyIndex}/{history.length - 1})
          </div>
          <PopoverDivider />
          {historyIndex > 0 ? (
            <PopoverItem
              label={`Desfazer (${historyIndex} ação${historyIndex > 1 ? 'ões' : ''} disponível${historyIndex > 1 ? 'is' : ''})`}
              shortcut="Ctrl+Z"
              onClick={() => undo()}
            />
          ) : (
            <div className="px-3 py-2 text-xs text-gray-500">
              Nenhuma ação para desfazer
            </div>
          )}
        </Popover>

        <button
          onClick={() => canRedo() && redo()}
          disabled={!canRedo()}
          title="Refazer (Ctrl+Y)"
          className={`p-1.5 rounded text-sm ${
            canRedo()
              ? 'text-gray-400 hover:text-white hover:bg-gray-700'
              : 'text-gray-600 cursor-not-allowed'
          }`}
        >
          ↪️
        </button>
        <div className="w-px h-4 bg-gray-700 mx-1" />

        {/* Settings popover */}
        <Popover
          position="bottom-right"
          trigger={
            <button
              title="Configurações"
              className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-700 rounded text-sm"
            >
              ⚙️
            </button>
          }
        >
          <div className="px-3 py-2 text-xs font-semibold text-gray-400 uppercase">
            Configurações
          </div>
          <PopoverDivider />
          <PopoverItem
            icon="🎨"
            label="Tema"
            onClick={() => console.log('Theme settings')}
          />
          <PopoverItem
            icon="📐"
            label="Unidades"
            onClick={() => console.log('Unit settings')}
          />
          <PopoverItem
            icon="⌨️"
            label="Atalhos"
            onClick={() => console.log('Shortcuts')}
          />
          <PopoverDivider />
          <PopoverItem
            icon="🗺️"
            label="Configurações do Mapa"
            onClick={() => console.log('Map settings')}
          />
          <PopoverItem
            icon="📊"
            label="Grade e Guias"
            onClick={() => console.log('Grid settings')}
          />
          <PopoverDivider />
          <PopoverItem
            icon="❓"
            label="Ajuda"
            shortcut="F1"
            onClick={() => console.log('Help')}
          />
          <PopoverItem
            icon="ℹ️"
            label="Sobre"
            onClick={() => console.log('About')}
          />
        </Popover>
      </div>
    </div>
  );
}
