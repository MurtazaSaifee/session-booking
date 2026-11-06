import { useCallback, useEffect, useId, useRef, useState } from "react";
import { errorMessage } from "../api";
import { ErrorMessage } from "../components/ErrorMessage";
import { CancelIcon } from "../components/icons";
import { cancelSession, type MySession } from "./api";
import { ChangeButtonState } from "./changeRule";

type CancelSessionButtonProps = { session: MySession; state: ChangeButtonState; onCancelled: () => void };

export function CancelSessionButton({ session, state, onCancelled }: CancelSessionButtonProps) {
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

  if (state === ChangeButtonState.HIDDEN) return null;

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        className="secondary icon-button icon-button-danger"
        aria-label="Cancel session"
        title="Cancel session"
        disabled={state === ChangeButtonState.DISABLED || cancelling}
        onClick={openModal}
      >
        <CancelIcon />
      </button>

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
              <button type="button" className="secondary" disabled={cancelling} onClick={closeModal}>
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
