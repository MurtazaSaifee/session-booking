import { api, type Page } from "../api";

export const NOTIFICATIONS_PATH = "/notifications";

export type MyNotification = { id: string; text: string; createdAt: string };

export function getNotifications(cursor?: string): Promise<Page<MyNotification>> {
  const query = cursor === undefined ? "" : `?cursor=${encodeURIComponent(cursor)}`;
  return api<Page<MyNotification>>(`/notifications${query}`);
}

export async function getUnreadCount(): Promise<number> {
  const { unreadCount } = await api<{ unreadCount: number }>("/notifications/unread-count");
  return unreadCount;
}

// Marks first, so a reminder delivered in between shows in the list and still counts as unread after.
export async function openNotifications(): Promise<Page<MyNotification>> {
  await api<void>("/notifications/read", { method: "POST" });
  return getNotifications();
}
