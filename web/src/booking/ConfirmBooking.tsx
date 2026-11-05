import { useState } from "react";
import { ErrorMessage } from "../components/ErrorMessage";
import { formatDay, formatTimeRange } from "../time/format";
import { bookSession, isBookingRefusal, type Slot } from "./api";
import { localDate } from "./calendar";

type ConfirmBookingProps = {
  professionalId: string;
  professionalName: string;
  slot: Slot;
  timezone: string;
  onBack: () => void;
  onBooked: () => void;
  onRefused: (message: string) => void;
};

export function ConfirmBooking(props: ConfirmBookingProps) {
  const { professionalId, professionalName, slot, timezone, onBack, onBooked, onRefused } = props;
  const [booking, setBooking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function book() {
    setBooking(true);
    setError(null);
    try {
      await bookSession(professionalId, slot.start);
      onBooked();
    } catch (err) {
      if (isBookingRefusal(err)) {
        onRefused(err.message);
        return;
      }
      // Says nothing about the slot, and a retry is safe: if this one landed, the server refuses a second.
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setBooking(false);
    }
  }

  return (
    <>
      <h2>Confirm your session</h2>
      <div className="confirm-details">
        <p className="confirm-name">{professionalName}</p>
        <p className="confirm-time">{formatDay(localDate(slot.start, timezone))}</p>
        <p className="confirm-time">{formatTimeRange(slot, timezone)}</p>
        <p className="hint">Times shown in {timezone}.</p>
      </div>
      <ErrorMessage message={error} />
      <div className="confirm-actions">
        <button type="button" disabled={booking} onClick={book}>
          Book session
        </button>
        <button type="button" className="secondary" disabled={booking} onClick={onBack}>
          Back
        </button>
      </div>
    </>
  );
}
