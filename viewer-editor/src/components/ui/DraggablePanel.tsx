import { useState, useRef, useCallback, useEffect, type ReactNode } from 'react';

interface Position {
  x: number;
  y: number;
}

interface DraggablePanelProps {
  children: ReactNode;
  title: string;
  icon?: string;
  initialPosition?: Position;
  onClose?: () => void;
  className?: string;
  minWidth?: number;
}

export function DraggablePanel({
  children,
  title,
  icon,
  initialPosition = { x: 16, y: 64 },
  onClose,
  className = '',
  minWidth = 256,
}: DraggablePanelProps) {
  const [position, setPosition] = useState<Position>(initialPosition);
  const isDragging = useRef(false);
  const dragOffset = useRef<Position>({ x: 0, y: 0 });
  const panelRef = useRef<HTMLDivElement>(null);

  const handleMouseDown = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    // Only start drag from the header
    if ((e.target as HTMLElement).closest('[data-drag-handle]')) {
      isDragging.current = true;
      dragOffset.current = {
        x: e.clientX - position.x,
        y: e.clientY - position.y,
      };
      document.body.style.cursor = 'grabbing';
      document.body.style.userSelect = 'none';
    }
  }, [position]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging.current) return;

      const newX = e.clientX - dragOffset.current.x;
      const newY = e.clientY - dragOffset.current.y;

      // Keep panel within viewport bounds
      const maxX = window.innerWidth - (panelRef.current?.offsetWidth || 200);
      const maxY = window.innerHeight - (panelRef.current?.offsetHeight || 200);

      setPosition({
        x: Math.max(0, Math.min(newX, maxX)),
        y: Math.max(0, Math.min(newY, maxY)),
      });
    };

    const handleMouseUp = () => {
      isDragging.current = false;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, []);

  return (
    <div
      ref={panelRef}
      className={`fixed z-30 bg-gray-900/95 backdrop-blur-sm border border-gray-700 rounded-lg shadow-2xl ${className}`}
      style={{
        left: position.x,
        top: position.y,
        minWidth,
      }}
      onMouseDown={handleMouseDown}
    >
      {/* Draggable Header */}
      <div
        data-drag-handle
        className="flex items-center justify-between px-3 py-2 border-b border-gray-700 cursor-grab active:cursor-grabbing select-none"
      >
        <div className="flex items-center gap-2">
          {icon && <span>{icon}</span>}
          <span className="text-sm font-semibold text-emerald-400">{title}</span>
        </div>
        <div className="flex items-center gap-1">
          {/* Drag indicator */}
          <span className="text-gray-500 text-xs mr-2" title="Arraste para mover">
            ⋮⋮
          </span>
          {onClose && (
            <button
              onClick={onClose}
              className="p-1 text-gray-400 hover:text-white hover:bg-gray-700 rounded transition-colors"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      {children}
    </div>
  );
}
