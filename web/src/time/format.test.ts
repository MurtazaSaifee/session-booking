import { describe, expect, it } from "vitest";
import { formatDay, formatMonth, formatTime, formatTimeRange } from "./format";

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
});
