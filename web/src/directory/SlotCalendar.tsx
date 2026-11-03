import { useCallback, useState } from "react";
import { ErrorMessage } from "../components/ErrorMessage";
import { useLoad } from "../useLoad";
import { getSlots } from "./api";
import { calendarWeeks, groupByLocalDay, localDate } from "./calendar";
import { CalendarGrid } from "./CalendarGrid";
import { DayTimes } from "./DayTimes";

// Mirrors bookingWindowEnd on the server, only to size the grid; the server decides which slots exist.
const BOOKING_WINDOW_DAYS = 28;
const DAY_MS = 24 * 60 * 60_000;

export function SlotCalendar({ professionalId, timezone }: { professionalId: string; timezone: string }) {
  const [now] = useState(() => new Date());
  const loadSlots = useCallback(() => getSlots(professionalId), [professionalId]);
  const { data: slots, error: loadError } = useLoad(loadSlots);
  const [picked, setPicked] = useState<string | null>(null);

  const slotsByDay = groupByLocalDay(slots ?? [], timezone);
  const lastDay = localDate(new Date(now.getTime() + BOOKING_WINDOW_DAYS * DAY_MS), timezone);
  const weeks = calendarWeeks(localDate(now, timezone), lastDay);
  const selected = picked ?? slotsByDay.keys().next().value;

  return (
    <>
      <h2>Free times</h2>
      <p className="hint">Times shown in {timezone}.</p>
      {loadError ? (
        <ErrorMessage message={loadError} />
      ) : !slots ? (
        <p>Loading free times…</p>
      ) : (
        <>
          <CalendarGrid
            weeks={weeks}
            freeDays={new Set(slotsByDay.keys())}
            selected={selected}
            onSelect={setPicked}
          />
          {selected ? (
            <DayTimes day={selected} slots={slotsByDay.get(selected) ?? []} timezone={timezone} />
          ) : (
            <p className="hint">No free times in the next 4 weeks.</p>
          )}
        </>
      )}
    </>
  );
}
