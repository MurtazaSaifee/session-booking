import { formatDay, formatMonth } from "../time/format";

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

type CalendarGridProps = {
  weeks: string[][];
  freeDays: Set<string>;
  selected: string | undefined;
  onSelect: (day: string) => void;
};

export function CalendarGrid({ weeks, freeDays, selected, onSelect }: CalendarGridProps) {
  const firstDay = weeks[0][0];

  return (
    <div className="calendar">
      <div className="calendar-row" aria-hidden="true">
        {WEEKDAYS.map((weekday) => (
          <span key={weekday} className="calendar-weekday">
            {weekday}
          </span>
        ))}
      </div>
      {weeks.map((week) => (
        <div key={week[0]} className="calendar-row">
          {week.map((day) => (
            <button
              key={day}
              type="button"
              className="calendar-day"
              aria-label={formatDay(day)}
              aria-pressed={day === selected}
              disabled={!freeDays.has(day)}
              onClick={() => onSelect(day)}
            >
              {Number(day.slice(8))}
              {(day === firstDay || day.endsWith("-01")) && (
                <span className="calendar-month">{formatMonth(day)}</span>
              )}
            </button>
          ))}
        </div>
      ))}
    </div>
  );
}
