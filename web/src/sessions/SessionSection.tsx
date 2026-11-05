import type { Page } from "../api";
import { PageControls } from "../components/PageControls";
import type { Role } from "../roles";
import { usePager } from "../usePager";
import { getNextSessions, type MySession, type SessionList } from "./api";
import { SessionCard } from "./SessionCard";

type SessionSectionProps = {
  title: string;
  emptyMessage: string;
  list: SessionList;
  first: Page<MySession>;
  timezone: string;
  role: Role;
  onCancelled: () => void;
};

export function SessionSection({
  title,
  emptyMessage,
  list,
  first,
  timezone,
  role,
  onCancelled,
}: SessionSectionProps) {
  const pager = usePager(first, (cursor) => getNextSessions(list, cursor));

  return (
    <section>
      <h2>{title}</h2>
      {pager.items.length === 0 ? (
        <p className="hint">{emptyMessage}</p>
      ) : (
        <ul className="sessions">
          {pager.items.map((session) => (
            <SessionCard
              key={session.id}
              session={session}
              timezone={timezone}
              role={role}
              onCancelled={onCancelled}
            />
          ))}
        </ul>
      )}
      <PageControls label={`${title} pages`} pager={pager} />
    </section>
  );
}
