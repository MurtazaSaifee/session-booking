import { Link } from "react-router";
import { useAuth } from "../auth/AuthProvider";
import { NotificationBell } from "../notifications/NotificationBell";
import { Role } from "../roles";

export function Header() {
  const { user, loading, logOut } = useAuth();

  return (
    <header className="header">
      <Link to="/" className="app-name">
        Session Booking
      </Link>
      {!loading &&
        (user ? (
          <div className="account">
            <span>
              {user.name} · {user.role === Role.PROFESSIONAL ? "Professional" : "Member"}
            </span>
            <Link to="/">My sessions</Link>
            {user.role === Role.PROFESSIONAL && <Link to="/settings">My hours and profile</Link>}
            {user.role === Role.MEMBER && <Link to="/professionals">Professionals</Link>}
            <NotificationBell />
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
