import type { ReactNode } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router";
import { AuthProvider, useAuth, type User } from "./auth/AuthProvider";
import { LogInPage } from "./auth/LogInPage";
import { SignUpPage } from "./auth/SignUpPage";
import { Header } from "./components/Header";
import { ProfessionalPage } from "./directory/ProfessionalPage";
import { ProfessionalsPage } from "./directory/ProfessionalsPage";
import { NotificationsPage } from "./notifications/NotificationsPage";
import { NOTIFICATIONS_ROUTE } from "./notifications/route";
import { Role } from "./roles";
import { MySessionsPage } from "./sessions/MySessionsPage";
import { RescheduleSessionPage } from "./sessions/RescheduleSessionPage";
import { SettingsPage } from "./settings/SettingsPage";

export function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Shell />
      </BrowserRouter>
    </AuthProvider>
  );
}

function Shell() {
  const { user, loading } = useAuth();

  return (
    <>
      <Header />
      <main className="narrow">
        {!loading && (
          <Routes>
            <Route
              path="/"
              element={user ? <MySessionsPage user={user} /> : <Navigate to="/login" replace />}
            />
            <Route
              path={NOTIFICATIONS_ROUTE}
              element={user ? <NotificationsPage user={user} /> : <Navigate to="/login" replace />}
            />
            <Route path="/login" element={user ? <Navigate to="/" replace /> : <LogInPage />} />
            <Route path="/signup" element={user ? <Navigate to="/" replace /> : <SignUpPage />} />
            <Route
              path="/settings"
              element={<RoleOnly role={Role.PROFESSIONAL} page={(user) => <SettingsPage user={user} />} />}
            />
            <Route
              path="/professionals"
              element={<RoleOnly role={Role.MEMBER} page={() => <ProfessionalsPage />} />}
            />
            <Route
              path="/sessions/:id/reschedule"
              element={<RoleOnly role={Role.MEMBER} page={(user) => <RescheduleSessionPage user={user} />} />}
            />
            <Route
              path="/professionals/:id"
              element={<RoleOnly role={Role.MEMBER} page={(user) => <ProfessionalPage user={user} />} />}
            />
          </Routes>
        )}
      </main>
    </>
  );
}

// Signed out goes to log in; the other role goes home. The page gets the signed-in user, never null.
function RoleOnly({ role, page }: { role: Role; page: (user: User) => ReactNode }) {
  const { user } = useAuth();

  if (!user) return <Navigate to="/login" replace />;
  return user.role === role ? page(user) : <Navigate to="/" replace />;
}
