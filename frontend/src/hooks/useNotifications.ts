import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { AppNotification } from '@/types';

export interface MyNotificationsData {
  notifications: AppNotification[];
  unreadCount: number;
}

// Polls every 30s -- simplest way to keep the bell close to real-time
// without standing up a websocket/SSE channel for what is, for now, a
// low-volume feed (a handful of leave/shift updates a day per employee).
export function useMyNotifications() {
  return useQuery({
    queryKey: ['notifications', 'mine'],
    queryFn: async () => (await api.get<MyNotificationsData>('/notifications/mine')).data,
    refetchInterval: 30_000,
  });
}

export function useMarkNotificationRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => (await api.patch(`/notifications/mine/${id}/read`)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }),
  });
}

export function useMarkAllNotificationsRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => (await api.patch('/notifications/mine/read-all')).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }),
  });
}
