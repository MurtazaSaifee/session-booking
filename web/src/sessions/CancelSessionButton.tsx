import { useState } from "react";
import { errorMessage } from "../api";
import { ErrorMessage } from "../components/ErrorMessage";
import type { Role } from "../roles";
import { cancelSession, type MySession } from "./api";
import { CancelButtonState, cancelButtonState, TOO_LATE_MESSAGE } from "./cancelRule";
import { useNow } from "./useNow";

type CancelSessionButtonProps = { session: MySession; role: Role; onCancelled: () => void };

export function CancelSessionButton({ session, role, onCancelled }: CancelSessionButtonProps) {
  const now = useNow();
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
