import { useEffect, useState } from "react";
import { Link, useParams } from "react-router";
import type { User } from "../auth/AuthProvider";
import { ErrorMessage } from "../components/ErrorMessage";
import { getProfessional, type Professional } from "./api";
import { placeName } from "./place";
import { SlotCalendar } from "./SlotCalendar";

export function ProfessionalPage({ user }: { user: User }) {
  const { id } = useParams();
  const [professional, setProfessional] = useState<Professional | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    let active = true;
    getProfessional(id)
      .then((loaded) => {
        if (active) setProfessional(loaded);
      })
      .catch((err) => {
        if (active) setLoadError(err instanceof Error ? err.message : "Something went wrong.");
      });
    return () => {
      active = false;
    };
  }, [id]);

  return (
    <section className="card profile">
      <Link to="/professionals" className="back-link">
        All professionals
      </Link>
      {loadError ? (
        <ErrorMessage message={loadError} />
      ) : !professional ? (
        <p>Loading…</p>
      ) : (
        <>
          <h1>{professional.name}</h1>
          {professional.title && <p className="profile-title">{professional.title}</p>}
          <p className="hint">Based in {placeName(professional.timezone)}</p>
          {professional.bio && <p className="profile-bio">{professional.bio}</p>}
          <SlotCalendar professionalId={professional.id} timeZone={user.timezone} />
        </>
      )}
    </section>
  );
}
