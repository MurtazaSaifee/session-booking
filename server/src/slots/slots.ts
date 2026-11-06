import { DateTime } from "luxon";
import type { TimeRange } from "../settings/hours.js";

// Members can book up to this many days ahead.
const BOOKING_WINDOW_DAYS = 28;
export const BOOKING_WINDOW_MINUTES = BOOKING_WINDOW_DAYS * 24 * 60;
export const SESSION_MINUTES = 50;
export const DEFAULT_MINIMUM_NOTICE_MINUTES = 120;

const MINUTE_MS = 60_000;
const SESSION_MS = SESSION_MINUTES * MINUTE_MS;
// A 50-minute session plus a 10-minute gap.
const SLOT_STEP_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * 60 * MINUTE_MS;

// A span of real time: a slot, or a booked session that makes a professional or member busy.
export type Interval = { start: Date; end: Date };
export type Slot = Interval;

// What a professional's slots are worked out from.
export type SlotInputs = {
  timezone: string;
  ranges: TimeRange[];
  minimumNoticeMinutes: number;
  memberBusy: Interval[];
  professionalBusy: Interval[];
  ignoredSessionStart?: Date | null;
};

export function sessionEnd(start: Date): Date {
  return new Date(start.getTime() + SESSION_MS);
}

// Two intervals overlap when each starts before the other ends, so ones that only touch do not.
export function overlaps(a: Interval, b: Interval): boolean {
  return a.start.getTime() < b.end.getTime() && b.start.getTime() < a.end.getTime();
}

// The latest a slot may start: BOOKING_WINDOW_DAYS from now in real elapsed time.
export function bookingWindowEnd(now: Date): Date {
  return new Date(now.getTime() + BOOKING_WINDOW_DAYS * DAY_MS);
}

// Turns an "HH:MM" clock time on a local day into an instant.
function atClock(day: DateTime, time: string): number {
  const [hour, minute] = time.split(":").map(Number);
  return day.set({ hour, minute }).toMillis();
}

// Every slot on each local day from now's date to windowEnd's date, in the professional's timezone.
// Slots start at the beginning of each range and repeat hourly.
// Drops slots that start before now + the minimum notice or after windowEnd, and slots that overlap a busy
// interval.
// An interval that only touches a slot (ends as it starts, or starts as it ends) does not hide it.
export function buildSlots(input: {
  ranges: TimeRange[];
  timezone: string;
  now: Date;
  minimumNoticeMinutes: number;
  windowEnd: Date;
  busy: Interval[];
}): Slot[] {
  const { ranges, timezone, now, minimumNoticeMinutes, windowEnd, busy } = input;
  const earliestStart = now.getTime() + minimumNoticeMinutes * MINUTE_MS;
  const lastDay = DateTime.fromJSDate(windowEnd, { zone: timezone }).startOf("day");
  const slots: Slot[] = [];

  // plus({ days }) is calendar arithmetic, so each day still starts at local midnight across clock changes.
  for (
    let day = DateTime.fromJSDate(now, { zone: timezone }).startOf("day");
    day <= lastDay;
    day = day.plus({ days: 1 })
  ) {
    for (const range of ranges) {
      if (range.weekday !== day.weekday) continue;
      const end = atClock(day, range.end);
      // Step in real elapsed milliseconds: on a clock-change night a local range is longer or shorter
      // than its clock times suggest, and slots must stay a whole hour apart.
      for (let start = atClock(day, range.start); start + SESSION_MS <= end; start += SLOT_STEP_MS) {
        if (start < earliestStart || start > windowEnd.getTime()) continue;
        const slot = { start: new Date(start), end: new Date(start + SESSION_MS) };
        if (busy.some((interval) => overlaps(slot, interval))) continue;
        slots.push(slot);
      }
    }
  }

  return slots.sort((a, b) => a.start.getTime() - b.start.getTime());
}
