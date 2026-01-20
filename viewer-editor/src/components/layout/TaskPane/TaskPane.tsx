import { useState } from 'react';
import {
  Layers,
  Table2,
  BarChart3,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { LayerTree } from './LayerTree';

interface TaskPaneProps {
  onToggleCollapse: () => void;
}

type TabId = 'layers' | 'attributes' | 'analysis';

interface Tab {
  id: TabId;
  label: string;
  icon: React.ReactNode;
}

const tabs: Tab[] = [
  { id: 'layers', label: 'Camadas', icon: <Layers size={18} /> },
  { id: 'attributes', label: 'Atributos', icon: <Table2 size={18} /> },
  { id: 'analysis', label: 'Análise', icon: <BarChart3 size={18} /> },
];

export function TaskPane({ onToggleCollapse }: TaskPaneProps) {
  const [activeTab, setActiveTab] = useState<TabId>('layers');
  const [isCollapsed, setIsCollapsed] = useState(false);

  const handleToggle = () => {
    setIsCollapsed(!isCollapsed);
    onToggleCollapse();
  };

  // Collapsed state - show only icons
  if (isCollapsed) {
    return (
      <div className="h-full bg-gray-900 border-l border-gray-700 flex flex-col items-center py-2">
        <button
          onClick={handleToggle}
          className="p-2 hover:bg-gray-700 rounded mb-4"
          title="Expandir painel"
        >
          <ChevronLeft size={18} />
        </button>
        <div className="flex flex-col gap-2">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => {
                setActiveTab(tab.id);
                handleToggle();
              }}
              className={`p-2 rounded transition-colors ${
                activeTab === tab.id
                  ? 'bg-primary text-white'
                  : 'hover:bg-gray-700 text-gray-400'
              }`}
              title={tab.label}
            >
              {tab.icon}
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="h-full bg-gray-900 border-l border-gray-700 flex flex-col">
      {/* Header with tabs */}
      <div className="flex items-center border-b border-gray-700">
        <button
          onClick={handleToggle}
          className="p-2 hover:bg-gray-700 transition-colors"
          title="Colapsar painel"
        >
          <ChevronRight size={18} />
        </button>
        <div className="flex flex-1">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2 text-sm transition-colors border-b-2 ${
                activeTab === tab.id
                  ? 'border-primary text-white bg-gray-800'
                  : 'border-transparent text-gray-400 hover:text-white hover:bg-gray-800'
              }`}
            >
              {tab.icon}
              <span>{tab.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-auto">
        {activeTab === 'layers' && <LayerTree />}
        {activeTab === 'attributes' && <AttributesTab />}
        {activeTab === 'analysis' && <AnalysisTab />}
      </div>
    </div>
  );
}

// Placeholder for Attributes tab
function AttributesTab() {
  return (
    <div className="p-4 text-gray-400 text-sm">
      <p className="mb-2">Selecione uma feição para ver seus atributos.</p>
      <p className="text-xs text-gray-500">
        A tabela de atributos mostrará os campos e valores do objeto selecionado.
      </p>
    </div>
  );
}

// Placeholder for Analysis tab
function AnalysisTab() {
  return (
    <div className="p-4 text-gray-400 text-sm">
      <p className="mb-2">Ferramentas de análise espacial.</p>
      <div className="space-y-2 mt-4">
        <AnalysisTool
          title="Buffer"
          description="Criar zona de influência ao redor de geometrias"
          disabled
        />
        <AnalysisTool
          title="Intersecção"
          description="Encontrar áreas comuns entre camadas"
          disabled
        />
        <AnalysisTool
          title="União"
          description="Combinar geometrias de diferentes camadas"
          disabled
        />
        <AnalysisTool
          title="Diferença"
          description="Subtrair uma camada de outra"
          disabled
        />
      </div>
    </div>
  );
}

interface AnalysisToolProps {
  title: string;
  description: string;
  disabled?: boolean;
}

function AnalysisTool({ title, description, disabled }: AnalysisToolProps) {
  return (
    <button
      disabled={disabled}
      className={`w-full text-left p-3 rounded border transition-colors ${
        disabled
          ? 'border-gray-700 bg-gray-800/50 text-gray-500 cursor-not-allowed'
          : 'border-gray-600 bg-gray-800 hover:border-primary hover:bg-gray-700'
      }`}
    >
      <div className="font-medium text-sm">{title}</div>
      <div className="text-xs text-gray-500 mt-1">{description}</div>
    </button>
  );
}
