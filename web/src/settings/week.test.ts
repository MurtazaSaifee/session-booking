import { describe, expect, it } from "vitest";
import {
  applyBulkHours,
  clearDays,
  copyDayHoursTo,
  findDayOverlaps,
  MON_TO_FRI,
  newRange,
  toEditable,
  toRanges,
} from "./week";

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

  it("safely resets to morning hours when day already ends at 23:59", () => {
    expect(newRange(1, [{ weekday: 1, start: "17:00", end: "23:59" }])).toEqual({
      weekday: 1,
      start: "08:00",
      end: "09:00",
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

describe("findDayOverlaps", () => {
  it("returns no errors for disjoint ranges", () => {
    const valid = toEditable([
      { weekday: 1, start: "09:00", end: "12:00" },
      { weekday: 1, start: "13:00", end: "17:00" },
      { weekday: 2, start: "10:00", end: "18:00" },
    ]);
    expect(findDayOverlaps(valid).size).toBe(0);
  });

  it("detects when end time is before or equal to start time", () => {
    const invalid = toEditable([{ weekday: 1, start: "15:00", end: "11:00" }]);
    const errors = findDayOverlaps(invalid);
    expect(errors.get(1)).toBe("End time must be after start time.");
  });

  it("detects overlapping ranges on the same day", () => {
    const overlapping = toEditable([
      { weekday: 1, start: "09:00", end: "13:00" },
      { weekday: 1, start: "12:00", end: "15:00" },
    ]);
    const errors = findDayOverlaps(overlapping);
    expect(errors.get(1)).toBe("Time ranges overlap on this day. Please adjust the hours.");
  });

  it("allows ranges that touch exactly (e.g. 12:00 end and 12:00 start)", () => {
    const touching = toEditable([
      { weekday: 1, start: "09:00", end: "12:00" },
      { weekday: 1, start: "12:00", end: "15:00" },
    ]);
    expect(findDayOverlaps(touching).size).toBe(0);
  });

  it("does not falsely trigger overlap warnings when typing an incomplete range", () => {
    const incomplete = toEditable([
      { weekday: 1, start: "09:00", end: "12:00" },
      { weekday: 1, start: "", end: "" },
    ]);
    expect(findDayOverlaps(incomplete).size).toBe(0);
  });
});

describe("bulk hours helpers", () => {
  it("applies hours to all weekdays", () => {
    const result = applyBulkHours([], MON_TO_FRI, [{ start: "09:00", end: "17:00" }]);
    expect(result.length).toBe(5);
    expect(result.map((r) => r.weekday)).toEqual([1, 2, 3, 4, 5]);
    expect(result.every((r) => r.start === "09:00" && r.end === "17:00")).toBe(true);
  });

  it("copies one day's hours to weekdays", () => {
    const initial = toEditable([
      { weekday: 1, start: "10:00", end: "14:00" },
      { weekday: 1, start: "15:00", end: "19:00" },
    ]);
    const copied = copyDayHoursTo(initial, 1, MON_TO_FRI);
    // 2 ranges per day * 5 weekdays = 10 ranges
    expect(copied.length).toBe(10);
    const tuesday = copied.filter((r) => r.weekday === 2);
    expect(tuesday.map((r) => `${r.start}-${r.end}`)).toEqual(["10:00-14:00", "15:00-19:00"]);
  });

  it("clears specified days", () => {
    const initial = toEditable([
      { weekday: 1, start: "09:00", end: "17:00" },
      { weekday: 6, start: "10:00", end: "14:00" },
    ]);
    const cleared = clearDays(initial, [1]);
    expect(cleared.length).toBe(1);
    expect(cleared[0].weekday).toBe(6);
  });
});
