import { useState, useRef, useEffect, type ReactNode } from 'react';

interface PopoverProps {
  trigger: ReactNode;
  children: ReactNode;
  position?: 'bottom' | 'bottom-left' | 'bottom-right';
  className?: string;
}

export function Popover({ trigger, children, position = 'bottom', className = '' }: PopoverProps) {
  const [isOpen, setIsOpen] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        popoverRef.current &&
        !popoverRef.current.contains(event.target as Node) &&
        triggerRef.current &&
        !triggerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  // Close on Escape
  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen]);

  const positionClasses = {
    bottom: 'left-1/2 -translate-x-1/2 top-full mt-1',
    'bottom-left': 'left-0 top-full mt-1',
    'bottom-right': 'right-0 top-full mt-1',
  };

  return (
    <div className="relative">
      <div ref={triggerRef} onClick={() => setIsOpen(!isOpen)}>
        {trigger}
      </div>
      {isOpen && (
        <div
          ref={popoverRef}
          className={`absolute z-50 ${positionClasses[position]} ${className}`}
        >
          <div className="bg-gray-800 border border-gray-700 rounded-lg shadow-xl py-1 min-w-[160px]">
            {children}
          </div>
        </div>
      )}
    </div>
  );
}

interface PopoverItemProps {
  icon?: string;
  label: string;
  shortcut?: string;
  disabled?: boolean;
  onClick?: () => void;
}

export function PopoverItem({ icon, label, shortcut, disabled, onClick }: PopoverItemProps) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`w-full px-3 py-1.5 text-left text-sm flex items-center gap-2 ${
        disabled
          ? 'text-gray-500 cursor-not-allowed'
          : 'text-gray-300 hover:bg-gray-700 hover:text-white'
      }`}
    >
      {icon && <span className="w-4 text-center">{icon}</span>}
      <span className="flex-1">{label}</span>
      {shortcut && (
        <span className="text-xs text-gray-500 ml-2">{shortcut}</span>
      )}
    </button>
  );
}

export function PopoverDivider() {
  return <div className="border-t border-gray-700 my-1" />;
}
