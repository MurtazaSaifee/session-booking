import { useEffect, useId, useMemo, useRef, useState } from "react";

export type TimeZoneSlot = {
  zone: string;
  offset: string; // e.g. "+05:30"
  offsetMinutes: number;
  label: string;
  searchTerms: string;
};

export type ZoneDefinition = {
  zone: string;
  name: string;
  searchTerms: string;
};

// Computes current runtime UTC offset dynamically using Intl so Daylight Saving Time (DST) is accurate.
export function getRuntimeOffset(
  zone: string,
  date: Date = new Date(),
): { offset: string; offsetMinutes: number } {
  try {
    const formatter = new Intl.DateTimeFormat("en-US", {
      timeZone: zone,
      timeZoneName: "longOffset",
    });
    const parts = formatter.formatToParts(date);
    const tzPart = parts.find((p) => p.type === "timeZoneName")?.value;
    if (tzPart) {
      if (tzPart === "GMT" || tzPart === "UTC") {
        return { offset: "+00:00", offsetMinutes: 0 };
      }
      const match = tzPart.match(/GMT([+-])(\d{1,2}):?(\d{2})?/);
      if (match) {
        const sign = match[1] === "-" ? -1 : 1;
        const hours = parseInt(match[2], 10);
        const minutes = match[3] ? parseInt(match[3], 10) : 0;
        const totalMinutes = sign * (hours * 60 + minutes);
        const formattedHours = String(hours).padStart(2, "0");
        const formattedMinutes = String(minutes).padStart(2, "0");
        return {
          offset: `${match[1]}${formattedHours}:${formattedMinutes}`,
          offsetMinutes: totalMinutes,
        };
      }
    }
  } catch {
    // fallback if timezone is not recognized
  }
  return { offset: "+00:00", offsetMinutes: 0 };
}

