import { expect, it } from "vitest";
import { decideOutcomes } from "../../src/reminders/reminder-outcomes.js";

const START = new Date("2027-01-18T03:30:00.000Z");

const reminder = {
  id: "reminder-1",
  recipientId: "member-1",
  start: START,
  timezone: "Asia/Singapore",
  otherPersonName: "Nora Quill",
};

it("delivers a reminder a moment before its session starts", () => {
  expect(decideOutcomes([reminder], new Date(START.getTime() - 1))).toEqual({
    deliveries: [
      {
        reminderId: "reminder-1",
        recipientId: "member-1",
        text: "Your session with Nora Quill is on Mon 18 Jan at 11:30am",
      },
    ],
    skippedIds: [],
  });
});

it.each([
  { case: "as its session starts", now: START },
  { case: "after its session starts", now: new Date(START.getTime() + 1) },
])("skips a reminder $case", ({ now }) => {
  expect(decideOutcomes([reminder], now)).toEqual({ deliveries: [], skippedIds: ["reminder-1"] });
});
