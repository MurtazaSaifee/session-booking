import { useCallback } from "react";
import { useNavigate, useParams } from "react-router";
import type { User } from "../auth/AuthProvider";
import { SlotCalendar } from "../booking/SlotCalendar";
import { BackNav } from "../components/BackNav";
import { ErrorMessage } from "../components/ErrorMessage";
import { Loading } from "../components/Loading";
import { formatFullDay, formatTimeRange, localDate } from "../time/format";
import { useLoad } from "../useLoad";
import { getMySession, SessionStatus } from "./api";

export function RescheduleSessionPage({ user }: { user: User }) {
  const { id } = useParams();

  return (
    <section className="card profile">
      <BackNav to="/" label="My sessions" />
      {id && <RescheduleDetails id={id} user={user} />}
    </section>
  );
}

function RescheduleDetails({ id, user }: { id: string; user: User }) {
  const navigate = useNavigate();
  const load = useCallback(() => getMySession(id), [id]);
  const { data: session, error: loadError } = useLoad(load);

  if (loadError) return <ErrorMessage message={loadError} />;
  if (!session) return <Loading />;
  if (session.status !== SessionStatus.BOOKED || !session.professionalId) {
    return <p className="hint">This session can't be rescheduled.</p>;
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
        reschedule={{
          sessionId: session.id,
          currentStart: session.start,
          onMoved: () => navigate("/"),
        }}
      />
    </>
  );
}
