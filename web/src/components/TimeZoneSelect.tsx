import { useEffect, useId, useMemo, useRef, useState } from "react";
import { searchTimeZones, timeZoneOptions, type TimeZoneOption } from "./timeZones";

export function TimeZoneSelect({
  name,
  defaultValue,
  onChange,
}: {
  name: string;
  defaultValue: string;
  onChange?: (zone: string) => void;
}) {
  const id = useId();
  const [zone, setZone] = useState(defaultValue);
  const [isTyping, setIsTyping] = useState(false);
  const [query, setQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const [prevDefaultValue, setPrevDefaultValue] = useState(defaultValue);
  if (defaultValue !== prevDefaultValue) {
    setPrevDefaultValue(defaultValue);
    setZone(defaultValue);
  }

  const options = useMemo(() => timeZoneOptions(zone), [zone]);
  const shownOptions = useMemo(
    () => (isTyping ? searchTimeZones(options, query) : options),
    [options, isTyping, query],
  );
  const selectedIndex = options.findIndex((option) => option.zone === zone);

  function open() {
    setIsOpen(true);
    setIsTyping(false);
    setHighlightedIndex(selectedIndex);
  }

  function close() {
    setIsOpen(false);
    setIsTyping(false);
    setQuery("");
  }

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) close();
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (isOpen) {
      listRef.current
        ?.querySelector<HTMLElement>(`.tz-option[data-index="${highlightedIndex}"]`)
        ?.scrollIntoView({ block: "nearest" });
    }
  }, [highlightedIndex, isOpen]);

  function handleSelect(option: TimeZoneOption) {
    setZone(option.zone);
    close();
    inputRef.current?.blur();
    onChange?.(option.zone);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (!isOpen) {
      if (e.key === "ArrowDown" || e.key === "Enter") {
        open();
        e.preventDefault();
      }
      return;
    }

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlightedIndex((prev) => (prev + 1) % (shownOptions.length || 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightedIndex((prev) => (prev - 1 + shownOptions.length) % (shownOptions.length || 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (shownOptions[highlightedIndex]) handleSelect(shownOptions[highlightedIndex]);
    } else if (e.key === "Escape") {
      close();
    }
  }

  const listboxId = `${id}-listbox`;
  const activeDescendantId =
    isOpen && shownOptions[highlightedIndex] ? `${id}-opt-${highlightedIndex}` : undefined;

  return (
    <div className="tz-combobox" ref={containerRef}>
      <input type="hidden" name={name} value={zone} />
      <div className="tz-input-wrap">
        <input
          id={id}
          ref={inputRef}
          type="text"
          className="tz-input"
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={isOpen}
          aria-controls={listboxId}
          aria-activedescendant={activeDescendantId}
          placeholder="Search timezone (e.g. Bogota, India, +5:30)"
          value={isTyping ? query : (options[selectedIndex]?.label ?? zone)}
          onChange={(e) => {
            setQuery(e.target.value);
            setIsTyping(true);
            setIsOpen(true);
            setHighlightedIndex(0);
          }}
          onFocus={(e) => {
            open();
            e.currentTarget.select();
          }}
          onBlur={(e) => {
            if (!containerRef.current?.contains(e.relatedTarget as Node)) close();
          }}
          onKeyDown={handleKeyDown}
          autoComplete="off"
        />
        <button
          type="button"
          className="tz-toggle"
          aria-label="Toggle timezone list"
          tabIndex={-1}
          onClick={() => {
            if (isOpen) {
              close();
            } else {
              open();
              inputRef.current?.focus();
            }
          }}
        >
          {isOpen ? "▲" : "▼"}
        </button>
      </div>

      {isOpen && (
        // Keeps focus in the search box while someone drags the list's scrollbar, which would otherwise close it.
        <ul
          id={listboxId}
          className="tz-dropdown"
          role="listbox"
          ref={listRef}
          aria-label="Time zones"
          onMouseDown={(e) => e.preventDefault()}
        >
          {shownOptions.length === 0 ? (
            <li className="tz-empty">No matching time zone found</li>
          ) : (
            shownOptions.map((option, index) => (
              <li
                id={`${id}-opt-${index}`}
                key={option.zone}
                data-index={index}
                role="option"
                aria-selected={option.zone === zone}
                className={`tz-option ${option.zone === zone ? "selected" : ""} ${index === highlightedIndex ? "highlighted" : ""}`}
                onMouseEnter={() => setHighlightedIndex(index)}
                onClick={() => handleSelect(option)}
              >
                <span className="tz-badge">{option.offset}</span>
                <span className="tz-label">{option.name}</span>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}
