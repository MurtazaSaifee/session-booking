import type { User } from "../auth/AuthProvider";
import { formatFullDay, formatTimeRange, localDate } from "../time/format";
import { SessionStatus, type MySession } from "./api";
import { cancelledLabel } from "./cancelledLabel";
import { CancelSessionButton } from "./CancelSessionButton";
import { RescheduleSessionButton } from "./RescheduleSessionButton";

type SessionCardProps = { session: MySession; user: User; onCancelled: () => void };

export function SessionCard({ session, user, onCancelled }: SessionCardProps) {
  const cancelled = session.status === SessionStatus.CANCELLED;

  return (
    <li className={cancelled ? "session session-cancelled" : "session"}>
      <p className="session-name">{session.otherPersonName}</p>
      <p>{formatFullDay(localDate(session.start, user.timezone))}</p>
      <p>{formatTimeRange(session, user.timezone)}</p>
      {cancelled && <p className="session-cancelled-by">{cancelledLabel(session)}</p>}
      <div className="session-actions">
        <RescheduleSessionButton session={session} role={user.role} />
        <CancelSessionButton session={session} role={user.role} onCancelled={onCancelled} />
      </div>
    </li>
  );
}
