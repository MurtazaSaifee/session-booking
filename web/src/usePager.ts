import { useState } from "react";

export type Page<T> = { items: T[]; next: string | null };

export type Pager<T> = {
  items: T[];
  hasPrevious: boolean;
  hasNext: boolean;
  loading: boolean;
  error: string | null;
  previous: () => void;
  next: () => void;
};

// `first` is the page already loaded. Pages seen so far are kept, so Previous needs nothing from the server.
export function usePager<T>(first: Page<T>, loadNext: (cursor: string) => Promise<Page<T>>): Pager<T> {
  const [later, setLater] = useState<Page<T>[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const page = later.at(-1) ?? first;

  async function next() {
    if (page.next === null) return;
    setLoading(true);
    setError(null);
    try {
      const nextPage = await loadNext(page.next);
      setLater((pages) => [...pages, nextPage]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  function previous() {
    setError(null);
    setLater((pages) => pages.slice(0, -1));
  }

  return {
    items: page.items,
    hasPrevious: later.length > 0,
    hasNext: page.next !== null,
    loading,
    error,
    previous,
    next,
  };
}
