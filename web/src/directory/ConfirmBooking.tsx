import type { Slot } from "./api";
import { localDate } from "./calendar";
import { formatDay, formatTimeRange } from "./format";

type ConfirmBookingProps = {
  professionalName: string;
  slot: Slot;
  timezone: string;
  onBack: () => void;
};

export function ConfirmBooking({ professionalName, slot, timezone, onBack }: ConfirmBookingProps) {
  return (
    <>
      <h2>Confirm your session</h2>
      <div className="confirm-details">
        <p className="confirm-name">{professionalName}</p>
        <p className="confirm-time">{formatDay(localDate(slot.start, timezone))}</p>
        <p className="confirm-time">{formatTimeRange(slot, timezone)}</p>
        <p className="hint">Times shown in {timezone}.</p>
      </div>
      <button type="button" className="secondary" onClick={onBack}>
        Back
      </button>
    </>
  );
}
