import { useCallback } from "react";
import { Link, useNavigate, useParams } from "react-router";
import type { User } from "../auth/AuthProvider";
import { SlotCalendar } from "../booking/SlotCalendar";
import { ErrorMessage } from "../components/ErrorMessage";
import { formatFullDay, formatTimeRange, localDate } from "../time/format";
import { useLoad } from "../useLoad";
import { getMySession, SessionStatus } from "./api";

export function RescheduleSessionPage({ user }: { user: User }) {
  const { id } = useParams();

  return (
    <section className="card profile">
      <Link to="/" className="back-link">
        My sessions
      </Link>
      {id && <RescheduleDetails id={id} user={user} />}
    </section>
  );
}

function RescheduleDetails({ id, user }: { id: string; user: User }) {
  const navigate = useNavigate();
  const load = useCallback(() => getMySession(id), [id]);
  const { data: session, error: loadError } = useLoad(load);

  if (loadError) return <ErrorMessage message={loadError} />;
  if (!session) return <p>Loading…</p>;
  if (session.status !== SessionStatus.BOOKED || !session.professionalId) {
    return <p>This session can't be rescheduled.</p>;
  }
  return (
    <>
      <h1>Reschedule your session</h1>
      <p>With {session.otherPersonName}</p>
      <p className="hint">
        Now: {formatFullDay(localDate(session.start, user.timezone))},{" "}
        {formatTimeRange(session, user.timezone)}
      </p>
      <SlotCalendar
        professionalId={session.professionalId}
        professionalName={session.otherPersonName}
        timezone={user.timezone}
        reschedule={{ sessionId: session.id, onMoved: () => navigate("/") }}
      />
    </>
  );
}
