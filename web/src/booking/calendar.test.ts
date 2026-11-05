import { describe, expect, it } from "vitest";
import { calendarWeeks, groupByLocalDay } from "./calendar";

describe("groupByLocalDay", () => {
  it("groups slots by the day they start on for the viewer, keeping their order", () => {
    const late = { start: "2027-01-11T15:00:00Z" };
    const midnight = { start: "2027-01-11T16:00:00Z" };
    const morning = { start: "2027-01-12T01:00:00Z" };
    const days = groupByLocalDay([late, midnight, morning], "Asia/Singapore");
    expect(Object.fromEntries(days)).toEqual({
      "2027-01-11": [late],
      "2027-01-12": [midnight, morning],
    });
  });

  it("gives an empty map when there are no slots", () => {
    expect(groupByLocalDay([], "Asia/Singapore").size).toBe(0);
  });
});

describe("calendarWeeks", () => {
  it("runs from the Monday on or before the first day to the Sunday on or after the last", () => {
    const weeks = calendarWeeks("2027-01-06", "2027-02-03");
    expect(weeks).toHaveLength(5);
    expect(weeks.every((week) => week.length === 7)).toBe(true);
    expect(weeks[0][0]).toBe("2027-01-04");
    expect(weeks[4][6]).toBe("2027-02-07");
  });

  it("adds no extra days when the range is already whole weeks", () => {
    const weeks = calendarWeeks("2027-01-04", "2027-01-31");
    expect(weeks).toHaveLength(4);
    expect(weeks[0][0]).toBe("2027-01-04");
    expect(weeks[3][6]).toBe("2027-01-31");
  });

  it("rolls over the month and year", () => {
    expect(calendarWeeks("2026-12-30", "2027-01-05")).toEqual([
      ["2026-12-28", "2026-12-29", "2026-12-30", "2026-12-31", "2027-01-01", "2027-01-02", "2027-01-03"],
      ["2027-01-04", "2027-01-05", "2027-01-06", "2027-01-07", "2027-01-08", "2027-01-09", "2027-01-10"],
    ]);
  });

  it("is not thrown by a clock change", () => {
    expect(calendarWeeks("2027-03-22", "2027-04-04")).toEqual([
      ["2027-03-22", "2027-03-23", "2027-03-24", "2027-03-25", "2027-03-26", "2027-03-27", "2027-03-28"],
      ["2027-03-29", "2027-03-30", "2027-03-31", "2027-04-01", "2027-04-02", "2027-04-03", "2027-04-04"],
    ]);
  });
});
