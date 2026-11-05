import type { Page } from "../api";
import { PageControls } from "../components/PageControls";
import { formatFullDay, formatTime, localDate } from "../time/format";
import { usePager } from "../usePager";
import { getNotifications, type MyNotification } from "./api";

type NotificationListProps = { first: Page<MyNotification>; timezone: string };

export function NotificationList({ first, timezone }: NotificationListProps) {
  const pager = usePager(first, getNotifications);

  if (pager.items.length === 0) return <p className="hint">No notifications yet.</p>;

  return (
    <>
      <ul className="notifications">
        {pager.items.map((notification) => (
          <li key={notification.id} className="notification">
            <p>{notification.text}</p>
            <p className="notification-time">
              {formatFullDay(localDate(notification.createdAt, timezone))},{" "}
              {formatTime(notification.createdAt, timezone)}
            </p>
          </li>
        ))}
      </ul>
      <PageControls label="Notification pages" pager={pager} />
    </>
  );
}
