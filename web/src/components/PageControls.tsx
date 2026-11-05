import type { Pager } from "../usePager";
import { ErrorMessage } from "./ErrorMessage";

type PageControlsProps = { label: string; pager: Pager<unknown> };

// A list that fits on one page shows no controls.
export function PageControls({ label, pager }: PageControlsProps) {
  const { hasPrevious, hasNext, loading, error, previous, next } = pager;
  if (!hasPrevious && !hasNext) return null;

  return (
    <>
      <ErrorMessage message={error} />
      <nav className="page-controls" aria-label={label}>
        <button type="button" className="secondary" disabled={!hasPrevious || loading} onClick={previous}>
          Previous
        </button>
        <button type="button" className="secondary" disabled={!hasNext || loading} onClick={next}>
          Next
        </button>
      </nav>
    </>
  );
}
