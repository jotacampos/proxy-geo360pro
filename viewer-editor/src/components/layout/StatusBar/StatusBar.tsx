import {
  MapPin,
  Ruler,
  Grid3X3,
  Layers,
  MousePointer2,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  User,
  Building2,
} from 'lucide-react';
import { useStore } from '../../../store';

export function StatusBar() {
  const {
    user,
    currentOrg,
    debugInfo,
    editMode,
    selectedFeatureIndexes,
    features,
    layers,
    visibleLayers,
    selectableLayers,
    snapEnabled,
  } = useStore();

  // Format edit mode for display
  const getEditModeLabel = () => {
    const modeLabels: Record<string, string> = {
      'view': 'Visualização',
      'select-rectangle': 'Seleção Retangular',
      'select-lasso': 'Seleção Laço',
      'draw-point': 'Desenhar Ponto',
      'draw-line': 'Desenhar Linha',
      'draw-polygon': 'Desenhar Polígono',
      'draw-rectangle': 'Retângulo',
      'draw-circle': 'Círculo',
      'modify': 'Editar Vértices',
      'translate': 'Mover',
      'rotate': 'Rotacionar',
      'scale': 'Escalar',
      'measure-distance': 'Medir Distância',
      'measure-area': 'Medir Área',
      'measure-angle': 'Medir Ângulo',
    };
    return modeLabels[editMode] || editMode;
  };

  // Auth status indicator
  const getAuthStatusInfo = () => {
    switch (debugInfo.authStatus) {
      case 'ok':
        return { icon: <CheckCircle2 size={12} />, color: 'text-green-400', label: 'Autenticado' };
      case 'refreshing':
        return { icon: <RefreshCw size={12} className="animate-spin" />, color: 'text-yellow-400', label: 'Atualizando token' };
      case 'expired':
        return { icon: <AlertCircle size={12} />, color: 'text-red-400', label: 'Sessão expirada' };
      default:
        return { icon: <AlertCircle size={12} />, color: 'text-gray-400', label: 'Desconhecido' };
    }
  };

  const authStatus = getAuthStatusInfo();
  const visibleCount = visibleLayers.size;
  const selectableCount = selectableLayers.size;

  return (
    <div className="h-6 bg-gray-900 border-t border-gray-700 flex items-center px-3 text-xs text-gray-400 gap-4">
      {/* Left section - Edit mode and selection */}
      <div className="flex items-center gap-4">
        {/* Current mode */}
        <div className="flex items-center gap-1.5" title="Modo atual">
          <MousePointer2 size={12} className="text-primary" />
          <span>{getEditModeLabel()}</span>
        </div>

        {/* Selection count */}
        {selectedFeatureIndexes.length > 0 && (
          <div className="flex items-center gap-1.5 text-blue-400">
            <Grid3X3 size={12} />
            <span>{selectedFeatureIndexes.length} selecionado(s)</span>
          </div>
        )}

        {/* Total features */}
        {features.features.length > 0 && (
          <div className="flex items-center gap-1.5">
            <MapPin size={12} />
            <span>{features.features.length} feição(ões)</span>
          </div>
        )}

        {/* Snap indicator */}
        {snapEnabled && (
          <div className="flex items-center gap-1.5 text-yellow-400" title="Snap ativo">
            <Ruler size={12} />
            <span>Snap</span>
          </div>
        )}
      </div>

      {/* Center section - Coordinates (placeholder) */}
      <div className="flex-1 flex items-center justify-center gap-1.5 text-gray-500">
        {/* Coordinates will be shown here when hovering map */}
      </div>

      {/* Right section - Layers and auth */}
      <div className="flex items-center gap-4">
        {/* Visible layers */}
        <div className="flex items-center gap-1.5" title={`${visibleCount} de ${layers.length} camadas visíveis`}>
          <Layers size={12} />
          <span>{visibleCount}/{layers.length}</span>
        </div>

        {/* Selectable layers */}
        {selectableCount > 0 && (
          <div className="flex items-center gap-1.5 text-green-400" title={`${selectableCount} camadas selecionáveis`}>
            <MousePointer2 size={12} />
            <span>{selectableCount}</span>
          </div>
        )}

        {/* Organization */}
        {currentOrg && (
          <div className="flex items-center gap-1.5" title={currentOrg.name}>
            <Building2 size={12} />
            <span className="max-w-24 truncate">{currentOrg.name}</span>
          </div>
        )}

        {/* User */}
        {user && (
          <div className="flex items-center gap-1.5" title={user.email}>
            <User size={12} />
            <span className="max-w-24 truncate">{user.name || user.email}</span>
          </div>
        )}

        {/* Auth status */}
        <div className={`flex items-center gap-1 ${authStatus.color}`} title={authStatus.label}>
          {authStatus.icon}
        </div>
      </div>
    </div>
  );
}
