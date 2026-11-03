import { describe, expect, it } from "vitest";
import { newRange, toEditable, toRanges } from "./week";

const ranges = [
  { weekday: 1, start: "09:00", end: "12:00" },
  { weekday: 1, start: "13:00", end: "17:00" },
  { weekday: 3, start: "10:00", end: "14:00" },
];

describe("toEditable and toRanges", () => {
  it("round-trips the ranges", () => {
    expect(toRanges(toEditable(ranges))).toEqual(ranges);
  });

  it("gives every range its own key, across calls too", () => {
    const keys = [...toEditable(ranges), ...toEditable(ranges)].map((range) => range.key);
    expect(new Set(keys).size).toBe(ranges.length * 2);
  });
});

describe("newRange", () => {
  it("offers 09:00 to 17:00 on an empty day", () => {
    expect(newRange(2, [])).toEqual({ weekday: 2, start: "09:00", end: "17:00" });
  });

  it("starts where the day's last range ends and runs for an hour", () => {
    expect(newRange(1, [{ weekday: 1, start: "09:00", end: "12:00" }])).toEqual({
      weekday: 1,
      start: "12:00",
      end: "13:00",
    });
  });

  it("stops at 23:59 instead of running past midnight", () => {
    expect(newRange(1, [{ weekday: 1, start: "17:00", end: "23:30" }])).toEqual({
      weekday: 1,
      start: "23:30",
      end: "23:59",
    });
  });

  it("uses the latest end even when the ranges are out of order", () => {
    const outOfOrder = [
      { weekday: 1, start: "13:00", end: "17:00" },
      { weekday: 1, start: "09:00", end: "12:00" },
    ];
    expect(newRange(1, outOfOrder)).toEqual({ weekday: 1, start: "17:00", end: "18:00" });
  });
});
