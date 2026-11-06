import type { User } from "../auth/AuthProvider";
import { formatFullDay, formatTimeRange, localDate } from "../time/format";
import { SessionStatus, type MySession } from "./api";
import { cancelledLabel } from "./cancelledLabel";
import { CancelSessionButton } from "./CancelSessionButton";
import { ChangeButtonState, changeButtonState, TOO_LATE_MESSAGE } from "./changeRule";
import { RescheduleSessionButton } from "./RescheduleSessionButton";
import { useNow } from "./useNow";

type SessionCardProps = { session: MySession; user: User; onCancelled: () => void };

export function SessionCard({ session, user, onCancelled }: SessionCardProps) {
  const cancelled = session.status === SessionStatus.CANCELLED;
  const state = changeButtonState(session, user.role, useNow());

  return (
    <li className={cancelled ? "session session-cancelled" : "session"}>
      <div className="session-details">
        <p className="session-name">{session.otherPersonName}</p>
        <p>{formatFullDay(localDate(session.start, user.timezone))}</p>
        <p>{formatTimeRange(session, user.timezone)}</p>
        {cancelled && <p className="session-cancelled-by">{cancelledLabel(session)}</p>}
      </div>
      <div className="session-actions">
        <RescheduleSessionButton session={session} role={user.role} state={state} />
        <CancelSessionButton session={session} state={state} onCancelled={onCancelled} />
      </div>
      {state === ChangeButtonState.DISABLED && <p className="hint session-too-late">{TOO_LATE_MESSAGE}</p>}
    </li>
  );
}
