import { useState } from 'react';
import { DraggablePanel } from '../ui/DraggablePanel';

interface BufferPanelProps {
  isOpen: boolean;
  onClose: () => void;
  onExecute?: (options: BufferOptions) => void;
  selectedFeatureCount?: number;
}

interface BufferOptions {
  distance: number;
  unit: 'meters' | 'kilometers';
  segments: number;
  dissolve: boolean;
  outputLayer: string;
}

export function BufferPanel({ isOpen, onClose, onExecute, selectedFeatureCount = 0 }: BufferPanelProps) {
  const [options, setOptions] = useState<BufferOptions>({
    distance: 100,
    unit: 'meters',
    segments: 8,
    dissolve: false,
    outputLayer: 'Buffer_resultado',
  });

  if (!isOpen) return null;

  const handleExecute = () => {
    onExecute?.(options);
    onClose();
  };

  return (
    <DraggablePanel
      title="Buffer"
      icon="⭕"
      onClose={onClose}
      initialPosition={{ x: 16, y: 64 }}
      minWidth={288}
    >
      {/* Content */}
      <div className="p-3 space-y-4">
        {/* Selection info */}
        <div className="p-2 bg-gray-800 rounded text-xs text-gray-400">
          {selectedFeatureCount > 0 ? (
            <span className="text-emerald-400">
              {selectedFeatureCount} objeto(s) selecionado(s)
            </span>
          ) : (
            <span>Nenhum objeto selecionado. Selecione objetos no mapa.</span>
          )}
        </div>

        {/* Distance */}
        <div>
          <label className="block text-xs text-gray-400 mb-2">Distância</label>
          <div className="flex gap-2">
            <input
              type="number"
              value={options.distance}
              onChange={(e) => setOptions({ ...options, distance: Number(e.target.value) })}
              className="flex-1 bg-gray-800 border border-gray-600 rounded px-2 py-1.5 text-sm text-white focus:outline-none focus:border-emerald-500"
              min="0"
              step="10"
            />
            <select
              value={options.unit}
              onChange={(e) => setOptions({ ...options, unit: e.target.value as 'meters' | 'kilometers' })}
              className="bg-gray-800 border border-gray-600 rounded px-2 py-1.5 text-sm text-white focus:outline-none focus:border-emerald-500"
            >
              <option value="meters">Metros</option>
              <option value="kilometers">Quilômetros</option>
            </select>
          </div>
        </div>

        {/* Segments */}
        <div>
          <label className="block text-xs text-gray-400 mb-2">
            Segmentos: {options.segments}
          </label>
          <input
            type="range"
            min="4"
            max="32"
            value={options.segments}
            onChange={(e) => setOptions({ ...options, segments: Number(e.target.value) })}
            className="w-full h-1.5 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-emerald-500"
          />
          <div className="flex justify-between text-[10px] text-gray-500 mt-1">
            <span>Rápido</span>
            <span>Suave</span>
          </div>
        </div>

        {/* Dissolve */}
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={options.dissolve}
            onChange={(e) => setOptions({ ...options, dissolve: e.target.checked })}
            className="w-4 h-4 rounded bg-gray-700 border-gray-600 text-emerald-500 focus:ring-emerald-500"
          />
          <span className="text-sm text-gray-300">Dissolver sobreposições</span>
        </label>

        {/* Output layer name */}
        <div>
          <label className="block text-xs text-gray-400 mb-2">Camada de saída</label>
          <input
            type="text"
            value={options.outputLayer}
            onChange={(e) => setOptions({ ...options, outputLayer: e.target.value })}
            className="w-full bg-gray-800 border border-gray-600 rounded px-2 py-1.5 text-sm text-white focus:outline-none focus:border-emerald-500"
          />
        </div>
      </div>

      {/* Footer */}
      <div className="flex gap-2 px-3 py-2 border-t border-gray-700">
        <button
          onClick={onClose}
          className="flex-1 px-3 py-1.5 bg-gray-700 hover:bg-gray-600 rounded text-sm text-gray-300"
        >
          Cancelar
        </button>
        <button
          onClick={handleExecute}
          disabled={selectedFeatureCount === 0}
          className="flex-1 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 disabled:bg-gray-600 disabled:cursor-not-allowed rounded text-sm text-white"
        >
          Executar
        </button>
      </div>
    </DraggablePanel>
  );
}
