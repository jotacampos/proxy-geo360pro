import { useEffect, useState } from 'react';
import { useNotificationStore, type Notification, type NotificationType } from '../../stores/notificationStore';

interface ToastProps {
  notification: Notification;
  onClose: () => void;
}

const TYPE_STYLES: Record<NotificationType, { bg: string; border: string; icon: string }> = {
  success: {
    bg: 'bg-emerald-900/90',
    border: 'border-emerald-600',
    icon: '✓',
  },
  error: {
    bg: 'bg-red-900/90',
    border: 'border-red-600',
    icon: '✕',
  },
  warning: {
    bg: 'bg-amber-900/90',
    border: 'border-amber-600',
    icon: '⚠',
  },
  info: {
    bg: 'bg-blue-900/90',
    border: 'border-blue-600',
    icon: 'ℹ',
  },
};

function Toast({ notification, onClose }: ToastProps) {
  const [isExiting, setIsExiting] = useState(false);
  const styles = TYPE_STYLES[notification.type];

  // Handle exit animation
  const handleClose = () => {
    setIsExiting(true);
    setTimeout(onClose, 200); // Match animation duration
  };

  // Calculate remaining time for progress bar
  const [progress, setProgress] = useState(100);

  useEffect(() => {
    if (!notification.duration || notification.duration <= 0) return;

    const startTime = notification.createdAt;
    const duration = notification.duration;

    const interval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const remaining = Math.max(0, 100 - (elapsed / duration) * 100);
      setProgress(remaining);

      if (remaining <= 0) {
        clearInterval(interval);
      }
    }, 50);

    return () => clearInterval(interval);
  }, [notification.createdAt, notification.duration]);

  return (
    <div
      className={`
        relative overflow-hidden
        ${styles.bg} ${styles.border}
        border rounded-lg shadow-lg
        min-w-[280px] max-w-[400px]
        transform transition-all duration-200
        ${isExiting ? 'translate-x-full opacity-0' : 'translate-x-0 opacity-100'}
      `}
    >
      <div className="flex items-start gap-3 p-3">
        {/* Icon */}
        <div className={`flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold ${
          notification.type === 'success' ? 'bg-emerald-600 text-white' :
          notification.type === 'error' ? 'bg-red-600 text-white' :
          notification.type === 'warning' ? 'bg-amber-600 text-white' :
          'bg-blue-600 text-white'
        }`}>
          {styles.icon}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-white">{notification.title}</p>
          {notification.message && (
            <p className="mt-1 text-xs text-gray-300">{notification.message}</p>
          )}
        </div>

        {/* Close button */}
        <button
          onClick={handleClose}
          className="flex-shrink-0 text-gray-400 hover:text-white transition-colors"
        >
          <span className="text-lg leading-none">×</span>
        </button>
      </div>

      {/* Progress bar */}
      {notification.duration && notification.duration > 0 && (
        <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gray-700">
          <div
            className={`h-full transition-all duration-50 ${
              notification.type === 'success' ? 'bg-emerald-500' :
              notification.type === 'error' ? 'bg-red-500' :
              notification.type === 'warning' ? 'bg-amber-500' :
              'bg-blue-500'
            }`}
            style={{ width: `${progress}%` }}
          />
        </div>
      )}
    </div>
  );
}

export function NotificationContainer() {
  const { notifications, removeNotification } = useNotificationStore();

  if (notifications.length === 0) return null;

  return (
    <div className="fixed top-14 right-4 z-[100] flex flex-col gap-2">
      {notifications.map((notification) => (
        <Toast
          key={notification.id}
          notification={notification}
          onClose={() => removeNotification(notification.id)}
        />
      ))}
    </div>
  );
}
