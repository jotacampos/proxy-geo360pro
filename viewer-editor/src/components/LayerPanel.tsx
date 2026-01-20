import { useState } from 'react';
import { useStore } from '../store';

export default function LayerPanel() {
  const { layers, visibleLayers, layersLoading, toggleLayerVisibility } = useStore();
  const [expandedLayers, setExpandedLayers] = useState<Set<number>>(new Set());

  const toggleExpanded = (layerId: number) => {
    const newExpanded = new Set(expandedLayers);
    if (newExpanded.has(layerId)) {
      newExpanded.delete(layerId);
    } else {
      newExpanded.add(layerId);
    }
    setExpandedLayers(newExpanded);
  };

  if (layersLoading) {
    return (
      <div className="p-4 text-center text-gray-400">
        <div className="w-8 h-8 border-2 border-gray-600 border-t-primary rounded-full animate-spin mx-auto mb-2" />
        Carregando camadas...
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b border-gray-700">
        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
          Camadas Espaciais
        </h3>
        <p className="text-xs text-gray-600 mt-1">
          {layers.length} camadas disponíveis
        </p>
      </div>

      {/* Layer list */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {layers.length === 0 ? (
          <div className="text-center text-gray-500 py-8">
            Nenhuma camada encontrada
          </div>
        ) : (
          layers.map((layer) => {
            const isVisible = visibleLayers.has(layer.id);
            const isExpanded = expandedLayers.has(layer.id);
            const geomAttr = layer.attributes.find((a) => a.mainGeometry);
            const otherAttrs = layer.attributes.filter((a) => !a.mainGeometry);

            return (
              <div
                key={layer.id}
                className="bg-dark rounded-lg overflow-hidden"
              >
                {/* Layer header */}
                <div className="flex items-center gap-3 p-3 hover:bg-dark/80 transition-colors">
                  <input
                    type="checkbox"
                    checked={isVisible}
                    onChange={() => toggleLayerVisibility(layer.id)}
                    className="w-5 h-5 cursor-pointer"
                  />

                  <div
                    className="flex-1 cursor-pointer"
                    onClick={() => toggleExpanded(layer.id)}
                  >
                    <div className="font-medium text-sm">{layer.name}</div>
                    <div className="text-xs text-gray-500 mt-0.5">
                      {layer.tableName} | {layer.recordsCount || 0} registros
                    </div>
                  </div>

                  <button
                    onClick={() => toggleExpanded(layer.id)}
                    className="text-gray-500 hover:text-primary transition-colors"
                  >
                    {isExpanded ? '▼' : '▶'}
                  </button>
                </div>

                {/* Layer details */}
                {isExpanded && (
                  <div className="px-3 pb-3 pt-1 border-t border-gray-800 bg-dark/50 text-xs">
                    <div className="space-y-1 text-gray-400">
                      <div>
                        <span className="text-gray-500">Schema:</span>{' '}
                        {layer.schema}
                      </div>
                      <div>
                        <span className="text-gray-500">Tabela:</span>{' '}
                        {layer.tableName}
                      </div>
                      <div>
                        <span className="text-gray-500">Geometria:</span>{' '}
                        {layer.geomColumn}
                        {geomAttr && (
                          <span className="text-gray-600">
                            {' '}
                            ({geomAttr.attributeType})
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Fields */}
                    <div className="mt-2">
                      <div className="text-gray-500 mb-1">Campos:</div>
                      <div className="flex flex-wrap gap-1">
                        {geomAttr && (
                          <span className="px-2 py-0.5 bg-primary text-dark rounded text-[10px] font-mono">
                            {geomAttr.columnName}
                          </span>
                        )}
                        {otherAttrs.slice(0, 8).map((attr) => (
                          <span
                            key={attr.id}
                            className="px-2 py-0.5 bg-gray-700 rounded text-[10px] font-mono"
                          >
                            {attr.columnName}
                          </span>
                        ))}
                        {otherAttrs.length > 8 && (
                          <span className="px-2 py-0.5 bg-gray-700 rounded text-[10px]">
                            +{otherAttrs.length - 8}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Footer info */}
      <div className="p-3 border-t border-gray-700 text-xs text-gray-500">
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 bg-primary rounded-full" />
          <span>{visibleLayers.size} camada(s) visível(is)</span>
        </div>
      </div>
    </div>
  );
}
