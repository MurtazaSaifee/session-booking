import { useEffect, useState } from "react";
import { errorMessage } from "../api";
import { ErrorMessage } from "../components/ErrorMessage";
import type { Role } from "../roles";
import { cancelSession, type MySession } from "./api";
import { CancelButtonState, cancelButtonState, TOO_LATE_MESSAGE } from "./cancelRule";

const RECHECK_MS = 30_000;

type CancelSessionButtonProps = { session: MySession; role: Role; onCancelled: () => void };

export function CancelSessionButton({ session, role, onCancelled }: CancelSessionButtonProps) {
  // Rechecked so a page left open disables the button soon after the 24 hours pass.
  const [now, setNow] = useState(() => new Date());
  const [cancelling, setCancelling] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), RECHECK_MS);
    return () => clearInterval(timer);
  }, []);

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

  const state = cancelButtonState(session, role, now);
  if (state === CancelButtonState.HIDDEN) return null;

  return (
    <>
      <button
        type="button"
        className="secondary"
        disabled={state === CancelButtonState.DISABLED || cancelling}
        onClick={cancel}
      >
        Cancel session
      </button>
      {state === CancelButtonState.DISABLED && <p className="hint">{TOO_LATE_MESSAGE}</p>}
      <ErrorMessage message={error} />
    </>
  );
}
