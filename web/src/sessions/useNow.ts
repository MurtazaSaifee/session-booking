import { useEffect, useState } from "react";

const RECHECK_MS = 30_000;

// The time now, refreshed so a page left open notices when a session passes the 24-hour mark.
export function useNow(): Date {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), RECHECK_MS);
    return () => clearInterval(timer);
  }, []);

  return now;
}
