import { useState } from "react";
import { errorMessage } from "../api";
import { ErrorMessage } from "../components/ErrorMessage";
import { rescheduleSession } from "../sessions/api";
import { formatDay, formatTimeRange, localDate } from "../time/format";
import { bookSession, isBookingRefusal, type Slot } from "./api";

type ConfirmBookingProps = {
  professionalId: string;
  professionalName: string;
  slot: Slot;
  timezone: string;
  // Set when moving this session instead of booking a new one.
  rescheduleSessionId?: string;
  onBack: () => void;
  onBooked: () => void;
  onRefused: (message: string) => void;
};

export function ConfirmBooking(props: ConfirmBookingProps) {
  const {
    professionalId,
    professionalName,
    slot,
    timezone,
    rescheduleSessionId,
    onBack,
    onBooked,
    onRefused,
  } = props;
  const [booking, setBooking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function book() {
    setBooking(true);
    setError(null);
    try {
      if (rescheduleSessionId) await rescheduleSession(rescheduleSessionId, slot.start);
      else await bookSession(professionalId, slot.start);
      onBooked();
    } catch (err) {
      if (isBookingRefusal(err)) {
        onRefused(err.message);
        return;
      }
      // Says nothing about the slot, and a retry is safe: if this one landed, the server refuses a second.
      setError(errorMessage(err));
      setBooking(false);
    }
  }

  return (
    <>
      <h2>{rescheduleSessionId ? "Confirm the new time" : "Confirm your session"}</h2>
      <div className="confirm-details">
        <p className="confirm-name">{professionalName}</p>
        <p className="confirm-time">{formatDay(localDate(slot.start, timezone))}</p>
        <p className="confirm-time">{formatTimeRange(slot, timezone)}</p>
        <p className="hint">Times shown in {timezone}.</p>
      </div>
      <ErrorMessage message={error} />
      <div className="confirm-actions">
        <button type="button" disabled={booking} onClick={book}>
          {rescheduleSessionId ? "Reschedule session" : "Book session"}
        </button>
        <button type="button" className="secondary" disabled={booking} onClick={onBack}>
          Back
        </button>
      </div>
    </>
  );
}
