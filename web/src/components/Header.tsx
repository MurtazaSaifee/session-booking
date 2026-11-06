import { Link, NavLink } from "react-router";
import { useAuth } from "../auth/AuthProvider";
import { NotificationBell } from "../notifications/NotificationBell";
import { Role } from "../roles";

export function Header() {
  const { user, loading, logOut } = useAuth();

  return (
    <header className="header">
      <Link to="/" className="app-name">
        <span className="brand-dot" aria-hidden="true" />
        <span>Session Booking</span>
      </Link>

      {!loading &&
        (user ? (
          <nav className="account signed-in" aria-label="Main Navigation">
            <div className="nav-links">
              <NavLink to="/" end className={({ isActive }) => (isActive ? "nav-link active" : "nav-link")}>
                My sessions
              </NavLink>
              {user.role === Role.MEMBER && (
                <NavLink
                  to="/professionals"
                  className={({ isActive }) => (isActive ? "nav-link active" : "nav-link")}
                >
                  Professionals
                </NavLink>
              )}
              <NavLink
                to="/settings"
                className={({ isActive }) => (isActive ? "nav-link active" : "nav-link")}
              >
                Settings
              </NavLink>
            </div>

            <div className="user-badge" aria-label={`Logged in as ${user.name}`}>
              <span>{user.name}</span>
              <span className="user-role-tag">
                {user.role === Role.PROFESSIONAL ? "Professional" : "Member"}
              </span>
            </div>

            <span className="timezone-pill" title={`All times displayed in ${user.timezone}`}>
              🕒 {user.timezone}
            </span>
          </nav>
        ) : (
          <nav className="account">
            <NavLink to="/login" className={({ isActive }) => (isActive ? "nav-link active" : "nav-link")}>
              Log in
            </NavLink>
            <NavLink to="/signup" className={({ isActive }) => (isActive ? "nav-link active" : "nav-link")}>
              Sign up
            </NavLink>
          </nav>
        ))}

      {!loading && user && (
        <div className="header-actions">
          <NotificationBell />
          <button type="button" className="secondary logout-btn" onClick={logOut}>
            Log out
          </button>
        </div>
      )}
    </header>
  );
}
