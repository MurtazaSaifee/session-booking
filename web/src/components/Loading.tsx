export function Loading({ label = "Loading…" }: { label?: string }) {
  return (
    <p role="status" className="hint loading">
      {label}
    </p>
  );
}
