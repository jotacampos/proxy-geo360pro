import { useState } from 'react';
import { DraggablePanel } from '../ui/DraggablePanel';

interface SimplifyPanelProps {
  isOpen: boolean;
  onClose: () => void;
  onExecute: (options: SimplifyOptions) => void;
  selectedFeatureCount: number;
}

export interface SimplifyOptions {
  tolerance: number;
  highQuality: boolean;
  mutate: boolean;
}

export function SimplifyPanel({
  isOpen,
  onClose,
  onExecute,
  selectedFeatureCount,
}: SimplifyPanelProps) {
  const [tolerance, setTolerance] = useState(0.001); // In degrees (approx 111m at equator)
  const [highQuality, setHighQuality] = useState(true);
  const [mutate, setMutate] = useState(false); // Replace original instead of adding new

  if (!isOpen) return null;

  const handleExecute = () => {
    onExecute({
      tolerance,
      highQuality,
      mutate,
    });
  };

  // Convert tolerance to approximate meters for display
  const toleranceMeters = (tolerance * 111000).toFixed(0);

  return (
    <DraggablePanel
      title="Simplificar Geometria"
      icon="〰️"
      onClose={onClose}
      initialPosition={{ x: 16, y: 64 }}
      minWidth={280}
    >
      <div className="p-3 space-y-4">
        {/* Info */}
        <div className="p-2 bg-gray-800 rounded text-xs text-gray-400">
          {selectedFeatureCount > 0 ? (
            <span>{selectedFeatureCount} feature(s) selecionada(s)</span>
          ) : (
            <span className="text-amber-400">Selecione features para simplificar</span>
          )}
        </div>

        {/* Tolerance Slider */}
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <label className="text-xs text-gray-400">Tolerância</label>
            <span className="text-xs font-mono text-emerald-400">~{toleranceMeters}m</span>
          </div>
          <input
            type="range"
            min="0.00001"
            max="0.01"
            step="0.00001"
            value={tolerance}
            onChange={(e) => setTolerance(parseFloat(e.target.value))}
            className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-emerald-500"
          />
          <div className="flex justify-between text-[10px] text-gray-500">
            <span>Fino (~1m)</span>
            <span>Grosso (~1km)</span>
          </div>
        </div>

        {/* Input for precise tolerance */}
        <div className="space-y-1">
          <label className="text-xs text-gray-400">Valor preciso (graus)</label>
          <input
            type="number"
            min="0.00001"
            max="1"
            step="0.00001"
            value={tolerance}
            onChange={(e) => setTolerance(parseFloat(e.target.value) || 0.001)}
            className="w-full px-2 py-1.5 bg-gray-800 border border-gray-600 rounded text-sm text-white focus:border-emerald-500 focus:outline-none"
          />
        </div>

        {/* Options */}
        <div className="space-y-2">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={highQuality}
              onChange={(e) => setHighQuality(e.target.checked)}
              className="w-4 h-4 bg-gray-800 border-gray-600 rounded text-emerald-500 focus:ring-emerald-500"
            />
            <span className="text-xs text-gray-300">Alta qualidade (Douglas-Peucker)</span>
          </label>

          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={mutate}
              onChange={(e) => setMutate(e.target.checked)}
              className="w-4 h-4 bg-gray-800 border-gray-600 rounded text-emerald-500 focus:ring-emerald-500"
            />
            <span className="text-xs text-gray-300">Substituir original</span>
          </label>
        </div>

        {/* Info about simplification */}
        <div className="p-2 bg-blue-900/30 border border-blue-700 rounded text-xs text-blue-300">
          <strong>Dica:</strong> Valores menores preservam mais detalhes. Use tolerâncias maiores para reduzir
          significativamente o número de vértices.
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
          className="flex-1 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed rounded text-sm text-white"
        >
          Simplificar
        </button>
      </div>
    </DraggablePanel>
  );
}
