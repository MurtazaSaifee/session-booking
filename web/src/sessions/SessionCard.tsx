import { useState } from "react";
import { errorMessage } from "../api";
import { ErrorMessage } from "../components/ErrorMessage";
import type { Role } from "../roles";
import { formatFullDay, formatTimeRange, localDate } from "../time/format";
import { cancelSession, SessionStatus, type MySession } from "./api";
import { cancelledLabel } from "./cancelledLabel";
import { CancelButton, cancelButton, TOO_LATE_MESSAGE } from "./cancelRule";

type SessionCardProps = { session: MySession; timezone: string; role: Role; onCancelled: () => void };

export function SessionCard({ session, timezone, role, onCancelled }: SessionCardProps) {
  const cancelled = session.status === SessionStatus.CANCELLED;
  // Read once when the card appears: the server has the final say if the page has been open a while.
  const [shownAt] = useState(() => new Date());
  const button = cancelButton(session, role, shownAt);
  const [cancelling, setCancelling] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function cancel() {
    setCancelling(true);
    setError(null);
    try {
      await cancelSession(session.id);
      onCancelled();
    } catch (err) {
      setError(errorMessage(err));
      setCancelling(false);
    }
  }

  return (
    <li className={cancelled ? "session session-cancelled" : "session"}>
      <p className="session-name">{session.otherPersonName}</p>
      <p>{formatFullDay(localDate(session.start, timezone))}</p>
      <p>{formatTimeRange(session, timezone)}</p>
      {cancelled && <p className="session-cancelled-by">{cancelledLabel(session)}</p>}
      {button !== CancelButton.HIDDEN && (
        <>
          <button
            type="button"
            className="secondary"
            disabled={button === CancelButton.DISABLED || cancelling}
            onClick={cancel}
          >
            Cancel session
          </button>
          {button === CancelButton.DISABLED && <p className="hint">{TOO_LATE_MESSAGE}</p>}
          <ErrorMessage message={error} />
        </>
      )}
    </li>
  );
}
