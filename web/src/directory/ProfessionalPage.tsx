import { useCallback } from "react";
import { Link, useParams } from "react-router";
import type { User } from "../auth/AuthProvider";
import { ErrorMessage } from "../components/ErrorMessage";
import { useLoad } from "../useLoad";
import { getProfessional } from "./api";
import { placeName } from "./place";
import { SlotCalendar } from "./SlotCalendar";

export function ProfessionalPage({ user }: { user: User }) {
  const { id } = useParams();

  return (
    <section className="card profile">
      <Link to="/professionals" className="back-link">
        All professionals
      </Link>
      {id && <ProfessionalDetails id={id} user={user} />}
    </section>
  );
}

function ProfessionalDetails({ id, user }: { id: string; user: User }) {
  const load = useCallback(() => getProfessional(id), [id]);
  const { data: professional, error: loadError } = useLoad(load);

  if (loadError) return <ErrorMessage message={loadError} />;
  if (!professional) return <p>Loading…</p>;
  return (
    <>
      <h1>{professional.name}</h1>
      {professional.title && <p className="profile-title">{professional.title}</p>}
      <p className="hint">Based in {placeName(professional.timezone)}</p>
      {professional.bio && <p className="profile-bio">{professional.bio}</p>}
      <SlotCalendar professionalId={professional.id} timezone={user.timezone} />
    </>
  );
}
