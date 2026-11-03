import type { Slot } from "./api";
import { formatDay, formatTime } from "./format";

export function DayTimes({ day, slots, timeZone }: { day: string; slots: Slot[]; timeZone: string }) {
  return (
    <>
      <h3 className="day-heading">{formatDay(day)}</h3>
      <ul className="day-times">
        {slots.map((slot) => (
          <li key={slot.start}>
            {formatTime(slot.start, timeZone)} – {formatTime(slot.end, timeZone)}
          </li>
        ))}
      </ul>
    </>
  );
}
