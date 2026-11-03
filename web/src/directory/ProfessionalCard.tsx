import { Link } from "react-router";
import type { Professional } from "./api";

export function ProfessionalCard({ professional }: { professional: Professional }) {
  const { id, name, title, bio } = professional;

  return (
    <li className="professional">
      <Link to={`/professionals/${id}`} className="professional-name">
        {name}
      </Link>
      {title && <p className="professional-title">{title}</p>}
      {bio && <p className="professional-bio">{bio.split("\n")[0]}</p>}
    </li>
  );
}
