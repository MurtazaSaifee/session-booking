import { useEffect, useState } from "react";

type Loaded<T> = { load: () => Promise<T>; data: T | null; error: string | null };

// `load` must be stable (a module-level function or a useCallback): a new function runs the request again.
export function useLoad<T>(load: () => Promise<T>): { data: T | null; error: string | null } {
  // Kept with the `load` it came from, so a new `load` shows loading instead of the old result.
  const [loaded, setLoaded] = useState<Loaded<T> | null>(null);

  useEffect(() => {
    let active = true;
    load()
      .then((data) => {
        if (active) setLoaded({ load, data, error: null });
      })
      .catch((err) => {
        if (active) {
          setLoaded({
            load,
            data: null,
            error: err instanceof Error ? err.message : "Something went wrong.",
          });
        }
      });
    return () => {
      active = false;
    };
  }, [load]);

  if (loaded?.load !== load) return { data: null, error: null };
  return { data: loaded.data, error: loaded.error };
}
