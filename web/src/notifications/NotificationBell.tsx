import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router";
import { getNotifications, NOTIFICATIONS_PATH } from "./api";

const REFRESH_MS = 30_000;

export function NotificationBell() {
  const { pathname } = useLocation();
  const [unread, setUnread] = useState(0);

  // Refreshing on every page change also picks up the cleared count on leaving the list.
  useEffect(() => {
    let active = true;
    function refresh() {
      getNotifications()
        .then((page) => {
          if (active) setUnread(page.unreadCount);
        })
        // The count stays as it was, and the next refresh tries again.
        .catch(() => {});
    }
    refresh();
    const timer = setInterval(refresh, REFRESH_MS);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [pathname]);

  // Opening the list marks everything read, so the badge goes as soon as it opens.
  const shown = pathname === NOTIFICATIONS_PATH ? 0 : unread;

  return (
    <Link
      to={NOTIFICATIONS_PATH}
      className="bell"
      aria-label={shown > 0 ? `Notifications, ${shown} unread` : "Notifications"}
    >
      <svg viewBox="0 0 24 24" className="bell-icon" aria-hidden="true">
        <path d="M6 16V11a6 6 0 0 1 12 0v5l2 2H4zM10 20a2 2 0 0 0 4 0" />
      </svg>
      {shown > 0 && <span className="bell-count">{shown}</span>}
    </Link>
  );
}
