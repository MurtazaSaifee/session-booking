import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router";
import { getUnreadCount, NOTIFICATIONS_PATH } from "./api";

const REFRESH_MS = 30_000;

export function NotificationBell() {
  const { key, pathname } = useLocation();
  const opensList = pathname === NOTIFICATIONS_PATH;
  const [unread, setUnread] = useState(0);
  const [lastKey, setLastKey] = useState(key);

  // Opening the list marks everything read, so the count clears at once rather than waiting for a refresh.
  if (key !== lastKey) {
    setLastKey(key);
    if (opensList) setUnread(0);
  }

  // Runs on every navigation, including a click on the bell while already on the list (a new location key).
  useEffect(() => {
    let active = true;
    function refresh() {
      getUnreadCount()
        .then((count) => {
          if (active) setUnread(count);
        })
        // The count stays as it was, and the next refresh tries again.
        .catch(() => {});
    }
    // Asking while the list is opening could bring back the old count, so the first ask there waits for the timer.
    if (!opensList) refresh();
    const timer = setInterval(refresh, REFRESH_MS);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [key, opensList]);

  return (
    <Link
      to={NOTIFICATIONS_PATH}
      className="bell"
      aria-label={unread > 0 ? `Notifications, ${unread} unread` : "Notifications"}
    >
      <svg viewBox="0 0 24 24" className="bell-icon" aria-hidden="true">
        <path d="M6 16V11a6 6 0 0 1 12 0v5l2 2H4zM10 20a2 2 0 0 0 4 0" />
      </svg>
      {unread > 0 && <span className="bell-count">{unread}</span>}
    </Link>
  );
}
