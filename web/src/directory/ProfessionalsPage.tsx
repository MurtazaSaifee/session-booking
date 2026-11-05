import type { Page } from "../api";
import { ErrorMessage } from "../components/ErrorMessage";
import { PageControls } from "../components/PageControls";
import { usePager } from "../usePager";
import { useLoad } from "../useLoad";
import { listNextProfessionals, listProfessionals, type Professional } from "./api";
import { ProfessionalCard } from "./ProfessionalCard";

export function ProfessionalsPage() {
  const { data: first, error: loadError } = useLoad(listProfessionals);

  return (
    <section className="card">
      <h1>Professionals</h1>
      {loadError ? (
        <ErrorMessage message={loadError} />
      ) : !first ? (
        <p>Loading professionals…</p>
      ) : (
        <ProfessionalList first={first} />
      )}
    </section>
  );
}

function ProfessionalList({ first }: { first: Page<Professional> }) {
  const pager = usePager(first, listNextProfessionals);

  if (pager.items.length === 0) return <p className="hint">No professionals yet.</p>;
  return (
    <>
      <ul className="professionals">
        {pager.items.map((professional) => (
          <ProfessionalCard key={professional.id} professional={professional} />
        ))}
      </ul>
      <PageControls label="Professionals pages" pager={pager} />
    </>
  );
}