export const ZONE_DEFINITIONS: ZoneDefinition[] = [
  {
    zone: "Etc/GMT+12",
    name: "International Date Line West (Baker Island)",
    searchTerms: "baker island howland idlw",
  },
  {
    zone: "Pacific/Pago_Pago",
    name: "Midway, Samoa, Pago Pago",
    searchTerms: "samoa midway pago pago american samoa",
  },
  {
    zone: "Pacific/Honolulu",
    name: "Hawaii (Honolulu)",
    searchTerms: "hawaii honolulu hst aloha",
  },
  {
    zone: "Pacific/Marquesas",
    name: "Marquesas Islands",
    searchTerms: "marquesas french polynesia taiohae",
  },
  {
    zone: "America/Anchorage",
    name: "Alaska (Anchorage)",
    searchTerms: "alaska anchorage juneau fairbanks akst akdt",
  },
  {
    zone: "America/Los_Angeles",
    name: "Pacific Time (US & Canada, Los Angeles, Vancouver)",
    searchTerms: "pst pdt pt pacific los angeles vancouver seattle san francisco california",
  },
  {
    zone: "America/Phoenix",
    name: "Mountain Standard Time - Arizona (Phoenix, no DST)",
    searchTerms: "mst arizona phoenix scottsdale tucson no daylight saving",
  },
  {
    zone: "America/Denver",
    name: "Mountain Time (US & Canada, Denver, Salt Lake City)",
    searchTerms: "mst mdt mt mountain denver salt lake city calgary edmonton colorado",
  },
  {
    zone: "America/Chicago",
    name: "Central Time (US & Canada, Chicago, Mexico City)",
    searchTerms: "cst cdt ct central chicago dallas houston austin mexico city minneapolis",
  },
  {
    zone: "America/New_York",
    name: "Eastern Time (US & Canada, New York, Toronto, Miami)",
    searchTerms: "est edt et eastern new york toronto miami boston atlanta washington dc montreal",
  },
  {
    zone: "America/Halifax",
    name: "Atlantic Time (Halifax, Caracas, Santiago)",
    searchTerms: "ast adt atlantic halifax nova scotia caracas santiago",
  },
  {
    zone: "America/St_Johns",
    name: "Newfoundland (St. John's)",
    searchTerms: "newfoundland st johns nst ndt",
  },
  {
    zone: "America/Sao_Paulo",
    name: "Brasilia, Sao Paulo, Buenos Aires, Montevideo",
    searchTerms: "sao paulo rio de janeiro brazil buenos aires argentina montevideo uruguay",
  },
  {
    zone: "America/Noronha",
    name: "Mid-Atlantic, Fernando de Noronha, South Georgia",
    searchTerms: "noronha fernando de noronha south georgia grytviken",
  },
  {
    zone: "Atlantic/Cape_Verde",
    name: "Cape Verde, Azores",
    searchTerms: "cape verde praia azores ponta delgada",
  },
  {
    zone: "Europe/London",
    name: "London, Dublin, Lisbon, Edinburgh, UTC, GMT",
    searchTerms: "utc gmt bst we wet western european london dublin lisbon edinburgh belfast reykjavik",
  },
  {
    zone: "Europe/Paris",
    name: "Central European Time (Paris, Berlin, Rome, Madrid, Amsterdam)",
    searchTerms: "cet cest central european paris berlin rome madrid amsterdam brussels vienna warsaw",
  },
  {
    zone: "Europe/Athens",
    name: "Eastern European Time (Athens, Cairo, Helsinki, Bucharest)",
    searchTerms: "eet eest eastern european athens cairo helsinki bucharest kyiv riga tallinn vilnius sofia",
  },
  {
    zone: "Europe/Moscow",
    name: "Moscow, Istanbul, Riyadh, Nairobi, Baghdad, Doha",
    searchTerms:
      "msk moscow saint petersburg istanbul turkey riyadh saudi arabia nairobi kenya baghdad iraq doha qatar",
  },
  {
    zone: "Asia/Tehran",
    name: "Tehran (Iran)",
    searchTerms: "tehran iran irst irdt",
  },
  {
    zone: "Asia/Dubai",
    name: "Dubai, Abu Dhabi, Baku, Tbilisi, Yerevan, Muscat",
    searchTerms:
      "dubai abu dhabi uae united arab emirates gulf baku azerbaijan tbilisi georgia yerevan armenia muscat oman",
  },
  {
    zone: "Asia/Kabul",
    name: "Kabul (Afghanistan)",
    searchTerms: "kabul afghanistan aft",
  },
  {
    zone: "Asia/Karachi",
    name: "Karachi, Islamabad, Tashkent, Lahore",
    searchTerms: "karachi islamabad lahore pakistan tashkent uzbekistan pkt",
  },
  {
    zone: "Asia/Kolkata",
    name: "Mumbai, New Delhi, Kolkata, Bengaluru, Colombo",
    searchTerms:
      "plus five thirty india ist kolkata calcutta mumbai bombay delhi new delhi bangalore bengaluru madras chennai hyderabad colombo sri lanka",
  },
  {
    zone: "Asia/Kathmandu",
    name: "Kathmandu (Nepal)",
    searchTerms: "kathmandu nepal npt",
  },
  {
    zone: "Asia/Dhaka",
    name: "Dhaka, Almaty, Astana",
    searchTerms: "dhaka bangladesh bst almaty astana kazakhstan",
  },
  {
    zone: "Asia/Yangon",
    name: "Yangon, Cocos",
    searchTerms: "yangon rangoon myanmar burma cocos islands mmt",
  },
  {
    zone: "Asia/Bangkok",
    name: "Bangkok, Jakarta, Hanoi",
    searchTerms: "bangkok thailand jakarta indonesia hanoi vietnam saigon ho chi minh ict",
  },
  {
    zone: "Asia/Singapore",
    name: "Singapore, Hong Kong, Beijing, Perth, Kuala Lumpur, Taipei",
    searchTerms:
      "singapore hong kong beijing shanghai perth kuala lumpur malaysia manila philippines taipei taiwan cst sgt wawt",
  },
  {
    zone: "Australia/Eucla",
    name: "Eucla (Western Australia)",
    searchTerms: "eucla western australia acwst",
  },
  {
    zone: "Asia/Tokyo",
    name: "Tokyo, Seoul, Osaka",
    searchTerms: "tokyo kyoto osaka japan korea seoul jst kst",
  },
  {
    zone: "Australia/Adelaide",
    name: "Adelaide, Darwin",
    searchTerms: "adelaide darwin south australia northern territory acst acdt",
  },
  {
    zone: "Australia/Brisbane",
    name: "Brisbane, Gold Coast (Queensland, no DST)",
    searchTerms: "brisbane gold coast cairns queensland aest no daylight saving east australia",
  },
  {
    zone: "Australia/Sydney",
    name: "Sydney, Melbourne, Canberra, Hobart (AEST / AEDT)",
    searchTerms: "sydney melbourne canberra hobart new south wales victoria nsw aest aedt",
  },
  {
    zone: "Australia/Lord_Howe",
    name: "Lord Howe Island",
    searchTerms: "lord howe lhst lhdt",
  },
  {
    zone: "Pacific/Guadalcanal",
    name: "Solomon Islands, New Caledonia, Vanuatu",
    searchTerms: "solomon islands guadalcanal honiara new caledonia noumea vanuatu sbt nct",
  },
  {
    zone: "Pacific/Auckland",
    name: "Auckland, Wellington, Fiji",
    searchTerms: "new zealand auckland wellington christchurch fiji suva nzst nzdt",
  },
  {
    zone: "Pacific/Chatham",
    name: "Chatham Islands",
    searchTerms: "chatham islands waitangi chast chadt",
  },
  {
    zone: "Pacific/Tongatapu",
    name: "Tonga, Apia, Samoa",
    searchTerms: "tonga nukualofa apia samoa tot",
  },
  {
    zone: "Pacific/Kiritimati",
    name: "Line Islands (Kiritimati)",
    searchTerms: "kiritimati line islands christmas island lint",
  },
];

