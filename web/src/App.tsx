import { BrowserRouter, Navigate, Route, Routes } from "react-router";
import { AuthProvider, useAuth } from "./auth/AuthProvider";
import { LogInPage } from "./auth/LogInPage";
import { SignUpPage } from "./auth/SignUpPage";
import { Header } from "./components/Header";
import { HomePage } from "./home/HomePage";
import { Role } from "./roles";
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
            <Route path="/" element={user ? <HomePage user={user} /> : <Navigate to="/login" replace />} />
            <Route path="/login" element={user ? <Navigate to="/" replace /> : <LogInPage />} />
            <Route path="/signup" element={user ? <Navigate to="/" replace /> : <SignUpPage />} />
            <Route
              path="/settings"
              element={
                !user ? (
                  <Navigate to="/login" replace />
                ) : user.role === Role.PROFESSIONAL ? (
                  <SettingsPage />
                ) : (
                  <Navigate to="/" replace />
                )
              }
            />
          </Routes>
        )}
      </main>
    </>
  );
}
