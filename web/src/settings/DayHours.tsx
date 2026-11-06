import type { EditableRange } from "./week";

type DayHoursProps = {
  dayName: string;
  weekday: number;
  ranges: EditableRange[];
  error?: string;
  onChange: (key: string, field: "start" | "end", value: string) => void;
  onRemove: (key: string) => void;
  onAdd: () => void;
  onCopyToWeekdays?: () => void;
  onClearDay?: () => void;
};

export function DayHours({
  dayName,
  weekday,
  ranges,
  error,
  onChange,
  onRemove,
  onAdd,
  onCopyToWeekdays,
  onClearDay,
}: DayHoursProps) {
  const isWeekday = weekday >= 1 && weekday <= 5;

  return (
    <fieldset className={`day-card ${error ? "has-error" : ""}`}>
      <legend className="day-title">{dayName}</legend>
      <div className="day-header-actions">
        {ranges.length > 0 && isWeekday && onCopyToWeekdays && (
          <button
            type="button"
            className="ghost-action"
            onClick={onCopyToWeekdays}
            title="Copy these hours to Monday through Friday"
          >
            Copy to weekdays
          </button>
        )}
        {ranges.length > 0 && onClearDay && (
          <button
            type="button"
            className="ghost-action text-danger"
            onClick={onClearDay}
            title="Clear all hours for this day"
          >
            Clear
          </button>
        )}
      </div>

      {error && (
        <div role="alert" className="inline-day-error">
          <span aria-hidden="true">⚠️</span>
          <span>{error}</span>
        </div>
      )}

      {ranges.length === 0 ? (
        <p className="not-working-hint">Not working</p>
      ) : (
        <div className="day-ranges-list">
          {ranges.map((range, index) => (
            <div key={range.key} className="range-row">
              <div className="range-inputs">
                <input
                  type="time"
                  step="1800"
                  aria-label={`${dayName} range ${index + 1} start`}
                  value={range.start}
                  onChange={(event) => onChange(range.key, "start", event.target.value)}
                  required
                />
                <span className="range-to" aria-hidden="true">
                  to
                </span>
                <input
                  type="time"
                  step="1800"
                  aria-label={`${dayName} range ${index + 1} end`}
                  value={range.end}
                  onChange={(event) => onChange(range.key, "end", event.target.value)}
                  required
                />
              </div>
              <button
                type="button"
                className="remove-range-button"
                onClick={() => onRemove(range.key)}
                aria-label={`Remove ${dayName} range ${index + 1}`}
              >
                Remove
              </button>
            </div>
          ))}
        </div>
      )}

      <button type="button" className="add-hours-btn" onClick={onAdd}>
        + Add hours
      </button>
    </fieldset>
  );
}
