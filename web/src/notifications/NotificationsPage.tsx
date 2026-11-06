import { useLocation } from "react-router";
import type { User } from "../auth/AuthProvider";
import { BackNav } from "../components/BackNav";
import { ErrorMessage } from "../components/ErrorMessage";
import { useLoad } from "../useLoad";
import { openNotifications } from "./api";
import { NotificationList } from "./NotificationList";

// Clicking the bell while here is a new visit with a new location key: it starts again from the first page,
// marks the new arrivals read and shows them.
export function NotificationsPage({ user }: { user: User }) {
  const { key } = useLocation();
  return <NotificationsCard key={key} timezone={user.timezone} />;
}

function NotificationsCard({ timezone }: { timezone: string }) {
  const { data: notifications, error } = useLoad(openNotifications);

  return (
    <section className="card">
      <BackNav to="/" label="My sessions" />
      <h1>Notifications</h1>
      {error ? (
        <ErrorMessage message={error} />
      ) : !notifications ? (
        <p className="hint">Loading your notifications…</p>
      ) : (
        <NotificationList first={notifications} timezone={timezone} />
      )}
    </section>
  );
}
