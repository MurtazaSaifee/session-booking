import { useEffect, useState } from "react";
import { ErrorMessage } from "../components/ErrorMessage";
import { getSlots, type Slot } from "./api";
import { calendarWeeks, groupByLocalDay, localDate } from "./calendar";
import { CalendarGrid } from "./CalendarGrid";
import { DayTimes } from "./DayTimes";

// Mirrors bookingWindowEnd on the server, only to size the grid; the server decides which slots exist.
const BOOKING_WINDOW_DAYS = 28;
const DAY_MS = 24 * 60 * 60_000;

export function SlotCalendar({ professionalId, timeZone }: { professionalId: string; timeZone: string }) {
  const [now] = useState(() => new Date());
  const [slots, setSlots] = useState<Slot[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [picked, setPicked] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    getSlots(professionalId)
      .then((loaded) => {
        if (active) setSlots(loaded);
      })
      .catch((err) => {
        if (active) setLoadError(err instanceof Error ? err.message : "Something went wrong.");
      });
    return () => {
      active = false;
    };
  }, [professionalId]);

  const slotsByDay = groupByLocalDay(slots ?? [], timeZone);
  const lastDay = localDate(new Date(now.getTime() + BOOKING_WINDOW_DAYS * DAY_MS), timeZone);
  const weeks = calendarWeeks(localDate(now, timeZone), lastDay);
  const selected = picked ?? slotsByDay.keys().next().value;

  return (
    <>
      <h2>Free times</h2>
      <p className="hint">Times shown in {timeZone}.</p>
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
            <DayTimes day={selected} slots={slotsByDay.get(selected) ?? []} timeZone={timeZone} />
          ) : (
            <p className="hint">No free times in the next 4 weeks.</p>
          )}
        </>
      )}
    </>
  );
}
