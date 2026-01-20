import { useState } from 'react';

export interface LayerInfo {
  id: string;
  name: string;
  schema?: string;
  table?: string;
  featureCount?: number;
}

interface AttributeTableProps {
  isOpen: boolean;
  height: number;
  onHeightChange: (height: number) => void;
  onClose: () => void;
  layer?: LayerInfo | null;
  availableLayers?: LayerInfo[];
  onLayerChange?: (layer: LayerInfo | null) => void;
}

// Mock data for demonstration - in real app would come from API based on layer
const MOCK_DATA_BY_LAYER: Record<string, any[]> = {
  lotes: [
    { id: 1, inscricao: '001.001.001', area: 450.5, bairro: 'Centro', proprietario: 'João Silva' },
    { id: 2, inscricao: '001.001.002', area: 380.0, bairro: 'Centro', proprietario: 'Maria Santos' },
    { id: 3, inscricao: '001.002.001', area: 520.3, bairro: 'Jardim', proprietario: 'Pedro Oliveira' },
    { id: 4, inscricao: '001.002.002', area: 290.8, bairro: 'Jardim', proprietario: 'Ana Costa' },
    { id: 5, inscricao: '001.003.001', area: 615.2, bairro: 'Industrial', proprietario: 'Carlos Lima' },
  ],
  edificacoes: [
    { id: 1, codigo: 'E001', tipo: 'Residencial', pavimentos: 2, area_constr: 180.5 },
    { id: 2, codigo: 'E002', tipo: 'Comercial', pavimentos: 1, area_constr: 95.0 },
    { id: 3, codigo: 'E003', tipo: 'Industrial', pavimentos: 1, area_constr: 450.0 },
  ],
  postes: [
    { id: 1, numero: 'P-001', tipo: 'Concreto', altura: 12, rede: 'BT' },
    { id: 2, numero: 'P-002', tipo: 'Madeira', altura: 9, rede: 'MT' },
    { id: 3, numero: 'P-003', tipo: 'Metálico', altura: 15, rede: 'AT' },
  ],
};

const COLUMNS_BY_LAYER: Record<string, { key: string; label: string; width: number }[]> = {
  lotes: [
    { key: 'id', label: '#', width: 60 },
    { key: 'inscricao', label: 'Inscrição', width: 150 },
    { key: 'area', label: 'Área (m²)', width: 100 },
    { key: 'bairro', label: 'Bairro', width: 120 },
    { key: 'proprietario', label: 'Proprietário', width: 200 },
  ],
  edificacoes: [
    { key: 'id', label: '#', width: 60 },
    { key: 'codigo', label: 'Código', width: 100 },
    { key: 'tipo', label: 'Tipo', width: 120 },
    { key: 'pavimentos', label: 'Pavimentos', width: 100 },
    { key: 'area_constr', label: 'Área Constr. (m²)', width: 150 },
  ],
  postes: [
    { key: 'id', label: '#', width: 60 },
    { key: 'numero', label: 'Número', width: 100 },
    { key: 'tipo', label: 'Tipo', width: 100 },
    { key: 'altura', label: 'Altura (m)', width: 100 },
    { key: 'rede', label: 'Rede', width: 80 },
  ],
};

// Default available layers for when opened without context
const DEFAULT_AVAILABLE_LAYERS: LayerInfo[] = [
  { id: 'lotes', name: 'Lotes', schema: 'cadastro', table: 'lotes', featureCount: 1234 },
  { id: 'edificacoes', name: 'Edificações', schema: 'cadastro', table: 'edificacoes', featureCount: 892 },
  { id: 'logradouros', name: 'Logradouros', schema: 'cadastro', table: 'logradouros', featureCount: 156 },
  { id: 'postes', name: 'Postes', schema: 'infra', table: 'postes', featureCount: 456 },
  { id: 'redes', name: 'Redes Elétricas', schema: 'infra', table: 'redes', featureCount: 234 },
];

