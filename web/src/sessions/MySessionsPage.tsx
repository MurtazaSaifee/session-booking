import type { User } from "../auth/AuthProvider";
import { ErrorMessage } from "../components/ErrorMessage";
import { useLoad } from "../useLoad";
import { getMySessions, SessionList } from "./api";
import { SessionSection } from "./SessionSection";

export function MySessionsPage({ user }: { user: User }) {
  const { data: sessions, error: loadError } = useLoad(getMySessions);
  const { timezone } = user;

  return (
    <section className="card">
      <h1>My sessions</h1>
      <p className="hint">Times shown in {timezone}.</p>
      {loadError ? (
        <ErrorMessage message={loadError} />
      ) : !sessions ? (
        <p>Loading your sessions…</p>
      ) : (
        <>
          <SessionSection
            title="Upcoming"
            emptyMessage="No upcoming sessions."
            list={SessionList.UPCOMING}
            first={sessions.upcoming}
            timezone={timezone}
          />
          <SessionSection
            title="Past"
            emptyMessage="No past sessions."
            list={SessionList.PAST}
            first={sessions.past}
            timezone={timezone}
          />
          <SessionSection
            title="Cancelled"
            emptyMessage="No cancelled sessions."
            list={SessionList.CANCELLED}
            first={sessions.cancelled}
            timezone={timezone}
          />
        </>
      )}
    </section>
  );
}
