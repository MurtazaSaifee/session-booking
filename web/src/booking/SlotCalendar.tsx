import { useCallback, useState } from "react";
import { ErrorMessage } from "../components/ErrorMessage";
import { formatDay, formatTimeRange, localDate } from "../time/format";
import { useLoad } from "../useLoad";
import { getSlots, type Slot } from "./api";
import { BookingNotice } from "./BookingNotice";
import { calendarWeeks, groupByLocalDay } from "./calendar";
import { CalendarGrid } from "./CalendarGrid";
import { ConfirmBooking } from "./ConfirmBooking";
import { DayTimes } from "./DayTimes";

// Mirrors bookingWindowEnd on the server, only to size the grid; the server decides which slots exist.
const BOOKING_WINDOW_DAYS = 28;
const DAY_MS = 24 * 60 * 60_000;

type SlotCalendarProps = {
  professionalId: string;
  professionalName: string;
  timezone: string;
  // Set to move an existing session; onMoved runs once the server has moved it.
  reschedule?: { sessionId: string; onMoved: () => void };
};

export function SlotCalendar({ professionalId, professionalName, timezone, reschedule }: SlotCalendarProps) {
  const [now] = useState(() => new Date());
  const loadSlots = useCallback(() => getSlots(professionalId), [professionalId]);
  const { data: slots, error: loadError, reload } = useLoad(loadSlots);
  const [pickedDay, setPickedDay] = useState<string | null>(null);
  const [chosenSlot, setChosenSlot] = useState<Slot | null>(null);
  const [booked, setBooked] = useState<string | null>(null);
  const [refusal, setRefusal] = useState<string | null>(null);

  const slotsByDay = groupByLocalDay(slots ?? [], timezone);
  const lastDay = localDate(new Date(now.getTime() + BOOKING_WINDOW_DAYS * DAY_MS), timezone);
  const weeks = calendarWeeks(localDate(now, timezone), lastDay);
  // The picked day may have just lost its last free time, so it falls back to the first free day.
  const selectedDay = pickedDay && slotsByDay.has(pickedDay) ? pickedDay : slotsByDay.keys().next().value;

  function chooseSlot(slot: Slot) {
    setBooked(null);
    setRefusal(null);
    setChosenSlot(slot);
  }

  function backToCalendar() {
    setChosenSlot(null);
    reload();
  }

  if (chosenSlot) {
    return (
      <ConfirmBooking
        professionalId={professionalId}
        professionalName={professionalName}
        slot={chosenSlot}
        timezone={timezone}
        rescheduleSessionId={reschedule?.sessionId}
        onBack={() => setChosenSlot(null)}
        onBooked={() => {
          if (reschedule) {
            reschedule.onMoved();
            return;
          }
          setBooked(
            `Booked: ${formatDay(localDate(chosenSlot.start, timezone))}, ${formatTimeRange(chosenSlot, timezone)}`,
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
      <BookingNotice booked={booked} refusal={refusal} />
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
            selected={selectedDay}
            onSelect={setPickedDay}
          />
          {selectedDay ? (
            <DayTimes
              day={selectedDay}
              slots={slotsByDay.get(selectedDay) ?? []}
              timezone={timezone}
              onPick={chooseSlot}
            />
          ) : (
            <p className="hint">No free times in the next 4 weeks.</p>
          )}
        </>
      )}
    </>
  );
}