export function buildTimeZoneSlots(now: Date = new Date()): TimeZoneSlot[] {
  return ZONE_DEFINITIONS.map((def) => {
    const { offset, offsetMinutes } = getRuntimeOffset(def.zone, now);
    const label = `(UTC${offset}) ${def.name}`;
    const searchTerms = `${offset} ${offset.replace(":", "")} ${def.searchTerms}`.toLowerCase();
    return {
      zone: def.zone,
      offset,
      offsetMinutes,
      label,
      searchTerms,
    };
  });
}

export const TIME_ZONE_SLOTS: TimeZoneSlot[] = buildTimeZoneSlots();

export const browserTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;

// Resolves a browser IANA timezone or alias to the closest matching representative slot.
export function matchDefaultSlot(zoneName?: string): TimeZoneSlot {
  if (!zoneName) {
    return matchDefaultSlot(browserTimeZone);
  }

  const direct = TIME_ZONE_SLOTS.find((s) => s.zone === zoneName);
  if (direct) return direct;

  // Aliases (e.g. Asia/Calcutta -> Asia/Kolkata)
  if (zoneName === "Asia/Calcutta") {
    const kolkata = TIME_ZONE_SLOTS.find((s) => s.zone === "Asia/Kolkata");
    if (kolkata) return kolkata;
  }

  // Fallback by current runtime UTC offset in minutes
  try {
    const target = getRuntimeOffset(zoneName);
    const slot = TIME_ZONE_SLOTS.find((s) => s.offsetMinutes === target.offsetMinutes);
    if (slot) return slot;
  } catch {
    // ignore
  }

  // Sensible default fallback: London / UTC or first slot
  return (
    TIME_ZONE_SLOTS.find((s) => s.zone === "Europe/London") ||
    TIME_ZONE_SLOTS.find((s) => s.zone === "Etc/UTC") ||
    TIME_ZONE_SLOTS[0]
  );
}

