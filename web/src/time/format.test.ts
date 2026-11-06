import { describe, expect, it } from "vitest";
import { formatDay, formatFullDay, formatMonth, formatTime, formatTimeRange, localDate } from "./format";

describe("localDate", () => {
  it("gives the date on the viewer's clock, which can differ from UTC", () => {
    expect(localDate("2027-01-11T19:00:00Z", "Europe/London")).toBe("2027-01-11");
    expect(localDate("2027-01-11T19:00:00Z", "Asia/Singapore")).toBe("2027-01-12");
  });

  it("handles a half-hour offset at midnight", () => {
    expect(localDate("2027-01-11T18:29:59Z", "Asia/Kolkata")).toBe("2027-01-11");
    expect(localDate("2027-01-11T18:30:00Z", "Asia/Kolkata")).toBe("2027-01-12");
  });

  it("accepts a Date as well as an ISO string", () => {
    expect(localDate(new Date("2027-01-11T19:00:00Z"), "Asia/Singapore")).toBe("2027-01-12");
  });
});

describe("formatTime", () => {
  it("reads a slot on the viewer's clock", () => {
    expect(formatTime("2027-01-11T03:30:00Z", "Asia/Kolkata")).toBe("9:00 am");
  });

  it("can land on the next day for the viewer", () => {
    expect(formatTime("2027-01-11T19:00:00Z", "Asia/Singapore")).toBe("3:00 am");
  });

  it("shows the afternoon as pm", () => {
    expect(formatTime("2027-01-11T14:30:00Z", "Europe/London")).toBe("2:30 pm");
  });
});

describe("formatDay", () => {
  it("names the weekday, day and month", () => {
    expect(formatDay("2027-01-11")).toBe("Monday 11 January");
  });

  it("does not shift with the day's start or end of the year", () => {
    expect(formatDay("2026-12-31")).toBe("Thursday 31 December");
  });
});

describe("formatMonth", () => {
  it("gives a short month name", () => {
    expect(formatMonth("2027-02-01")).toBe("Feb");
  });
});

describe("formatTimeRange", () => {
  it("gives the start and end on the viewer's clock", () => {
    const slot = { start: "2027-01-11T03:30:00Z", end: "2027-01-11T04:20:00Z" };
    expect(formatTimeRange(slot, "Asia/Singapore")).toBe("11:30 am – 12:20 pm");
  });

  it("tells apart the two 1:00 am slots on the night London's clocks go back", () => {
    const first = { start: "2027-10-31T00:00:00Z", end: "2027-10-31T00:50:00Z" };
    const second = { start: "2027-10-31T01:00:00Z", end: "2027-10-31T01:50:00Z" };
    expect(formatTimeRange(first, "Europe/London")).toBe("1:00 am – 1:50 am (GMT+1)");
    expect(formatTimeRange(second, "Europe/London")).toBe("1:00 am – 1:50 am (GMT+0)");
  });

  it("adds no offset to the hours around the repeated one", () => {
    const before = { start: "2027-10-30T23:00:00Z", end: "2027-10-30T23:50:00Z" };
    const after = { start: "2027-10-31T02:00:00Z", end: "2027-10-31T02:50:00Z" };
    expect(formatTimeRange(before, "Europe/London")).toBe("12:00 am – 12:50 am");
    expect(formatTimeRange(after, "Europe/London")).toBe("2:00 am – 2:50 am");
  });

  it("handles a half-hour clock change", () => {
    const slot = { start: "2027-04-03T15:15:00Z", end: "2027-04-03T16:05:00Z" };
    expect(formatTimeRange(slot, "Australia/Lord_Howe")).toBe("1:45 am – 2:35 am (GMT+10:30)");
  });
});

describe("formatFullDay", () => {
  it("includes the year", () => {
    expect(formatFullDay("2027-01-18")).toBe("Monday, 18 January 2027");
  });
});
