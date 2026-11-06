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
  const [showModal, setShowModal] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleConfirmCancel() {
    setCancelling(true);
    setError(null);
    try {
      await cancelSession(session.id);
      setShowModal(false);
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
        onClick={() => setShowModal(true)}
      >
        Cancel session
      </button>
      {state === ChangeButtonState.DISABLED && <p className="hint">{TOO_LATE_MESSAGE}</p>}
      <ErrorMessage message={error} />

      {showModal && (
        <div className="modal-overlay" role="dialog" aria-modal="true">
          <div className="modal-content">
            <h3>Cancel session?</h3>
            <p>
              Are you sure you want to cancel your session with <strong>{session.otherPersonName}</strong>?
              They will be notified immediately.
            </p>
            <ErrorMessage message={error} />
            <div className="modal-actions">
              <button
                type="button"
                className="secondary"
                disabled={cancelling}
                onClick={() => setShowModal(false)}
              >
                Keep session
              </button>
              <button
                type="button"
                className="destructive"
                disabled={cancelling}
                onClick={handleConfirmCancel}
              >
                {cancelling ? "Cancelling…" : "Yes, cancel session"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
