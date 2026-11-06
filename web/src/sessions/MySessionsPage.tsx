import { useState } from "react";
import { Link } from "react-router";
import type { User } from "../auth/AuthProvider";
import { ErrorMessage } from "../components/ErrorMessage";
import { Role } from "../roles";
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
  const { data: sessions, error: loadError, reload } = useLoad(getMySessions);
  const isMember = user.role === Role.MEMBER;
  const [shown, setShown] = useState<(typeof sections)[number]>(sections[0]);

  return (
    <section className="card">
      <div className="sessions-header-row">
        <div>
          <h1>My sessions</h1>
        </div>
        {isMember && (
          <Link to="/professionals" className="book-session-cta-btn">
            + Book a session
          </Link>
        )}
      </div>

      {isMember && sessions && sessions.upcoming.items.length === 0 && (
        <div className="home-booking-hero">
          <div className="hero-text">
            <h3>Find support that fits your schedule</h3>
            <p>Connect with licensed mental health counsellors, psychologists, and certified coaches.</p>
          </div>
          <Link to="/professionals" className="hero-cta-btn">
            Browse professionals →
          </Link>
        </div>
      )}

      {loadError ? (
        <ErrorMessage message={loadError} />
      ) : !sessions ? (
        <p className="hint">Loading your sessions…</p>
      ) : (
        <>
          <div className="session-tabs" role="group" aria-label="Session lists">
            {sections.map((section) => (
              <button
                key={section.key}
                type="button"
                className={section === shown ? "session-tab active" : "session-tab"}
                aria-pressed={section === shown}
                onClick={() => setShown(section)}
              >
                {section.title}
              </button>
            ))}
          </div>
          <SessionSection
            key={shown.list}
            title={shown.title}
            emptyMessage={shown.emptyMessage}
            list={shown.list}
            first={sessions[shown.key]}
            user={user}
            onCancelled={reload}
          />
        </>
      )}
    </section>
  );
}
