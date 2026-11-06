import { startTransition, useActionState, useMemo, useState, type SubmitEvent } from "react";
import { errorMessage } from "../api";
import { ErrorMessage } from "../components/ErrorMessage";
import { Loading } from "../components/Loading";
import { useLoad } from "../useLoad";
import { getHours, saveHours, type TimeRange } from "./api";
import { DayHours } from "./DayHours";
import {
  ALL_DAYS,
  applyBulkHours,
  clearDays,
  copyDayHoursTo,
  findDayOverlaps,
  MON_TO_FRI,
  newRange,
  SAT_AND_SUN,
  toEditable,
  toRanges,
  WEEKDAYS,
  type EditableRange,
} from "./week";

type FormState = { error: string | null; status: string | null };

export function HoursEditor({ timezone }: { timezone: string }) {
  const { data: hours, error: loadError } = useLoad(getHours);

  if (loadError) return <ErrorMessage message={loadError} />;
  if (!hours) return <Loading label="Loading your working hours…" />;
  return <HoursForm initial={hours} timezone={timezone} />;
}

function HoursForm({ initial, timezone }: { initial: TimeRange[]; timezone: string }) {
  const [week, setWeek] = useState<EditableRange[]>(() => toEditable(initial));
  // A status describes the last save, so it goes away once the week changes again.
  const [edited, setEdited] = useState(false);

  // Custom bulk setup state
  const [showCustomBulk, setShowCustomBulk] = useState(false);
  const [bulkStart, setBulkStart] = useState("09:00");
  const [bulkEnd, setBulkEnd] = useState("17:00");

  // Real-time overlap & validation detection
  const dayErrors = useMemo(() => findDayOverlaps(week), [week]);
  const hasErrors = dayErrors.size > 0;

  async function submit(): Promise<FormState> {
    try {
      setWeek(toEditable(await saveHours(toRanges(week))));
      return { error: null, status: "Working hours saved." };
    } catch (err) {
      return { error: errorMessage(err), status: null };
    }
  }

  const [{ error, status }, formAction, isPending] = useActionState(submit, { error: null, status: null });

  // onSubmit, not a form action: an action would clear the fields after an error.
  function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    if (hasErrors) return;
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

  // Bulk actions
  function handlePresetStandardWeekdays() {
    setEdited(true);
    setWeek((curr) => applyBulkHours(curr, MON_TO_FRI, [{ start: "09:00", end: "17:00" }]));
  }

  function handlePresetSplitWeekdays() {
    setEdited(true);
    setWeek((curr) =>
      applyBulkHours(curr, MON_TO_FRI, [
        { start: "09:00", end: "13:00" },
        { start: "14:00", end: "18:00" },
      ]),
    );
  }

  function handlePresetWeekends() {
    setEdited(true);
    setWeek((curr) => applyBulkHours(curr, SAT_AND_SUN, [{ start: "10:00", end: "14:00" }]));
  }

  function handleApplyCustomBulk(targetDays: number[]) {
    if (!bulkStart || !bulkEnd || bulkEnd <= bulkStart) return;
    setEdited(true);
    setWeek((curr) => applyBulkHours(curr, targetDays, [{ start: bulkStart, end: bulkEnd }]));
    setShowCustomBulk(false);
  }

  function handleClearAll() {
    if (!window.confirm("Clear working hours for all days?")) return;
    setEdited(true);
    setWeek([]);
  }

  function handleCopyToWeekdays(fromWeekday: number) {
    setEdited(true);
    setWeek((curr) => copyDayHoursTo(curr, fromWeekday, MON_TO_FRI));
  }

  function handleClearDay(weekday: number) {
    setEdited(true);
    setWeek((curr) => clearDays(curr, [weekday]));
  }

  return (
    <>
      <div className="section-header-block">
        <h2>Working hours</h2>
        <p className="hint">Times are on your own clock ({timezone}).</p>
      </div>

      {/* Quick Bulk Presets Toolbar */}
      <div className="schedule-toolbar">
        <span className="toolbar-label">Quick apply:</span>
        <div className="toolbar-buttons">
          <button type="button" className="preset-pill" onClick={handlePresetStandardWeekdays}>
            Weekdays (9am–5pm)
          </button>
          <button type="button" className="preset-pill" onClick={handlePresetSplitWeekdays}>
            Weekdays with Lunch Break
          </button>
          <button type="button" className="preset-pill" onClick={handlePresetWeekends}>
            Weekends (10am–2pm)
          </button>
          <button
            type="button"
            className={`preset-pill ${showCustomBulk ? "active" : ""}`}
            onClick={() => setShowCustomBulk((prev) => !prev)}
          >
            {showCustomBulk ? "Close Custom" : "Custom Bulk Set…"}
          </button>
          <button type="button" className="preset-pill text-danger" onClick={handleClearAll}>
            Clear All
          </button>
        </div>
      </div>

      {showCustomBulk && (
        <div className="custom-bulk-panel">
          <p className="bulk-instruction">Choose times to apply across multiple days:</p>
          <div className="bulk-time-row">
            <label className="bulk-time-label">
              <span>Start</span>
              <input
                type="time"
                step="1800"
                value={bulkStart}
                onChange={(e) => setBulkStart(e.target.value)}
              />
            </label>
            <span className="range-to">to</span>
            <label className="bulk-time-label">
              <span>End</span>
              <input type="time" step="1800" value={bulkEnd} onChange={(e) => setBulkEnd(e.target.value)} />
            </label>
          </div>
          {bulkEnd <= bulkStart && <p className="inline-day-error">End time must be after start time.</p>}
          <div className="bulk-apply-actions">
            <button
              type="button"
              className="secondary"
              disabled={bulkEnd <= bulkStart}
              onClick={() => handleApplyCustomBulk(MON_TO_FRI)}
            >
              Apply to Weekdays (Mon–Fri)
            </button>
            <button
              type="button"
              className="secondary"
              disabled={bulkEnd <= bulkStart}
              onClick={() => handleApplyCustomBulk(SAT_AND_SUN)}
            >
              Apply to Weekends (Sat–Sun)
            </button>
            <button
              type="button"
              className="secondary"
              disabled={bulkEnd <= bulkStart}
              onClick={() => handleApplyCustomBulk(ALL_DAYS)}
            >
              Apply to All Days
            </button>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <div className="days-stack">
          {WEEKDAYS.map(({ weekday, name }) => (
            <DayHours
              key={weekday}
              dayName={name}
              weekday={weekday}
              ranges={week.filter((range) => range.weekday === weekday)}
              error={dayErrors.get(weekday)}
              onChange={changeRange}
              onRemove={removeRange}
              onAdd={() => addRange(weekday)}
              onCopyToWeekdays={() => handleCopyToWeekdays(weekday)}
              onClearDay={() => handleClearDay(weekday)}
            />
          ))}
        </div>

        <ErrorMessage message={error} />

        {hasErrors && (
          <div role="alert" className="error">
            <span>Please resolve overlapping or invalid times above before saving.</span>
          </div>
        )}

        {status && !edited && (
          <p role="status" className="status">
            ✓ {status}
          </p>
        )}

        <button type="submit" className="submit" disabled={isPending || hasErrors}>
          Save working hours
        </button>
      </form>
    </>
  );
}
