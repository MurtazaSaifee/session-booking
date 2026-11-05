import { formatFullDay, formatTimeRange, localDate } from "../time/format";
import { SessionStatus, type MySession } from "./api";
import { cancelledBy } from "./cancelledBy";

type SessionCardProps = { session: MySession; timezone: string };

export function SessionCard({ session, timezone }: SessionCardProps) {
  const cancelled = session.status === SessionStatus.CANCELLED;

  return (
    <li className={cancelled ? "session session-cancelled" : "session"}>
      <p className="session-name">{session.otherPersonName}</p>
      <p>{formatFullDay(localDate(session.start, timezone))}</p>
      <p>{formatTimeRange(session, timezone)}</p>
      {cancelled && <p className="session-cancelled-by">{cancelledBy(session)}</p>}
    </li>
  );
}
