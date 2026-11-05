import { api, type Page } from "../api";

export const NOTIFICATIONS_PATH = "/notifications";

export type MyNotification = { id: string; text: string; createdAt: string };

export type MyNotifications = Page<MyNotification> & { unreadCount: number };

export function getNotifications(cursor?: string): Promise<MyNotifications> {
  const query = cursor === undefined ? "" : `?cursor=${encodeURIComponent(cursor)}`;
  return api<MyNotifications>(`/notifications${query}`);
}

// Marks first, so a reminder delivered in between shows in the list and still counts as unread after.
export async function openNotifications(): Promise<MyNotifications> {
  await api<void>("/notifications/read", { method: "POST" });
  return getNotifications();
}
