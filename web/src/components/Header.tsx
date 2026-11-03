import { Link } from "react-router";
import { useAuth } from "../auth/AuthProvider";
import { Role } from "../roles";

export function Header() {
  const { user, loading, logOut } = useAuth();

  return (
    <header className="header">
      <span className="app-name">Session Booking</span>
      {!loading &&
        (user ? (
          <div className="account">
            <span>
              {user.name} · {user.role === Role.PROFESSIONAL ? "Professional" : "Member"}
            </span>
            <span>Times shown in {user.timezone}</span>
            <button type="button" className="secondary" onClick={logOut}>
              Log out
            </button>
          </div>
        ) : (
          <nav className="account">
            <Link to="/login">Log in</Link>
            <Link to="/signup">Sign up</Link>
          </nav>
        ))}
    </header>
  );
}
