import { useState } from 'react';
import { useStore } from '../store';
import type { HistoryEntry, HistoryOperationType } from '../types';

// Icons for operation types
const OPERATION_ICONS: Record<HistoryOperationType, string> = {
  add: '+',
  delete: '-',
  modify: '~',
  translate: '->',
  rotate: 'R',
  scale: 'S',
  transform: 'T',
  properties: 'P',
  batch: 'B',
};

// Colors for operation types
const OPERATION_COLORS: Record<HistoryOperationType, string> = {
  add: 'bg-green-600',
  delete: 'bg-red-600',
  modify: 'bg-blue-600',
  translate: 'bg-purple-600',
  rotate: 'bg-orange-600',
  scale: 'bg-yellow-600',
  transform: 'bg-pink-600',
  properties: 'bg-cyan-600',
  batch: 'bg-gray-600',
};

// Format timestamp
function formatTime(timestamp: number): string {
  const date = new Date(timestamp);
  return date.toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

// Format relative time
function formatRelativeTime(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  if (seconds < 60) return `${seconds}s atrás`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}min atrás`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h atrás`;
}

interface HistoryEntryItemProps {
  entry: HistoryEntry;
  onRevert: (id: string) => void;
  onReapply: (id: string) => void;
  conflicts: string[];
}

