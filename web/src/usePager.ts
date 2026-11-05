import { useState } from "react";
import type { Page } from "./api";
import { addPage, canGoNext, currentPage, goBack, type PagerState } from "./pager";

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
  const [state, setState] = useState<PagerState<T>>({ later: [], atEnd: false });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const page = currentPage(first, state);

  async function next() {
    if (page.next === null) return;
    setLoading(true);
    setError(null);
    try {
      const nextPage = await loadNext(page.next);
      setState((current) => addPage(current, nextPage));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  function previous() {
    setError(null);
    setState(goBack);
  }

  return {
    items: page.items,
    hasPrevious: state.later.length > 0,
    hasNext: canGoNext(first, state),
    loading,
    error,
    previous,
    next,
  };
}
