import { useEffect, useState } from "react";

type Health = { status: "ok"; time: string } | { error: string; message: string };

export function App() {
  const [health, setHealth] = useState<Health | null>(null);

  useEffect(() => {
    fetch("/api/health")
      .then((res) => res.json())
      .then(setHealth)
      .catch(() => setHealth({ error: "NETWORK", message: "Can't reach the API." }));
  }, []);

  return (
    <main>
      <h1>Session Booking</h1>
      {health === null && <p>Checking the API…</p>}
      {health && "status" in health && <p>API and database are up ({health.time}).</p>}
      {health && "error" in health && <p>{health.message}</p>}
    </main>
  );
}
