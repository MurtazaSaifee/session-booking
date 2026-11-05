import { expect, it } from "vitest";
import { reminderText } from "../../src/reminders/reminder-text.js";

it.each([
  {
    case: "the example",
    start: "2026-11-05T09:30:00Z",
    timezone: "Asia/Kolkata",
    says: "Thu 5 Nov at 3:00pm",
  },
  {
    case: "a whole-hour offset",
    start: "2027-01-18T03:30:00Z",
    timezone: "Asia/Singapore",
    says: "Mon 18 Jan at 11:30am",
  },
  {
    case: "a half-hour offset",
    start: "2027-01-18T03:30:00Z",
    timezone: "Asia/Kolkata",
    says: "Mon 18 Jan at 9:00am",
  },
  {
    case: "the reader's next day",
    start: "2027-01-18T20:00:00Z",
    timezone: "Asia/Singapore",
    says: "Tue 19 Jan at 4:00am",
  },
  {
    case: "the reader's previous day",
    start: "2027-01-18T03:30:00Z",
    timezone: "America/New_York",
    says: "Sun 17 Jan at 10:30pm",
  },
  { case: "noon", start: "2027-01-18T12:00:00Z", timezone: "Europe/London", says: "Mon 18 Jan at 12:00pm" },
  {
    case: "midnight",
    start: "2027-01-18T00:00:00Z",
    timezone: "Europe/London",
    says: "Mon 18 Jan at 12:00am",
  },
  {
    case: "Sydney before its clock change",
    start: "2027-04-02T22:00:00Z",
    timezone: "Australia/Sydney",
    says: "Sat 3 Apr at 9:00am",
  },
  {
    case: "Sydney after its clock change",
    start: "2027-04-04T23:00:00Z",
    timezone: "Australia/Sydney",
    says: "Mon 5 Apr at 9:00am",
  },
])("states $case on the reader's clock", ({ start, timezone, says }) => {
  const text = reminderText({ otherPersonName: "Nora Quill", start: new Date(start), timezone });

  expect(text).toBe(`Your session with Nora Quill is on ${says}`);
});

it("one session reads differently on each person's clock", () => {
  const start = new Date("2027-01-18T03:30:00Z");

  expect(reminderText({ otherPersonName: "Theo Marsh", start, timezone: "Asia/Kolkata" })).toBe(
    "Your session with Theo Marsh is on Mon 18 Jan at 9:00am",
  );
  expect(reminderText({ otherPersonName: "Nora Quill", start, timezone: "Asia/Singapore" })).toBe(
    "Your session with Nora Quill is on Mon 18 Jan at 11:30am",
  );
});
