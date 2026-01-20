import { useState } from 'react';
import { DraggablePanel } from '../ui/DraggablePanel';

type MeasureType = 'distance' | 'area' | 'angle';

interface MeasurePanelProps {
  isOpen: boolean;
  onClose: () => void;
  measureType: MeasureType;
  measurements?: MeasurementResult[];
  onClear?: () => void;
}

interface MeasurementResult {
  id: string;
  type: MeasureType;
  value: number;
  unit: string;
  coordinates: [number, number][];
}

const MEASURE_LABELS: Record<MeasureType, string> = {
  distance: 'Medir Distância',
  area: 'Medir Área',
  angle: 'Medir Ângulo',
};

const MEASURE_ICONS: Record<MeasureType, string> = {
  distance: '📏',
  area: '📐',
  angle: '📊',
};

const MEASURE_HINTS: Record<MeasureType, string> = {
  distance: 'Clique no mapa para adicionar pontos. Duplo-clique para finalizar.',
  area: 'Clique no mapa para desenhar o polígono. Duplo-clique para finalizar.',
  angle: 'Clique 3 pontos para medir o ângulo entre eles.',
};

export function MeasurePanel({ isOpen, onClose, measureType, measurements = [], onClear }: MeasurePanelProps) {
  const [unit, setUnit] = useState<'metric' | 'imperial'>('metric');

  if (!isOpen) return null;

  const formatDistance = (meters: number) => {
    if (unit === 'imperial') {
      const feet = meters * 3.28084;
      if (feet < 5280) {
        return `${feet.toFixed(2)} ft`;
      }
      return `${(feet / 5280).toFixed(2)} mi`;
    }
    if (meters < 1000) {
      return `${meters.toFixed(2)} m`;
    }
    return `${(meters / 1000).toFixed(2)} km`;
  };

  const formatArea = (sqMeters: number) => {
    if (unit === 'imperial') {
      const sqFeet = sqMeters * 10.7639;
      if (sqFeet < 43560) {
        return `${sqFeet.toFixed(2)} ft²`;
      }
      return `${(sqFeet / 43560).toFixed(2)} acres`;
    }
    if (sqMeters < 10000) {
      return `${sqMeters.toFixed(2)} m²`;
    }
    return `${(sqMeters / 10000).toFixed(2)} ha`;
  };

  const formatAngle = (degrees: number) => {
    return `${degrees.toFixed(2)}°`;
  };

  const formatValue = (m: MeasurementResult) => {
    switch (m.type) {
      case 'distance':
        return formatDistance(m.value);
      case 'area':
        return formatArea(m.value);
      case 'angle':
        return formatAngle(m.value);
      default:
        return `${m.value}`;
    }
  };

  const totalValue = measurements.reduce((acc, m) => acc + m.value, 0);

  return (
    <DraggablePanel
      title={MEASURE_LABELS[measureType]}
      icon={MEASURE_ICONS[measureType]}
      onClose={onClose}
      initialPosition={{ x: 16, y: 64 }}
      minWidth={256}
    >
      {/* Content */}
      <div className="p-3 space-y-3">
        {/* Unit toggle */}
        <div className="flex bg-gray-800 rounded p-0.5">
          <button
            onClick={() => setUnit('metric')}
            className={`flex-1 px-2 py-1 text-xs rounded ${
              unit === 'metric' ? 'bg-emerald-600 text-white' : 'text-gray-400'
            }`}
          >
            Métrico
          </button>
          <button
            onClick={() => setUnit('imperial')}
            className={`flex-1 px-2 py-1 text-xs rounded ${
              unit === 'imperial' ? 'bg-emerald-600 text-white' : 'text-gray-400'
            }`}
          >
            Imperial
          </button>
        </div>

        {/* Instructions */}
        <div className="p-2 bg-gray-800 rounded text-xs text-gray-400">
          {MEASURE_HINTS[measureType]}
        </div>

        {/* Measurements list */}
        {measurements.length > 0 && (
          <div className="space-y-1 max-h-32 overflow-auto">
            {measurements.map((m, index) => (
              <div
                key={m.id}
                className="flex justify-between items-center p-2 bg-gray-800 rounded text-sm"
              >
                <span className="text-gray-400">
                  {measureType === 'distance' && `Segmento ${index + 1}`}
                  {measureType === 'area' && `Área ${index + 1}`}
                  {measureType === 'angle' && `Ângulo ${index + 1}`}
                </span>
                <span className="text-white font-mono">
                  {formatValue(m)}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Total - only for distance and area */}
        {measurements.length > 0 && measureType !== 'angle' && (
          <div className="flex justify-between items-center p-2 bg-emerald-900/30 border border-emerald-700 rounded text-sm">
            <span className="text-emerald-400 font-semibold">Total</span>
            <span className="text-emerald-400 font-mono font-semibold">
              {measureType === 'distance' ? formatDistance(totalValue) : formatArea(totalValue)}
            </span>
          </div>
        )}

        {/* Empty state */}
        {measurements.length === 0 && (
          <div className="text-center py-4 text-gray-500 text-sm">
            Nenhuma medição realizada
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="flex gap-2 px-3 py-2 border-t border-gray-700">
        <button
          onClick={onClear}
          disabled={measurements.length === 0}
          className="flex-1 px-3 py-1.5 bg-gray-700 hover:bg-gray-600 disabled:opacity-50 rounded text-sm text-gray-300"
        >
          Limpar
        </button>
        <button
          onClick={onClose}
          className="flex-1 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 rounded text-sm text-white"
        >
          Fechar
        </button>
      </div>
    </DraggablePanel>
  );
}
