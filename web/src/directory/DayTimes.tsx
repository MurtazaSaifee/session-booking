import type { Slot } from "./api";
import { formatDay, formatTime } from "./format";

export function DayTimes({ day, slots, timezone }: { day: string; slots: Slot[]; timezone: string }) {
  return (
    <>
      <h3 className="day-heading">{formatDay(day)}</h3>
      <ul className="day-times">
        {slots.map((slot) => (
          <li key={slot.start}>
            {formatTime(slot.start, timezone)} – {formatTime(slot.end, timezone)}
          </li>
        ))}
      </ul>
    </>
  );
}
