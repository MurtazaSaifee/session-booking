import type { EditableRange } from "./week";

type DayHoursProps = {
  dayName: string;
  ranges: EditableRange[];
  onChange: (key: string, field: "start" | "end", value: string) => void;
  onRemove: (key: string) => void;
  onAdd: () => void;
};

export function DayHours({ dayName, ranges, onChange, onRemove, onAdd }: DayHoursProps) {
  return (
    <fieldset className="day">
      <legend>{dayName}</legend>
      {ranges.length === 0 && <p className="hint">Not working</p>}
      {ranges.map((range, index) => (
        <div key={range.key} className="range">
          <input
            type="time"
            aria-label={`${dayName} range ${index + 1} start`}
            value={range.start}
            onChange={(event) => onChange(range.key, "start", event.target.value)}
            required
          />
          <input
            type="time"
            aria-label={`${dayName} range ${index + 1} end`}
            value={range.end}
            onChange={(event) => onChange(range.key, "end", event.target.value)}
            required
          />
          <button type="button" className="secondary" onClick={() => onRemove(range.key)}>
            Remove
          </button>
        </div>
      ))}
      <button type="button" className="secondary" onClick={onAdd}>
        Add hours
      </button>
    </fieldset>
  );
}
