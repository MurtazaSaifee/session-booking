import { describe, expect, it } from "vitest";
import { formatNoticeDuration } from "./noticeDuration";

describe("formatNoticeDuration", () => {
  it("formats 0 minutes as no minimum notice", () => {
    expect(formatNoticeDuration(0)).toBe("No minimum notice (immediate booking allowed)");
  });

  it("formats negative minutes as no minimum notice", () => {
    expect(formatNoticeDuration(-5)).toBe("No minimum notice (immediate booking allowed)");
  });

  it("formats 60 minutes as 1 hour", () => {
    expect(formatNoticeDuration(60)).toBe("1 hour");
  });

  it("formats 120 minutes as 2 hours", () => {
    expect(formatNoticeDuration(120)).toBe("2 hours");
  });

  it("formats 90 minutes as 1 hour 30 minutes", () => {
    expect(formatNoticeDuration(90)).toBe("1 hour 30 minutes");
  });

  it("formats 1440 minutes as 1 day", () => {
    expect(formatNoticeDuration(1440)).toBe("1 day");
  });

  it("formats 2880 minutes as 2 days", () => {
    expect(formatNoticeDuration(2880)).toBe("2 days");
  });

  it("formats 1500 minutes as 1 day 1 hour", () => {
    expect(formatNoticeDuration(1500)).toBe("1 day 1 hour");
  });
});

