import { expect, it } from "vitest";
import { formatSessionTime } from "../src/session-time.js";

it("reads on the person's own clock", () => {
  expect(formatSessionTime(new Date("2027-01-18T03:30:00Z"), "Asia/Singapore")).toBe("Mon 18 Jan at 11:30am");
});

it("tells apart the two 1:00am sessions on the night London's clocks go back", () => {
  expect(formatSessionTime(new Date("2027-10-31T00:00:00Z"), "Europe/London")).toBe(
    "Sun 31 Oct at 1:00am (GMT+1)",
  );
  expect(formatSessionTime(new Date("2027-10-31T01:00:00Z"), "Europe/London")).toBe(
    "Sun 31 Oct at 1:00am (GMT+0)",
  );
});

it("adds no offset to the hour after the repeated one", () => {
  expect(formatSessionTime(new Date("2027-10-31T02:00:00Z"), "Europe/London")).toBe("Sun 31 Oct at 2:00am");
});
