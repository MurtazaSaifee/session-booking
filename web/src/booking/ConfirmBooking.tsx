import { useState } from "react";
import { errorMessage } from "../api";
import { ErrorMessage } from "../components/ErrorMessage";
import { formatDay, formatTimeRange, localDate } from "../time/format";
import { isBookingRefusal, type Slot } from "./api";

type ConfirmBookingProps = {
  professionalName: string;
  slot: Slot;
  timezone: string;
  title: string;
  saveLabel: string;
  save: () => Promise<void>;
  onBack: () => void;
  onSaved: () => void;
  onRefused: (message: string) => void;
};

// Confirms one chosen time, for a new booking or for moving a session. The caller says what saving does.
export function ConfirmBooking(props: ConfirmBookingProps) {
  const { professionalName, slot, timezone, title, saveLabel, save, onBack, onSaved, onRefused } = props;
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function confirm() {
    setSaving(true);
    setError(null);
    try {
      await save();
      onSaved();
    } catch (err) {
      if (isBookingRefusal(err)) {
        onRefused(err.message);
        return;
      }
      // Says nothing about the slot, and a retry is safe: if this one landed, the server refuses a second.
      setError(errorMessage(err));
      setSaving(false);
    }
  }

  return (
    <>
      <h2>{title}</h2>
      <div className="confirm-details">
        <p className="confirm-name">{professionalName}</p>
        <p className="confirm-time">{formatDay(localDate(slot.start, timezone))}</p>
        <p className="confirm-time">{formatTimeRange(slot, timezone)}</p>
        <p className="hint">Times shown in {timezone}.</p>
      </div>
      <ErrorMessage message={error} />
      <div className="confirm-actions">
        <button type="button" disabled={saving} onClick={confirm}>
          {saveLabel}
        </button>
        <button type="button" className="secondary" disabled={saving} onClick={onBack}>
          Back
        </button>
      </div>
    </>
  );
}
