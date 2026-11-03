import { useEffect, useState } from "react";
import { ErrorMessage } from "../components/ErrorMessage";
import { listProfessionals, type Professional } from "./api";
import { ProfessionalCard } from "./ProfessionalCard";

export function ProfessionalsPage() {
  const [professionals, setProfessionals] = useState<Professional[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    listProfessionals()
      .then((loaded) => {
        if (active) setProfessionals(loaded);
      })
      .catch((err) => {
        if (active) setLoadError(err instanceof Error ? err.message : "Something went wrong.");
      });
    return () => {
      active = false;
    };
  }, []);

  return (
    <section className="card">
      <h1>Professionals</h1>
      {loadError ? (
        <ErrorMessage message={loadError} />
      ) : !professionals ? (
        <p>Loading professionals…</p>
      ) : professionals.length === 0 ? (
        <p className="hint">No professionals yet.</p>
      ) : (
        <ul className="professionals">
          {professionals.map((professional) => (
            <ProfessionalCard key={professional.id} professional={professional} />
          ))}
        </ul>
      )}
    </section>
  );
}
