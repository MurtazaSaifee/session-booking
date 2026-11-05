import type { Page } from "./api";

// The pages after the first, as far as someone has gone. `atEnd` means the last Next found nothing.
export type PagerState<T> = { later: Page<T>[]; atEnd: boolean };

export function currentPage<T>(first: Page<T>, state: PagerState<T>): Page<T> {
  return state.later.at(-1) ?? first;
}

export function canGoNext<T>(first: Page<T>, state: PagerState<T>): boolean {
  return !state.atEnd && currentPage(first, state).next !== null;
}

// Rows can leave a list after its page was loaded, so a promised next page can arrive empty. Staying on
// the current page beats showing a blank one.
export function addPage<T>(state: PagerState<T>, page: Page<T>): PagerState<T> {
  if (page.items.length === 0) return { ...state, atEnd: true };
  return { later: [...state.later, page], atEnd: false };
}

export function goBack<T>(state: PagerState<T>): PagerState<T> {
  return { later: state.later.slice(0, -1), atEnd: false };
}