export function AttributeTable({
  isOpen,
  height,
  onHeightChange,
  onClose,
  layer,
  availableLayers = DEFAULT_AVAILABLE_LAYERS,
  onLayerChange,
}: AttributeTableProps) {
  const [selectedRow, setSelectedRow] = useState<number | null>(null);
  const [filter, setFilter] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [internalSelectedLayer, setInternalSelectedLayer] = useState<string>('');

  if (!isOpen) return null;

  // Use provided layer or internal selection
  const currentLayerId = layer?.id || internalSelectedLayer;
  const currentLayer = layer || availableLayers.find(l => l.id === internalSelectedLayer);

  const data = currentLayerId ? (MOCK_DATA_BY_LAYER[currentLayerId] || []) : [];
  const columns = currentLayerId ? (COLUMNS_BY_LAYER[currentLayerId] || []) : [];

  const filteredData = data.filter((row) =>
    Object.values(row).some((value) =>
      String(value).toLowerCase().includes(filter.toLowerCase())
    )
  );

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    const startY = e.clientY;
    const startHeight = height;

    const handleMouseMove = (e: MouseEvent) => {
      const deltaY = startY - e.clientY;
      const newHeight = Math.max(100, Math.min(500, startHeight + deltaY));
      onHeightChange(newHeight);
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    document.body.style.cursor = 'row-resize';
    document.body.style.userSelect = 'none';
  };

  const handleLayerSelect = (layerId: string) => {
    setInternalSelectedLayer(layerId);
    setSelectedRow(null);
    setFilter('');
    const selectedLayer = availableLayers.find(l => l.id === layerId) || null;
    onLayerChange?.(selectedLayer);
  };

  return (
    <div
      className="bg-gray-900 border-t border-gray-700 flex flex-col flex-shrink-0"
      style={{ height }}
    >
      {/* Resize Handle */}
      <div
        className={`h-1.5 cursor-row-resize transition-colors ${
          isDragging ? 'bg-emerald-500' : 'bg-gray-600 hover:bg-emerald-500'
        }`}
        onMouseDown={handleMouseDown}
      />

      {/* Header */}
      <div className="h-8 border-b border-gray-700 flex items-center px-3 gap-3 flex-shrink-0">
        {/* Layer selector or layer name */}
        {!layer ? (
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-400">📋 Camada:</span>
            <select
              value={internalSelectedLayer}
              onChange={(e) => handleLayerSelect(e.target.value)}
              className="bg-gray-800 border border-gray-600 rounded px-2 py-0.5 text-xs text-white focus:outline-none focus:border-emerald-500"
            >
              <option value="">Selecione uma camada...</option>
              {availableLayers.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name} ({l.featureCount || 0})
                </option>
              ))}
            </select>
          </div>
        ) : (
          <span className="text-xs font-semibold text-emerald-400">
            📋 {layer.schema ? `${layer.schema}.${layer.name}` : layer.name}
          </span>
        )}

        {currentLayer && (
          <span className="text-xs text-gray-500">
            ({filteredData.length} registros)
          </span>
        )}

        <div className="flex-1" />

        {/* Filter - only show when layer selected */}
        {currentLayerId && (
          <div className="flex items-center gap-2">
            <span className="text-gray-500">🔍</span>
            <input
              type="text"
              placeholder="Filtrar..."
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="bg-gray-800 border border-gray-600 rounded px-2 py-0.5 text-xs text-white w-40 focus:outline-none focus:border-emerald-500"
            />
          </div>
        )}

        {/* Actions */}
        <button
          title="Exportar CSV"
          className="p-1 text-gray-400 hover:text-white hover:bg-gray-700 rounded text-xs"
          disabled={!currentLayerId}
        >
          ⬇️
        </button>
        <button
          title="Configurar colunas"
          className="p-1 text-gray-400 hover:text-white hover:bg-gray-700 rounded text-xs"
          disabled={!currentLayerId}
        >
          ⚙️
        </button>
        <button
          title="Fechar tabela"
          onClick={onClose}
          className="p-1 text-gray-400 hover:text-white hover:bg-gray-700 rounded text-xs"
        >
          ✕
        </button>
      </div>

      {/* Table or Empty State */}
      <div className="flex-1 overflow-auto">
        {!currentLayerId ? (
          // Empty state - no layer selected
          <div className="flex flex-col items-center justify-center h-full text-gray-500">
            <span className="text-4xl mb-3">📋</span>
            <span className="text-sm">Selecione uma camada para visualizar os atributos</span>
            <span className="text-xs mt-1 text-gray-600">
              ou abra a tabela a partir do menu de contexto de uma camada
            </span>
          </div>
        ) : filteredData.length === 0 ? (
          // No data
          <div className="flex flex-col items-center justify-center h-full text-gray-500">
            <span className="text-2xl mb-2">🔍</span>
            <span className="text-sm">Nenhum registro encontrado</span>
          </div>
        ) : (
          // Data table
          <table className="w-full text-xs">
            <thead className="bg-gray-800 sticky top-0">
              <tr>
                {columns.map((col) => (
                  <th
                    key={col.key}
                    className="text-left px-3 py-2 text-gray-400 font-semibold border-b border-gray-700"
                    style={{ width: col.width }}
                  >
                    {col.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredData.map((row) => (
                <tr
                  key={row.id}
                  onClick={() => setSelectedRow(row.id)}
                  className={`cursor-pointer transition-colors ${
                    selectedRow === row.id
                      ? 'bg-emerald-900/50'
                      : 'hover:bg-gray-800'
                  }`}
                >
                  {columns.map((col) => (
                    <td
                      key={col.key}
                      className="px-3 py-1.5 border-b border-gray-800 text-gray-300"
                    >
                      {col.key === 'id' && selectedRow === row.id ? '►' : ''}{' '}
                      {row[col.key as keyof typeof row]}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Footer */}
      <div className="h-6 border-t border-gray-700 flex items-center px-3 text-xs text-gray-500 flex-shrink-0">
        {currentLayerId ? (
          <>
            <span>Página 1 de 1</span>
            <span className="mx-3">|</span>
            <span>Mostrando 1-{filteredData.length} de {filteredData.length}</span>
            <span className="mx-3">|</span>
            <span>Selecionados: {selectedRow ? 1 : 0}</span>
            <div className="flex-1" />
            <button className="text-gray-400 hover:text-white px-2">CSV</button>
            <button className="text-gray-400 hover:text-white px-2">GeoJSON</button>
          </>
        ) : (
          <span className="text-gray-600">Nenhuma camada selecionada</span>
        )}
      </div>
    </div>
  );
}
