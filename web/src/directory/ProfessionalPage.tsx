import { useCallback } from "react";
import { useParams } from "react-router";
import type { User } from "../auth/AuthProvider";
import { SlotCalendar } from "../booking/SlotCalendar";
import { BackNav } from "../components/BackNav";
import { ErrorMessage } from "../components/ErrorMessage";
import { Loading } from "../components/Loading";
import { useLoad } from "../useLoad";
import { getProfessional } from "./api";
import { placeName } from "./place";

export function ProfessionalPage({ user }: { user: User }) {
  const { id } = useParams();

  return (
    <section className="card profile">
      <BackNav to="/professionals" label="All professionals" />
      {id && <ProfessionalDetails id={id} user={user} />}
    </section>
  );
}

function ProfessionalDetails({ id, user }: { id: string; user: User }) {
  const load = useCallback(() => getProfessional(id), [id]);
  const { data: professional, error: loadError } = useLoad(load);

  if (loadError) return <ErrorMessage message={loadError} />;
  if (!professional) return <Loading />;
  return (
    <>
      <h1>{professional.name}</h1>
      {professional.title && <p className="profile-title">{professional.title}</p>}
      <p className="hint">Based in {placeName(professional.timezone)}</p>
      {professional.bio && <p className="profile-bio">{professional.bio}</p>}
      <SlotCalendar
        professionalId={professional.id}
        professionalName={professional.name}
        timezone={user.timezone}
      />
    </>
  );
}
