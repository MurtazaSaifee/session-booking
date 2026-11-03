import { startTransition, useActionState, useEffect, useState, type SubmitEvent } from "react";
import { ErrorMessage } from "../components/ErrorMessage";
import { getHours, saveHours, type TimeRange } from "./api";
import { DayHours } from "./DayHours";
import { newRange, toEditable, toRanges, WEEKDAYS, type EditableRange } from "./week";

type FormState = { error: string | null; status: string | null };

export function HoursEditor({ timezone }: { timezone: string }) {
  const [hours, setHours] = useState<TimeRange[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    getHours()
      .then((loaded) => {
        if (active) setHours(loaded);
      })
      .catch((err) => {
        if (active) setLoadError(err instanceof Error ? err.message : "Something went wrong.");
      });
    return () => {
      active = false;
    };
  }, []);

  if (loadError) return <ErrorMessage message={loadError} />;
  if (!hours) return <p>Loading your working hours…</p>;
  return <HoursForm initial={hours} timezone={timezone} />;
}

function HoursForm({ initial, timezone }: { initial: TimeRange[]; timezone: string }) {
  const [week, setWeek] = useState<EditableRange[]>(() => toEditable(initial));
  // A status describes the last save, so it goes away once the week changes again.
  const [edited, setEdited] = useState(false);

  async function submit(): Promise<FormState> {
    try {
      setWeek(toEditable(await saveHours(toRanges(week))));
      return { error: null, status: "Saved." };
    } catch (err) {
      return { error: err instanceof Error ? err.message : "Something went wrong.", status: null };
    }
  }

  const [{ error, status }, formAction, isPending] = useActionState(submit, { error: null, status: null });

  // onSubmit, not a form action: an action would clear the fields after an error.
  function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    setEdited(false);
    startTransition(() => formAction());
  }

  function changeRange(key: string, field: "start" | "end", value: string) {
    setEdited(true);
    setWeek((current) => current.map((range) => (range.key === key ? { ...range, [field]: value } : range)));
  }

  function removeRange(key: string) {
    setEdited(true);
    setWeek((current) => current.filter((range) => range.key !== key));
  }

  function addRange(weekday: number) {
    const dayRanges = week.filter((range) => range.weekday === weekday);
    setEdited(true);
    setWeek([...week, ...toEditable([newRange(weekday, dayRanges)])]);
  }

  return (
    <>
      <h2>Working hours</h2>
      <p className="hint">Times are on your own clock ({timezone}).</p>
      <form onSubmit={handleSubmit}>
        {WEEKDAYS.map(({ weekday, name }) => (
          <DayHours
            key={weekday}
            dayName={name}
            ranges={week.filter((range) => range.weekday === weekday)}
            onChange={changeRange}
            onRemove={removeRange}
            onAdd={() => addRange(weekday)}
          />
        ))}
        <ErrorMessage message={error} />
        {status && !edited && (
          <p role="status" className="status">
            {status}
          </p>
        )}
        <button type="submit" className="submit" disabled={isPending}>
          Save working hours
        </button>
      </form>
    </>
  );
}
