import { expect, it } from "vitest";
import { findOverlappingDay } from "../src/settings/hours.js";

const MONDAY = 1;
const WEDNESDAY = 3;

it.each([
  { case: "no ranges", ranges: [], expected: null },
  { case: "one range", ranges: [[MONDAY, "09:00", "17:00"]], expected: null },
  {
    case: "a lunch break",
    ranges: [
      [MONDAY, "09:00", "12:00"],
      [MONDAY, "13:00", "17:00"],
    ],
    expected: null,
  },
  {
    case: "touching ranges",
    ranges: [
      [MONDAY, "09:00", "12:00"],
      [MONDAY, "12:00", "17:00"],
    ],
    expected: null,
  },
  {
    case: "the same times on different days",
    ranges: [
      [MONDAY, "09:00", "17:00"],
      [WEDNESDAY, "09:00", "17:00"],
    ],
    expected: null,
  },
  {
    case: "overlapping ranges",
    ranges: [
      [MONDAY, "09:00", "12:00"],
      [MONDAY, "11:00", "14:00"],
    ],
    expected: MONDAY,
  },
  {
    case: "one range inside another",
    ranges: [
      [MONDAY, "09:00", "17:00"],
      [MONDAY, "10:00", "11:00"],
    ],
    expected: MONDAY,
  },
  {
    case: "identical ranges",
    ranges: [
      [MONDAY, "09:00", "12:00"],
      [MONDAY, "09:00", "12:00"],
    ],
    expected: MONDAY,
  },
  {
    case: "an overlap given out of order",
    ranges: [
      [MONDAY, "13:00", "17:00"],
      [WEDNESDAY, "10:00", "12:00"],
      [MONDAY, "09:00", "13:30"],
    ],
    expected: MONDAY,
  },
  {
    case: "an overlap on Wednesday only",
    ranges: [
      [MONDAY, "09:00", "12:00"],
      [MONDAY, "12:00", "17:00"],
      [WEDNESDAY, "09:00", "12:00"],
      [WEDNESDAY, "11:59", "13:00"],
    ],
    expected: WEDNESDAY,
  },
] as const)("$case gives $expected", ({ ranges, expected }) => {
  const asRanges = ranges.map(([weekday, start, end]) => ({ weekday, start, end }));
  expect(findOverlappingDay(asRanges)).toBe(expected);
});
