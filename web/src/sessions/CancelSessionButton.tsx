import { useCallback, useEffect, useId, useRef, useState } from "react";
import { errorMessage } from "../api";
import { ErrorMessage } from "../components/ErrorMessage";
import type { Role } from "../roles";
import { cancelSession, type MySession } from "./api";
import { ChangeButtonState, changeButtonState, TOO_LATE_MESSAGE } from "./changeRule";
import { useNow } from "./useNow";

type CancelSessionButtonProps = { session: MySession; role: Role; onCancelled: () => void };

export function CancelSessionButton({ session, role, onCancelled }: CancelSessionButtonProps) {
  const now = useNow();
  const titleId = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [showModal, setShowModal] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function openModal() {
    setError(null);
    setShowModal(true);
  }

  const closeModal = useCallback(() => {
    if (cancelling) return;
    setShowModal(false);
    triggerRef.current?.focus();
  }, [cancelling]);

  // Lock body scroll and listen for Escape key when modal is open
  useEffect(() => {
    if (!showModal) return;

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        closeModal();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = originalOverflow;
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [showModal, closeModal]);

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
        ref={triggerRef}
        type="button"
        className="secondary"
        disabled={state === ChangeButtonState.DISABLED || cancelling}
        onClick={openModal}
      >
        Cancel session
      </button>
      {state === ChangeButtonState.DISABLED && <p className="hint">{TOO_LATE_MESSAGE}</p>}
      {!showModal && <ErrorMessage message={error} />}

      {showModal && (
        <div
          className="modal-overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              closeModal();
            }
          }}
        >
          <div className="modal-content">
            <h3 id={titleId}>Cancel session?</h3>
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
                onClick={closeModal}
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
