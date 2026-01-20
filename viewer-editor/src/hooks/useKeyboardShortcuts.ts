import { useEffect, useCallback } from 'react';
import { useEditorStore } from '../stores/editorStore';

interface KeyboardShortcut {
  key: string;
  ctrl?: boolean;
  shift?: boolean;
  alt?: boolean;
  action: () => void;
  description: string;
}

export function useKeyboardShortcuts() {
  const {
    setMode,
    mode,
    undo,
    redo,
    canUndo,
    canRedo,
    deleteFeatures,
    selectedIndexes,
    clearSelection,
    snapEnabled,
    setSnapEnabled,
    clearDrawingCoordinates,
    setIsDrawing,
    setMeasurementMode,
    clearMeasurementResults,
  } = useEditorStore();

  const shortcuts: KeyboardShortcut[] = [
    // Drawing modes
    { key: 'v', action: () => setMode('view'), description: 'View/Navigate mode' },
    { key: 'p', action: () => setMode('draw-point'), description: 'Draw Point' },
    { key: 'l', action: () => setMode('draw-line'), description: 'Draw Line' },
    { key: 'g', action: () => setMode('draw-polygon'), description: 'Draw Polygon' },
    { key: 't', action: () => setMode('draw-rectangle'), description: 'Draw Rectangle' },
    { key: 'c', action: () => setMode('draw-circle'), description: 'Draw Circle' },

    // Edit modes
    { key: 'e', action: () => setMode('modify'), description: 'Edit Vertices' },
    { key: 'm', action: () => setMode('translate'), description: 'Move/Translate' },
    { key: 'r', action: () => setMode('rotate'), description: 'Rotate' },

    // Delete
    {
      key: 'd',
      action: () => {
        if (selectedIndexes.length > 0) {
          deleteFeatures(selectedIndexes);
        }
      },
      description: 'Delete selected'
    },
    {
      key: 'Delete',
      action: () => {
        if (selectedIndexes.length > 0) {
          deleteFeatures(selectedIndexes);
        }
      },
      description: 'Delete selected'
    },
    {
      key: 'Backspace',
      action: () => {
        if (selectedIndexes.length > 0) {
          deleteFeatures(selectedIndexes);
        }
      },
      description: 'Delete selected'
    },

    // Snap toggle
    { key: 's', action: () => setSnapEnabled(!snapEnabled), description: 'Toggle Snap' },

    // Measurement modes
    { key: 'x', action: () => setMeasurementMode('distance'), description: 'Measure Distance' },
    { key: 'a', action: () => setMeasurementMode('area'), description: 'Measure Area' },
    { key: 'x', shift: true, action: () => clearMeasurementResults(), description: 'Clear Measurements' },

    // Undo/Redo
    { key: 'z', ctrl: true, action: () => canUndo() && undo(), description: 'Undo' },
    { key: 'y', ctrl: true, action: () => canRedo() && redo(), description: 'Redo' },
    { key: 'z', ctrl: true, shift: true, action: () => canRedo() && redo(), description: 'Redo (Ctrl+Shift+Z)' },

    // Cancel/Escape
    {
      key: 'Escape',
      action: () => {
        // Cancel drawing first
        clearDrawingCoordinates();
        setIsDrawing(false);
        // Then clear selection
        clearSelection();
        // Return to view mode
        setMode('view');
      },
      description: 'Cancel/Deselect'
    },
  ];

  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    // Ignore if user is typing in an input field
    const target = event.target as HTMLElement;
    if (
      target.tagName === 'INPUT' ||
      target.tagName === 'TEXTAREA' ||
      target.tagName === 'SELECT' ||
      target.isContentEditable
    ) {
      return;
    }

    const key = event.key;
    const ctrl = event.ctrlKey || event.metaKey;
    const shift = event.shiftKey;
    const alt = event.altKey;

    for (const shortcut of shortcuts) {
      const matchKey = shortcut.key.toLowerCase() === key.toLowerCase();
      const matchCtrl = (shortcut.ctrl ?? false) === ctrl;
      const matchShift = (shortcut.shift ?? false) === shift;
      const matchAlt = (shortcut.alt ?? false) === alt;

      if (matchKey && matchCtrl && matchShift && matchAlt) {
        event.preventDefault();
        shortcut.action();
        return;
      }
    }
  }, [shortcuts, snapEnabled, selectedIndexes, mode]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [handleKeyDown]);

  return { shortcuts };
}

// Export shortcut definitions for display in UI
export const SHORTCUT_DEFINITIONS = [
  { key: 'V', description: 'Navegação' },
  { key: 'P', description: 'Desenhar Ponto' },
  { key: 'L', description: 'Desenhar Linha' },
  { key: 'G', description: 'Desenhar Polígono' },
  { key: 'T', description: 'Desenhar Retângulo' },
  { key: 'C', description: 'Desenhar Círculo' },
  { key: 'E', description: 'Editar Vértices' },
  { key: 'M', description: 'Mover' },
  { key: 'R', description: 'Rotacionar' },
  { key: 'D / Del', description: 'Deletar selecionado' },
  { key: 'S', description: 'Toggle Snap' },
  { key: 'X', description: 'Medir Distância' },
  { key: 'A', description: 'Medir Área' },
  { key: 'Shift+X', description: 'Limpar Medições' },
  { key: 'Ctrl+Z', description: 'Desfazer' },
  { key: 'Ctrl+Y', description: 'Refazer' },
  { key: 'Esc', description: 'Cancelar/Desselecionar' },
];
