import { ErrorMessage } from "../components/ErrorMessage";
import { useLoad } from "../useLoad";
import { listProfessionals } from "./api";
import { ProfessionalCard } from "./ProfessionalCard";

export function ProfessionalsPage() {
  const { data: professionals, error: loadError } = useLoad(listProfessionals);

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
