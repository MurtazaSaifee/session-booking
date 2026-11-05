import type { User } from "../auth/AuthProvider";
import { ErrorMessage } from "../components/ErrorMessage";
import { useLoad } from "../useLoad";
import { openNotifications } from "./api";
import { NotificationList } from "./NotificationList";

export function NotificationsPage({ user }: { user: User }) {
  const { data: notifications, error } = useLoad(openNotifications);

  return (
    <section className="card">
      <h1>Notifications</h1>
      <p className="hint">Times shown in {user.timezone}.</p>
      {error ? (
        <ErrorMessage message={error} />
      ) : !notifications ? (
        <p>Loading your notifications…</p>
      ) : (
        <NotificationList first={notifications} timezone={user.timezone} />
      )}
    </section>
  );
}
