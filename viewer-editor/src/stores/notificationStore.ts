import { create } from 'zustand';

export type NotificationType = 'success' | 'error' | 'warning' | 'info';

export interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  message?: string;
  duration?: number; // ms, default 3000
  createdAt: number;
}

interface NotificationStore {
  notifications: Notification[];
  addNotification: (notification: Omit<Notification, 'id' | 'createdAt'>) => string;
  removeNotification: (id: string) => void;
  clearNotifications: () => void;
}

const generateId = () => crypto.randomUUID();

export const useNotificationStore = create<NotificationStore>((set, get) => ({
  notifications: [],

  addNotification: (notification) => {
    const id = generateId();
    const newNotification: Notification = {
      ...notification,
      id,
      duration: notification.duration ?? 3000,
      createdAt: Date.now(),
    };

    set((state) => ({
      notifications: [...state.notifications, newNotification],
    }));

    // Auto-remove after duration
    if (newNotification.duration && newNotification.duration > 0) {
      setTimeout(() => {
        get().removeNotification(id);
      }, newNotification.duration);
    }

    return id;
  },

  removeNotification: (id) =>
    set((state) => ({
      notifications: state.notifications.filter((n) => n.id !== id),
    })),

  clearNotifications: () => set({ notifications: [] }),
}));

// Helper functions for common notifications
export const notify = {
  success: (title: string, message?: string, duration?: number) =>
    useNotificationStore.getState().addNotification({ type: 'success', title, message, duration }),

  error: (title: string, message?: string, duration?: number) =>
    useNotificationStore.getState().addNotification({ type: 'error', title, message, duration: duration ?? 5000 }),

  warning: (title: string, message?: string, duration?: number) =>
    useNotificationStore.getState().addNotification({ type: 'warning', title, message, duration }),

  info: (title: string, message?: string, duration?: number) =>
    useNotificationStore.getState().addNotification({ type: 'info', title, message, duration }),
};
