import { useState } from 'react';
import { useStore } from '../store';

export default function FeaturePanel() {
  const { features, selectedFeatureIndexes, updateFeatures, selectFeature } = useStore();
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');

  if (selectedFeatureIndexes.length === 0) {
    return null;
  }

  const featureIndex = selectedFeatureIndexes[0];
  const feature = features.features[featureIndex];

  if (!feature) {
    return null;
  }

  const properties = feature.properties || {};
  const geometryType = feature.geometry?.type || 'Unknown';

  // Update a property value
  const handleSaveProperty = (key: string) => {
    const newFeatures = {
      ...features,
      features: features.features.map((f, i) => {
        if (i !== featureIndex) return f;
        return {
          ...f,
          properties: {
            ...f.properties,
            [key]: editValue,
          },
        };
      }),
    };
    updateFeatures(newFeatures);
    setEditingKey(null);
    setEditValue('');
  };

  // Add a new property
  const handleAddProperty = () => {
    const key = prompt('Nome da propriedade:');
    if (!key) return;

    const value = prompt('Valor:');
    if (value === null) return;

    const newFeatures = {
      ...features,
      features: features.features.map((f, i) => {
        if (i !== featureIndex) return f;
        return {
          ...f,
          properties: {
            ...f.properties,
            [key]: value,
          },
        };
      }),
    };
    updateFeatures(newFeatures);
  };

  // Delete feature
  const handleDeleteFeature = () => {
    if (!window.confirm('Excluir esta geometria?')) return;

    const newFeatures = {
      ...features,
      features: features.features.filter((_, i) => i !== featureIndex),
    };
    updateFeatures(newFeatures);
    selectFeature([]);
  };

  return (
    <div className="absolute bottom-5 right-5 w-80 bg-secondary/95 rounded-lg shadow-xl z-10">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-primary text-dark rounded-t-lg">
        <div>
          <div className="font-semibold text-sm">Feature #{featureIndex + 1}</div>
          <div className="text-xs opacity-70">{geometryType}</div>
        </div>
        <button
          onClick={() => selectFeature([])}
          className="text-dark/70 hover:text-dark text-xl leading-none"
        >
          &times;
        </button>
      </div>

      {/* Properties */}
      <div className="p-4 max-h-60 overflow-y-auto">
        <div className="text-xs text-gray-500 mb-2 font-semibold uppercase tracking-wider">
          Propriedades
        </div>

        {Object.keys(properties).length === 0 ? (
          <div className="text-gray-500 text-sm py-2">
            Nenhuma propriedade definida
          </div>
        ) : (
          <div className="space-y-2">
            {Object.entries(properties).map(([key, value]) => (
              <div
                key={key}
                className="flex items-start gap-2 text-sm border-b border-gray-700 pb-2"
              >
                <span className="text-primary font-mono text-xs w-24 flex-shrink-0 pt-0.5">
                  {key}
                </span>

                {editingKey === key ? (
                  <div className="flex-1 flex gap-1">
                    <input
                      type="text"
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      className="flex-1 px-2 py-1 bg-dark border border-gray-600 rounded text-xs"
                      autoFocus
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleSaveProperty(key);
                        if (e.key === 'Escape') setEditingKey(null);
                      }}
                    />
                    <button
                      onClick={() => handleSaveProperty(key)}
                      className="px-2 py-1 bg-primary text-dark rounded text-xs"
                    >
                      ✓
                    </button>
                  </div>
                ) : (
                  <span
                    className="flex-1 text-gray-300 cursor-pointer hover:text-white"
                    onClick={() => {
                      setEditingKey(key);
                      setEditValue(String(value ?? ''));
                    }}
                    title="Clique para editar"
                  >
                    {String(value ?? 'null')}
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex gap-2 p-3 border-t border-gray-700">
        <button
          onClick={handleAddProperty}
          className="flex-1 px-3 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded text-xs transition-colors"
        >
          + Propriedade
        </button>
        <button
          onClick={handleDeleteFeature}
          className="px-3 py-2 bg-danger/80 hover:bg-danger text-white rounded text-xs transition-colors"
        >
          Excluir
        </button>
      </div>
    </div>
  );
}
