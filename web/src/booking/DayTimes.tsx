import type { Slot } from "./api";
import { formatDay, formatTimeRange } from "../time/format";

type DayTimesProps = {
  day: string;
  slots: Slot[];
  timezone: string;
  onPick: (slot: Slot) => void;
};

export function DayTimes({ day, slots, timezone, onPick }: DayTimesProps) {
  return (
    <>
      <h3 className="day-heading">{formatDay(day)}</h3>
      <ul className="day-times">
        {slots.map((slot) => (
          <li key={slot.start}>
            <button type="button" className="day-time" onClick={() => onPick(slot)}>
              {formatTimeRange(slot, timezone)}
            </button>
          </li>
        ))}
      </ul>
    </>
  );
}
