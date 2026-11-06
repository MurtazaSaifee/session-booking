import { useState } from "react";
import { errorMessage } from "../api";
import { ErrorMessage } from "../components/ErrorMessage";
import type { Role } from "../roles";
import { cancelSession, type MySession } from "./api";
import { ChangeButtonState, changeButtonState, TOO_LATE_MESSAGE } from "./changeRule";
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

  const state = changeButtonState(session, role, now);
  if (state === ChangeButtonState.HIDDEN) return null;

  return (
    <>
      <button
        type="button"
        className="secondary"
        disabled={state === ChangeButtonState.DISABLED || cancelling}
        onClick={cancel}
      >
        Cancel session
      </button>
      {state === ChangeButtonState.DISABLED && <p className="hint">{TOO_LATE_MESSAGE}</p>}
      <ErrorMessage message={error} />
    </>
  );
}
