import { Link, useNavigate } from "react-router";

type BackNavProps = {
  label?: string;
  to?: string;
};

export function BackNav({ label = "Back", to }: BackNavProps) {
  const navigate = useNavigate();

  if (to) {
    return (
      <Link to={to} className="back-nav">
        <span aria-hidden="true">←</span>
        <span>Back to {label}</span>
      </Link>
    );
  }

  return (
    <button type="button" className="back-nav" onClick={() => navigate(-1)}>
      <span aria-hidden="true">←</span>
      <span>Back</span>
    </button>
  );
}