// Normalizes numbers written as words to support natural queries like "plus five thirty"
function normalizeQuery(input: string): string {
  const words: Record<string, string> = {
    zero: "0",
    one: "1",
    two: "2",
    three: "3",
    four: "4",
    five: "5",
    six: "6",
    seven: "7",
    eight: "8",
    nine: "9",
    ten: "10",
    eleven: "11",
    twelve: "12",
    thirteen: "13",
    fourteen: "14",
    thirty: "30",
    fortyfive: "45",
    "forty five": "45",
    plus: "+",
    minus: "-",
  };

  let q = input.toLowerCase().trim();
  for (const [word, rep] of Object.entries(words)) {
    q = q.replaceAll(new RegExp(`\\b${word}\\b`, "g"), rep);
  }
  return q;
}

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
  const initialSlot = useMemo(() => matchDefaultSlot(defaultValue), [defaultValue]);
  const [selectedSlot, setSelectedSlot] = useState<TimeZoneSlot>(initialSlot);
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
    setSelectedSlot(matchDefaultSlot(defaultValue));
  }

  // Close dropdown on outside click, reverting any unselected search query
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setIsTyping(false);
        setQuery("");
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const filteredSlots = useMemo(() => {
    if (!isTyping || !query.trim()) return TIME_ZONE_SLOTS;

    const raw = query.toLowerCase().trim();
    const normalized = normalizeQuery(raw);
    const strippedRaw = raw.replace(/[^a-z0-9]/g, "");
    const strippedNorm = normalized.replace(/[^a-z0-9+-]/g, "");

    return TIME_ZONE_SLOTS.filter((slot) => {
      const fullText = (slot.label + " " + slot.searchTerms + " " + slot.zone).toLowerCase();
      // Direct substring match
      if (fullText.includes(raw) || fullText.includes(normalized)) return true;
      // Stripped alphanumeric match (e.g. "530" or "+530")
      const strippedFull = fullText.replace(/[^a-z0-9+-]/g, "");
      if (strippedFull.includes(strippedRaw) || strippedFull.includes(strippedNorm)) return true;
      return false;
    });
  }, [isTyping, query]);

  // Scroll active/highlighted option into view when navigating with keyboard
  useEffect(() => {
    if (isOpen && listRef.current) {
      const el = listRef.current.querySelector<HTMLElement>(`.tz-option[data-index="${highlightedIndex}"]`);
      if (el) {
        el.scrollIntoView({ block: "nearest" });
      }
    }
  }, [highlightedIndex, isOpen]);

  // Scroll selected option into view when opening
  useEffect(() => {
    if (isOpen && !isTyping && listRef.current) {
      const selectedEl = listRef.current.querySelector<HTMLElement>(".tz-option.selected");
      if (selectedEl) {
        selectedEl.scrollIntoView({ block: "nearest" });
      }
    }
  }, [isOpen, isTyping]);

  function handleSelect(slot: TimeZoneSlot) {
    setSelectedSlot(slot);
    setIsTyping(false);
    setQuery("");
    setIsOpen(false);
    inputRef.current?.blur();
    onChange?.(slot.zone);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (!isOpen) {
      if (e.key === "ArrowDown" || e.key === "Enter") {
        setIsOpen(true);
        e.preventDefault();
      }
      return;
    }

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlightedIndex((prev) => (prev + 1) % (filteredSlots.length || 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightedIndex((prev) => (prev - 1 + filteredSlots.length) % (filteredSlots.length || 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (filteredSlots[highlightedIndex]) {
        handleSelect(filteredSlots[highlightedIndex]);
      }
    } else if (e.key === "Escape") {
      setIsOpen(false);
      setIsTyping(false);
      setQuery("");
    }
  }

  const displayedValue = isTyping ? query : selectedSlot.label;
  const listboxId = `${id}-listbox`;
  const activeDescendantId =
    isOpen && filteredSlots[highlightedIndex] ? `${id}-opt-${highlightedIndex}` : undefined;

  return (
    <div className="tz-combobox" ref={containerRef}>
      <input type="hidden" name={name} value={selectedSlot.zone} />
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
          placeholder="Search timezone (e.g. +5:30, plus five thirty, Kolkata, Singapore)"
          value={displayedValue}
          onChange={(e) => {
            setQuery(e.target.value);
            setIsTyping(true);
            setHighlightedIndex(0);
            if (!isOpen) setIsOpen(true);
          }}
          onFocus={(e) => {
            setIsOpen(true);
            setIsTyping(false);
            e.currentTarget.select();
          }}
          onBlur={(e) => {
            if (!containerRef.current?.contains(e.relatedTarget as Node)) {
              setIsOpen(false);
              setIsTyping(false);
              setQuery("");
            }
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
            setIsOpen((prev) => {
              const next = !prev;
              if (next) {
                setIsTyping(false);
                inputRef.current?.focus();
              }
              return next;
            });
          }}
        >
          {isOpen ? "▲" : "▼"}
        </button>
      </div>

      {isOpen && (
        <ul id={listboxId} className="tz-dropdown" role="listbox" ref={listRef} aria-label="Time zones">
          {filteredSlots.length === 0 ? (
            <li className="tz-empty">No matching time zone found</li>
          ) : (
            filteredSlots.map((slot, index) => {
              const isSelected = slot.zone === selectedSlot.zone;
              const isHighlighted = index === highlightedIndex;
              return (
                <li
                  id={`${id}-opt-${index}`}
                  key={slot.zone}
                  data-index={index}
                  role="option"
                  aria-selected={isSelected}
                  className={`tz-option ${isSelected ? "selected" : ""} ${isHighlighted ? "highlighted" : ""}`}
                  onMouseEnter={() => setHighlightedIndex(index)}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    handleSelect(slot);
                  }}
                  onClick={() => handleSelect(slot)}
                >
                  <span className="tz-badge">{slot.offset}</span>
                  <span className="tz-label">
                    {slot.label.replace(/^\(UTC[+-]\d{2}:\d{2}\)\s*/, "")}
                  </span>
                </li>
              );
            })
          )}
        </ul>
      )}
    </div>
  );
}
