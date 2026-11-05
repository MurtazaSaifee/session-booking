import { expect, it } from "vitest";
import { ErrorCode } from "../src/errors.js";
import { checkStart, type BookingRefusal } from "../src/sessions/booking.js";
import type { Interval } from "../src/slots/slots.js";

const MONDAY = 1;

// A Kolkata professional working Monday 09:00-11:00, so slots start at 03:30Z and 04:30Z.
// "now" is Monday 09:30 in Kolkata; the booking window ends 2027-02-08T04:00:00Z.
const ranges = [{ weekday: MONDAY, start: "09:00", end: "11:00" }];
const timezone = "Asia/Kolkata";
const now = new Date("2027-01-11T04:00:00Z");

function interval(start: string, end: string): Interval {
  return { start: new Date(start), end: new Date(end) };
}

it.each<{
  case: string;
  start: string;
  memberBusy?: Interval[];
  professionalBusy?: Interval[];
  expected: BookingRefusal | null;
}>([
  { case: "a free slot", start: "2027-01-18T03:30:00Z", expected: null },
  { case: "the last slot before the window ends", start: "2027-02-08T03:30:00Z", expected: null },
  { case: "a start in the past", start: "2027-01-11T03:30:00Z", expected: ErrorCode.SLOT_NOT_AVAILABLE },
  {
    case: "a start off the hourly grid",
    start: "2027-01-18T03:47:00Z",
    expected: ErrorCode.SLOT_NOT_AVAILABLE,
  },
  {
    case: "a start outside working hours",
    start: "2027-01-18T10:00:00Z",
    expected: ErrorCode.SLOT_NOT_AVAILABLE,
  },
  { case: "a weekday with no hours", start: "2027-01-19T03:30:00Z", expected: ErrorCode.SLOT_NOT_AVAILABLE },
  {
    case: "a start after the window ends",
    start: "2027-02-08T04:30:00Z",
    expected: ErrorCode.SLOT_NOT_AVAILABLE,
  },
  {
    case: "a member session partly overlapping the slot",
    start: "2027-01-18T03:30:00Z",
    memberBusy: [interval("2027-01-18T04:00:00Z", "2027-01-18T04:50:00Z")],
    expected: ErrorCode.MEMBER_OVERLAP,
  },
  {
    case: "a professional session at the same start",
    start: "2027-01-18T03:30:00Z",
    professionalBusy: [interval("2027-01-18T03:30:00Z", "2027-01-18T04:20:00Z")],
    expected: ErrorCode.SLOT_TAKEN,
  },
  {
    case: "a clash in both lists",
    start: "2027-01-18T03:30:00Z",
    memberBusy: [interval("2027-01-18T03:30:00Z", "2027-01-18T04:20:00Z")],
    professionalBusy: [interval("2027-01-18T03:30:00Z", "2027-01-18T04:20:00Z")],
    expected: ErrorCode.MEMBER_OVERLAP,
  },
  {
    case: "a member session that ends as the slot starts",
    start: "2027-01-18T03:30:00Z",
    memberBusy: [interval("2027-01-18T02:40:00Z", "2027-01-18T03:30:00Z")],
    expected: null,
  },
  {
    case: "an invalid start with a clashing member session",
    start: "2027-01-18T03:47:00Z",
    memberBusy: [interval("2027-01-18T03:30:00Z", "2027-01-18T04:20:00Z")],
    expected: ErrorCode.SLOT_NOT_AVAILABLE,
  },
])("$case gives $expected", ({ start, memberBusy = [], professionalBusy = [], expected }) => {
  const result = checkStart({ start: new Date(start), ranges, timezone, now, memberBusy, professionalBusy });
  expect(result).toBe(expected);
});
