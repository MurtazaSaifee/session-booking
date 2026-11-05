import { useCallback, useState } from "react";
import { ErrorMessage } from "../components/ErrorMessage";
import { formatDay, formatTimeRange } from "../time/format";
import { useLoad } from "../useLoad";
import { getSlots, type Slot } from "./api";
import { calendarWeeks, groupByLocalDay, localDate } from "./calendar";
import { CalendarGrid } from "./CalendarGrid";
import { ConfirmBooking } from "./ConfirmBooking";
import { DayTimes } from "./DayTimes";

// Mirrors bookingWindowEnd on the server, only to size the grid; the server decides which slots exist.
const BOOKING_WINDOW_DAYS = 28;
const DAY_MS = 24 * 60 * 60_000;

type SlotCalendarProps = { professionalId: string; professionalName: string; timezone: string };

export function SlotCalendar({ professionalId, professionalName, timezone }: SlotCalendarProps) {
  const [now] = useState(() => new Date());
  const loadSlots = useCallback(() => getSlots(professionalId), [professionalId]);
  const { data: slots, error: loadError, reload } = useLoad(loadSlots);
  const [picked, setPicked] = useState<string | null>(null);
  const [chosen, setChosen] = useState<Slot | null>(null);
  const [booked, setBooked] = useState<string | null>(null);
  const [refusal, setRefusal] = useState<string | null>(null);

  const slotsByDay = groupByLocalDay(slots ?? [], timezone);
  const lastDay = localDate(new Date(now.getTime() + BOOKING_WINDOW_DAYS * DAY_MS), timezone);
  const weeks = calendarWeeks(localDate(now, timezone), lastDay);
  // The picked day may have just lost its last free time, so it falls back to the first free day.
  const selected = picked && slotsByDay.has(picked) ? picked : slotsByDay.keys().next().value;

  function pick(slot: Slot) {
    setBooked(null);
    setRefusal(null);
    setChosen(slot);
  }

  function backToCalendar() {
    setChosen(null);
    reload();
  }

  if (chosen) {
    return (
      <ConfirmBooking
        professionalId={professionalId}
        professionalName={professionalName}
        slot={chosen}
        timezone={timezone}
        onBack={() => setChosen(null)}
        onBooked={() => {
          setBooked(
            `Booked: ${formatDay(localDate(chosen.start, timezone))}, ${formatTimeRange(chosen, timezone)}`,
          );
          backToCalendar();
        }}
        onRefused={(message) => {
          setRefusal(message);
          backToCalendar();
        }}
      />
    );
  }

  return (
    <>
      {(booked || refusal) && (
        <div className="booking-notice">
          {booked && (
            <p role="status" className="status">
              {booked}
            </p>
          )}
          <ErrorMessage message={refusal} />
        </div>
      )}
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
            <DayTimes
              day={selected}
              slots={slotsByDay.get(selected) ?? []}
              timezone={timezone}
              onPick={pick}
            />
          ) : (
            <p className="hint">No free times in the next 4 weeks.</p>
          )}
        </>
      )}
    </>
  );
}