function HistoryEntryItem({ entry, onRevert, onReapply, conflicts }: HistoryEntryItemProps) {
  const [showDetails, setShowDetails] = useState(false);
  const hasConflicts = conflicts.length > 0;

  return (
    <div
      className={`
        border rounded-lg p-2 mb-2 transition-all
        ${entry.isReverted
          ? 'border-gray-600 bg-gray-800/50 opacity-60'
          : hasConflicts
            ? 'border-yellow-600/50 bg-yellow-900/20'
            : 'border-gray-600 bg-gray-800/30'
        }
      `}
    >
      {/* Header */}
      <div className="flex items-center gap-2">
        {/* Operation icon */}
        <span
          className={`
            w-6 h-6 flex items-center justify-center rounded text-xs font-bold text-white
            ${OPERATION_COLORS[entry.operationType]}
          `}
          title={entry.operationType}
        >
          {OPERATION_ICONS[entry.operationType]}
        </span>

        {/* Description */}
        <div className="flex-1 min-w-0">
          <div className={`text-sm truncate ${entry.isReverted ? 'line-through text-gray-500' : 'text-gray-200'}`}>
            {entry.description}
          </div>
          <div className="text-xs text-gray-500">
            {formatTime(entry.timestamp)} ({formatRelativeTime(entry.timestamp)})
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-1">
          {/* Expand/collapse */}
          <button
            onClick={() => setShowDetails(!showDetails)}
            className="p-1 text-gray-400 hover:text-gray-200 transition-colors"
            title="Detalhes"
          >
            {showDetails ? '-' : '+'}
          </button>

          {/* Revert/Reapply button */}
          {entry.isReverted ? (
            <button
              onClick={() => onReapply(entry.id)}
              className="px-2 py-1 text-xs bg-blue-600 hover:bg-blue-500 text-white rounded transition-colors"
              title="Re-aplicar esta operação"
            >
              Refazer
            </button>
          ) : (
            <button
              onClick={() => onRevert(entry.id)}
              className={`
                px-2 py-1 text-xs rounded transition-colors
                ${hasConflicts
                  ? 'bg-yellow-600 hover:bg-yellow-500 text-black'
                  : 'bg-orange-600 hover:bg-orange-500 text-white'
                }
              `}
              title={hasConflicts ? `Reverter (com avisos: ${conflicts.join(', ')})` : 'Reverter esta operação'}
            >
              Reverter
            </button>
          )}
        </div>
      </div>

      {/* Conflicts warning */}
      {hasConflicts && !entry.isReverted && (
        <div className="mt-2 p-2 bg-yellow-900/30 rounded text-xs text-yellow-300">
          <span className="font-semibold">Avisos:</span>
          <ul className="list-disc list-inside mt-1">
            {conflicts.map((conflict, i) => (
              <li key={i}>{conflict}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Details */}
      {showDetails && (
        <div className="mt-2 p-2 bg-gray-900/50 rounded text-xs font-mono">
          <div className="text-gray-400">
            <div>ID: {entry.id}</div>
            <div>Tipo: {entry.operationType}</div>
            <div>Feature Index: {entry.featureIndex}</div>
            <div>Feature ID: {String(entry.featureId)}</div>
            <div>Revertido: {entry.isReverted ? 'Sim' : 'Não'}</div>
          </div>
          {entry.beforeState && (
            <div className="mt-2">
              <div className="text-gray-500">Estado Anterior:</div>
              <div className="text-gray-400 truncate max-w-full">
                {entry.beforeState.geometry?.type || 'N/A'}
              </div>
            </div>
          )}
          {entry.afterState && (
            <div className="mt-2">
              <div className="text-gray-500">Estado Posterior:</div>
              <div className="text-gray-400 truncate max-w-full">
                {entry.afterState.geometry?.type || 'N/A'}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function HistoryPanel() {
  const {
    history,
    revertHistoryEntry,
    reapplyHistoryEntry,
    clearHistory,
    canRevertEntry,
  } = useStore();

  const [filter, setFilter] = useState<'all' | 'active' | 'reverted'>('all');
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Filter entries
  const filteredHistory = history.filter(entry => {
    if (filter === 'active') return !entry.isReverted;
    if (filter === 'reverted') return entry.isReverted;
    return true;
  });

  // Handle revert
  const handleRevert = (entryId: string) => {
    const result = revertHistoryEntry(entryId);
    setMessage({
      type: result.success ? 'success' : 'error',
      text: result.message,
    });
    // Clear message after 3 seconds
    setTimeout(() => setMessage(null), 3000);
  };

  // Handle reapply
  const handleReapply = (entryId: string) => {
    const result = reapplyHistoryEntry(entryId);
    setMessage({
      type: result.success ? 'success' : 'error',
      text: result.message,
    });
    setTimeout(() => setMessage(null), 3000);
  };

  // Handle clear
  const handleClear = () => {
    if (window.confirm('Limpar todo o histórico? Esta ação não pode ser desfeita.')) {
      clearHistory();
      setMessage({ type: 'success', text: 'Histórico limpo' });
      setTimeout(() => setMessage(null), 3000);
    }
  };

  // Count stats
  const activeCount = history.filter(h => !h.isReverted).length;
  const revertedCount = history.filter(h => h.isReverted).length;

  if (history.length === 0) {
    return (
      <div className="p-4 text-center text-gray-500 text-sm">
        <div className="text-2xl mb-2">-</div>
        <div>Nenhuma operação no histórico</div>
        <div className="text-xs mt-1">
          As operações de edição aparecerão aqui
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-3 border-b border-gray-700">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-semibold text-gray-200">
            Histórico ({history.length})
          </h3>
          <button
            onClick={handleClear}
            className="text-xs text-red-400 hover:text-red-300 transition-colors"
            title="Limpar histórico"
          >
            Limpar
          </button>
        </div>

        {/* Stats */}
        <div className="flex gap-2 text-xs">
          <span className="text-green-400">{activeCount} ativas</span>
          <span className="text-gray-500">|</span>
          <span className="text-gray-400">{revertedCount} revertidas</span>
        </div>

        {/* Filter */}
        <div className="flex gap-1 mt-2">
          {(['all', 'active', 'reverted'] as const).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`
                flex-1 px-2 py-1 text-xs rounded transition-colors
                ${filter === f
                  ? 'bg-primary text-dark font-semibold'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                }
              `}
            >
              {f === 'all' ? 'Todas' : f === 'active' ? 'Ativas' : 'Revertidas'}
            </button>
          ))}
        </div>
      </div>

      {/* Message */}
      {message && (
        <div
          className={`
            mx-3 mt-2 p-2 rounded text-xs
            ${message.type === 'success'
              ? 'bg-green-900/50 text-green-300 border border-green-700'
              : 'bg-red-900/50 text-red-300 border border-red-700'
            }
          `}
        >
          {message.text}
        </div>
      )}

      {/* Entries list */}
      <div className="flex-1 overflow-y-auto p-3">
        {filteredHistory.length === 0 ? (
          <div className="text-center text-gray-500 text-sm py-4">
            Nenhuma operação com este filtro
          </div>
        ) : (
          filteredHistory.map(entry => {
            const { conflicts } = canRevertEntry(entry.id);
            return (
              <HistoryEntryItem
                key={entry.id}
                entry={entry}
                onRevert={handleRevert}
                onReapply={handleReapply}
                conflicts={entry.isReverted ? [] : conflicts}
              />
            );
          })
        )}
      </div>

      {/* Legend */}
      <div className="p-3 border-t border-gray-700">
        <div className="text-xs text-gray-500 mb-2">Legenda:</div>
        <div className="flex flex-wrap gap-2">
          {Object.entries(OPERATION_ICONS).slice(0, 6).map(([type, icon]) => (
            <div key={type} className="flex items-center gap-1">
              <span
                className={`w-4 h-4 flex items-center justify-center rounded text-[10px] font-bold text-white ${OPERATION_COLORS[type as HistoryOperationType]}`}
              >
                {icon}
              </span>
              <span className="text-xs text-gray-400">{type}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
