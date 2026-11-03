import { useAuth } from "../auth/AuthProvider";

export function HomePage() {
  const { user } = useAuth();
  if (!user) return null;

  const firstName = user.name.split(" ")[0];
  return (
    <section className="card">
      <h1>Welcome, {firstName}.</h1>
      <p>Your sessions will appear here.</p>
    </section>
  );
}
