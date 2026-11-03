import { DateTime } from "luxon";
import { expect, it } from "vitest";
import { SESSION_MINUTES, buildSlots } from "../src/directory/slots.js";

const MONDAY = 1;
const TUESDAY = 2;
const SATURDAY = 6;
const SUNDAY = 7;

type RangeTuple = readonly [number, string, string];

// Slots for the whole local days from firstDay to lastDay (both "YYYY-MM-DD"), as ISO strings.
function slotStarts(ranges: readonly RangeTuple[], timezone: string, firstDay: string, lastDay = firstDay) {
  const asRanges = ranges.map(([weekday, start, end]) => ({ weekday, start, end }));
  const now = DateTime.fromISO(firstDay, { zone: timezone }).startOf("day").toJSDate();
  const windowEnd = DateTime.fromISO(lastDay, { zone: timezone }).endOf("day").toJSDate();
  const slots = buildSlots({ ranges: asRanges, timezone, now, windowEnd });
  for (const slot of slots) {
    expect(slot.end.getTime() - slot.start.getTime()).toBe(SESSION_MINUTES * 60_000);
  }
  return slots.map((slot) => slot.start.toISOString());
}

it("offers a slot every hour from 09:00 to 16:00 in a 09:00-17:00 range", () => {
  const starts = slotStarts([[MONDAY, "09:00", "17:00"]], "Asia/Singapore", "2027-01-11");
  expect(starts).toHaveLength(8);
  expect(starts[0]).toBe("2027-01-11T01:00:00.000Z");
  expect(starts[7]).toBe("2027-01-11T08:00:00.000Z");
});

it.each([
  { case: "a partial last hour", range: [MONDAY, "09:00", "11:30"], expected: ["01:00", "02:00"] },
  { case: "a range of exactly 50 minutes", range: [MONDAY, "09:00", "09:50"], expected: ["01:00"] },
  { case: "a range of 49 minutes", range: [MONDAY, "09:00", "09:49"], expected: [] },
] as const)("$case gives $expected.length slots", ({ range, expected }) => {
  const starts = slotStarts([range], "Asia/Singapore", "2027-01-11");
  expect(starts).toEqual(expected.map((time) => `2027-01-11T${time}:00.000Z`));
});

it.each([
  {
    case: "a lunch break",
    ranges: [
      [MONDAY, "09:00", "12:00"],
      [MONDAY, "13:00", "15:00"],
    ],
    expected: ["09:00", "10:00", "11:00", "13:00", "14:00"],
  },
  {
    case: "touching ranges",
    ranges: [
      [MONDAY, "09:00", "12:00"],
      [MONDAY, "12:00", "14:00"],
    ],
    expected: ["09:00", "10:00", "11:00", "12:00", "13:00"],
  },
  {
    case: "ranges given out of order",
    ranges: [
      [MONDAY, "13:00", "15:00"],
      [MONDAY, "09:00", "11:00"],
    ],
    expected: ["09:00", "10:00", "13:00", "14:00"],
  },
] as const)("$case gives slots in time order", ({ ranges, expected }) => {
  // UTC has no offset, so the expected local times read the same as the instants.
  const starts = slotStarts(ranges, "UTC", "2027-01-11");
  expect(starts).toEqual(expected.map((time) => `2027-01-11T${time}:00.000Z`));
});

it("uses only the ranges on the date's weekday", () => {
  expect(slotStarts([[TUESDAY, "09:00", "11:00"]], "UTC", "2027-01-11")).toEqual([]);
});

it("walks every day from now's date to the window end", () => {
  const starts = slotStarts([[MONDAY, "09:00", "10:00"]], "UTC", "2027-01-11", "2027-01-18");
  expect(starts).toEqual(["2027-01-11T09:00:00.000Z", "2027-01-18T09:00:00.000Z"]);
});

it("keeps 09:00 local on both sides of the Sydney clock change", () => {
  const starts = slotStarts(
    [
      [SATURDAY, "09:00", "10:00"],
      [MONDAY, "09:00", "10:00"],
    ],
    "Australia/Sydney",
    "2027-04-03",
    "2027-04-05",
  );
  expect(starts).toEqual(["2027-04-02T22:00:00.000Z", "2027-04-04T23:00:00.000Z"]);
  for (const start of starts) {
    expect(DateTime.fromISO(start).setZone("Australia/Sydney").toFormat("HH:mm")).toBe("09:00");
  }
});

it("keeps slots an hour apart, never overlapping, when London's clocks go forward", () => {
  const starts = slotStarts([[SUNDAY, "00:00", "05:00"]], "Europe/London", "2027-03-28");
  expect(starts).toEqual([
    "2027-03-28T00:00:00.000Z",
    "2027-03-28T01:00:00.000Z",
    "2027-03-28T02:00:00.000Z",
    "2027-03-28T03:00:00.000Z",
  ]);
});

it("keeps slots an hour apart, never overlapping, when London's clocks go back", () => {
  const starts = slotStarts([[SUNDAY, "00:00", "04:00"]], "Europe/London", "2027-10-31");
  expect(starts).toEqual([
    "2027-10-30T23:00:00.000Z",
    "2027-10-31T00:00:00.000Z",
    "2027-10-31T01:00:00.000Z",
    "2027-10-31T02:00:00.000Z",
    "2027-10-31T03:00:00.000Z",
  ]);
});

it("handles a half-hour offset in Asia/Kolkata", () => {
  const starts = slotStarts([[MONDAY, "09:00", "11:00"]], "Asia/Kolkata", "2027-01-11");
  expect(starts).toEqual(["2027-01-11T03:30:00.000Z", "2027-01-11T04:30:00.000Z"]);
});

it("gives the right instant for an evening slot that lands on the member's next day", () => {
  const starts = slotStarts([[MONDAY, "18:00", "20:00"]], "Europe/London", "2027-01-11");
  expect(starts).toEqual(["2027-01-11T18:00:00.000Z", "2027-01-11T19:00:00.000Z"]);
  const memberTime = DateTime.fromISO(starts[1]).setZone("Asia/Singapore");
  expect(memberTime.toISODate()).toBe("2027-01-12");
  expect(memberTime.toFormat("HH:mm")).toBe("03:00");
});
