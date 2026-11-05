import { ErrorMessage } from "../components/ErrorMessage";

type BookingNoticeProps = { booked: string | null; refusal: string | null };

export function BookingNotice({ booked, refusal }: BookingNoticeProps) {
  if (!booked && !refusal) return null;

  return (
    <div className="booking-notice">
      {booked && (
        <p role="status" className="status">
          {booked}
        </p>
      )}
      <ErrorMessage message={refusal} />
    </div>
  );
}
