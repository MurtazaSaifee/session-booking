import type { User } from "../auth/AuthProvider";
import { ErrorMessage } from "../components/ErrorMessage";
import { useLoad } from "../useLoad";
import { getMySessions, SessionList } from "./api";
import { SessionSection } from "./SessionSection";

const sections = [
  { key: "upcoming", list: SessionList.UPCOMING, title: "Upcoming", emptyMessage: "No upcoming sessions." },
  { key: "past", list: SessionList.PAST, title: "Past", emptyMessage: "No past sessions." },
  {
    key: "cancelled",
    list: SessionList.CANCELLED,
    title: "Cancelled",
    emptyMessage: "No cancelled sessions.",
  },
] as const;

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
        sections.map((section) => (
          <SessionSection
            key={section.list}
            title={section.title}
            emptyMessage={section.emptyMessage}
            list={section.list}
            first={sessions[section.key]}
            timezone={timezone}
          />
        ))
      )}
    </section>
  );
}
