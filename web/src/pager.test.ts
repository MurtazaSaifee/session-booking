import { describe, expect, it } from "vitest";
import type { Page } from "./api";
import { addPage, canGoNext, currentPage, goBack, type PagerState } from "./pager";

const first: Page<string> = { items: ["a"], next: "to-b" };
const middle: Page<string> = { items: ["b"], next: "to-c" };
const last: Page<string> = { items: ["c"], next: null };
const empty: Page<string> = { items: [], next: null };
const start: PagerState<string> = { later: [], atEnd: false };

describe("pager", () => {
  it("starts on the first page", () => {
    expect(currentPage(first, start)).toBe(first);
    expect(canGoNext(first, start)).toBe(true);
  });

  it("moves forward a page at a time and stops at the last", () => {
    const state = addPage(addPage(start, middle), last);

    expect(currentPage(first, state)).toBe(last);
    expect(canGoNext(first, state)).toBe(false);
  });

  it("goes back through the pages already seen", () => {
    const state = goBack(addPage(addPage(start, middle), last));

    expect(currentPage(first, state)).toBe(middle);
    expect(currentPage(first, goBack(state))).toBe(first);
  });

  it("stays put when the next page comes back empty, and turns Next off", () => {
    const state = addPage(addPage(start, middle), empty);

    expect(currentPage(first, state)).toBe(middle);
    expect(canGoNext(first, state)).toBe(false);
  });

  it("offers Next again after going back from an empty next page", () => {
    const state = goBack(addPage(addPage(start, middle), empty));

    expect(currentPage(first, state)).toBe(first);
    expect(canGoNext(first, state)).toBe(true);
  });
});
