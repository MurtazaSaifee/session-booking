import { useId, useMemo, useRef, useState, useEffect } from "react";

export type TimeZoneSlot = {
  zone: string;
  offset: string; // e.g. "+05:30"
  offsetMinutes: number;
  label: string;
  searchTerms: string;
};

// Deduplicated list: exactly one primary timezone per UTC offset slot.
export const TIME_ZONE_SLOTS: TimeZoneSlot[] = [
  {
    zone: "Etc/GMT+12",
    offset: "-12:00",
    offsetMinutes: -720,
    label: "(UTC-12:00) International Date Line West (Baker Island)",
    searchTerms: "-12 -12:00 minus twelve baker island",
  },
  {
    zone: "Pacific/Pago_Pago",
    offset: "-11:00",
    offsetMinutes: -660,
    label: "(UTC-11:00) Midway, Samoa, Pago Pago",
    searchTerms: "-11 -11:00 minus eleven samoa midway pago pago",
  },
  {
    zone: "Pacific/Honolulu",
    offset: "-10:00",
    offsetMinutes: -600,
    label: "(UTC-10:00) Hawaii (Honolulu)",
    searchTerms: "-10 -10:00 minus ten hawaii honolulu hst",
  },
  {
    zone: "Pacific/Marquesas",
    offset: "-09:30",
    offsetMinutes: -570,
    label: "(UTC-09:30) Marquesas Islands",
    searchTerms: "-9:30 -09:30 minus nine thirty marquesas",
  },
  {
    zone: "America/Anchorage",
    offset: "-09:00",
    offsetMinutes: -540,
    label: "(UTC-09:00) Alaska (Anchorage)",
    searchTerms: "-9 -9:00 -09:00 minus nine alaska anchorage akst",
  },
  {
    zone: "America/Los_Angeles",
    offset: "-08:00",
    offsetMinutes: -480,
    label: "(UTC-08:00) Pacific Time (US & Canada, Los Angeles, Vancouver)",
    searchTerms: "-8 -8:00 -08:00 minus eight pst pt pacific los angeles vancouver seattle san francisco",
  },
  {
    zone: "America/Denver",
    offset: "-07:00",
    offsetMinutes: -420,
    label: "(UTC-07:00) Mountain Time (US & Canada, Denver, Phoenix)",
    searchTerms: "-7 -7:00 -07:00 minus seven mst mt mountain denver phoenix salt lake",
  },
  {
    zone: "America/Chicago",
    offset: "-06:00",
    offsetMinutes: -360,
    label: "(UTC-06:00) Central Time (US & Canada, Chicago, Mexico City)",
    searchTerms: "-6 -6:00 -06:00 minus six cst ct central chicago dallas houston mexico city",
  },
  {
    zone: "America/New_York",
    offset: "-05:00",
    offsetMinutes: -300,
    label: "(UTC-05:00) Eastern Time (US & Canada, New York, Toronto, Miami)",
    searchTerms: "-5 -5:00 -05:00 minus five est et eastern new york toronto miami boston atlanta",
  },
  {
    zone: "America/Halifax",
    offset: "-04:00",
    offsetMinutes: -240,
    label: "(UTC-04:00) Atlantic Time (Halifax, Santiago, Caracas)",
    searchTerms: "-4 -4:00 -04:00 minus four ast atlantic halifax santiago caracas",
  },
  {
    zone: "America/St_Johns",
    offset: "-03:30",
    offsetMinutes: -210,
    label: "(UTC-03:30) Newfoundland (St. John's)",
    searchTerms: "-3:30 -03:30 minus three thirty newfoundland st johns",
  },
  {
    zone: "America/Sao_Paulo",
    offset: "-03:00",
    offsetMinutes: -180,
    label: "(UTC-03:00) Sao Paulo, Buenos Aires, Montevideo",
    searchTerms: "-3 -3:00 -03:00 minus three sao paulo brazil buenos aires montevideo",
  },
  {
    zone: "America/Noronha",
    offset: "-02:00",
    offsetMinutes: -120,
    label: "(UTC-02:00) Mid-Atlantic, South Georgia",
    searchTerms: "-2 -2:00 -02:00 minus two mid atlantic south georgia",
  },
  {
    zone: "Atlantic/Cape_Verde",
    offset: "-01:00",
    offsetMinutes: -60,
    label: "(UTC-01:00) Cape Verde, Azores",
    searchTerms: "-1 -1:00 -01:00 minus one cape verde azores",
  },
  {
    zone: "Europe/London",
    offset: "+00:00",
    offsetMinutes: 0,
    label: "(UTC+00:00) London, Dublin, Lisbon, UTC, GMT",
    searchTerms: "+0 +0:00 0 0:00 00:00 utc gmt plus zero london dublin lisbon edinburgh belfast reykjavik",
  },
  {
    zone: "Europe/Paris",
    offset: "+01:00",
    offsetMinutes: 60,
    label: "(UTC+01:00) Central European Time (Paris, Berlin, Rome, Madrid, Amsterdam)",
    searchTerms: "+1 +1:00 1 1:00 plus one cet central european paris berlin rome madrid amsterdam brussels",
  },
  {
    zone: "Europe/Athens",
    offset: "+02:00",
    offsetMinutes: 120,
    label: "(UTC+02:00) Eastern European Time (Athens, Cairo, Helsinki, Johannesburg)",
    searchTerms: "+2 +2:00 2 2:00 plus two eet eastern european athens cairo helsinki johannesburg jerusalem",
  },
  {
    zone: "Europe/Moscow",
    offset: "+03:00",
    offsetMinutes: 180,
    label: "(UTC+03:00) Moscow, Istanbul, Riyadh, Nairobi, Baghdad",
    searchTerms: "+3 +3:00 3 3:00 plus three moscow istanbul riyadh nairobi baghdad qatar doha",
  },
  {
    zone: "Asia/Tehran",
    offset: "+03:30",
    offsetMinutes: 210,
    label: "(UTC+03:30) Tehran (Iran)",
    searchTerms: "+3:30 3:30 plus three thirty tehran iran irst",
  },
  {
    zone: "Asia/Dubai",
    offset: "+04:00",
    offsetMinutes: 240,
    label: "(UTC+04:00) Dubai, Abu Dhabi, Baku, Tbilisi, Yerevan",
    searchTerms: "+4 +4:00 4 4:00 plus four dubai abu dhabi uae gulf baku tbilisi yerevan",
  },
  {
    zone: "Asia/Kabul",
    offset: "+04:30",
    offsetMinutes: 270,
    label: "(UTC+04:30) Kabul (Afghanistan)",
    searchTerms: "+4:30 4:30 plus four thirty kabul afghanistan",
  },
  {
    zone: "Asia/Karachi",
    offset: "+05:00",
    offsetMinutes: 300,
    label: "(UTC+05:00) Karachi, Islamabad, Tashkent",
    searchTerms: "+5 +5:00 5 5:00 plus five karachi islamabad pakistan tashkent",
  },
  {
    zone: "Asia/Kolkata",
    offset: "+05:30",
    offsetMinutes: 330,
    label: "(UTC+05:30) Mumbai, New Delhi, Kolkata, Bengaluru, Colombo",
    searchTerms: "+5:30 5:30 530 +530 plus five thirty india ist kolkata calcutta mumbai delhi bangalore bengaluru madras chennai colombo",
  },
  {
    zone: "Asia/Kathmandu",
    offset: "+05:45",
    offsetMinutes: 345,
    label: "(UTC+05:45) Kathmandu (Nepal)",
    searchTerms: "+5:45 5:45 plus five fortyfive kathmandu nepal",
  },
  {
    zone: "Asia/Dhaka",
    offset: "+06:00",
    offsetMinutes: 360,
    label: "(UTC+06:00) Dhaka, Almaty",
    searchTerms: "+6 +6:00 6 6:00 plus six dhaka bangladesh almaty",
  },
  {
    zone: "Asia/Yangon",
    offset: "+06:30",
    offsetMinutes: 390,
    label: "(UTC+06:30) Yangon, Cocos",
    searchTerms: "+6:30 6:30 plus six thirty yangon rangoon myanmar burma cocos",
  },
  {
    zone: "Asia/Bangkok",
    offset: "+07:00",
    offsetMinutes: 420,
    label: "(UTC+07:00) Bangkok, Jakarta, Hanoi",
    searchTerms: "+7 +7:00 7 7:00 plus seven bangkok thailand jakarta indonesia hanoi vietnam",
  },
  {
    zone: "Asia/Singapore",
    offset: "+08:00",
    offsetMinutes: 480,
    label: "(UTC+08:00) Singapore, Hong Kong, Beijing, Perth, Kuala Lumpur",
    searchTerms: "+8 +8:00 8 8:00 plus eight singapore hong kong beijing shanghai perth kuala lumpur malaysia manila taipei cst sgt",
  },
  {
    zone: "Australia/Eucla",
    offset: "+08:45",
    offsetMinutes: 525,
    label: "(UTC+08:45) Eucla",
    searchTerms: "+8:45 8:45 plus eight fortyfive eucla western australia",
  },
  {
    zone: "Asia/Tokyo",
    offset: "+09:00",
    offsetMinutes: 540,
    label: "(UTC+09:00) Tokyo, Seoul, Osaka",
    searchTerms: "+9 +9:00 9 9:00 plus nine tokyo seoul osaka japan korea jst kst",
  },
  {
    zone: "Australia/Adelaide",
    offset: "+09:30",
    offsetMinutes: 570,
    label: "(UTC+09:30) Adelaide, Darwin",
    searchTerms: "+9:30 9:30 plus nine thirty adelaide darwin acst",
  },
  {
    zone: "Australia/Sydney",
    offset: "+10:00",
    offsetMinutes: 600,
    label: "(UTC+10:00) Sydney, Melbourne, Brisbane, Canberra",
    searchTerms: "+10 +10:00 10 10:00 plus ten sydney melbourne brisbane canberra aest east australia",
  },
  {
    zone: "Australia/Lord_Howe",
    offset: "+10:30",
    offsetMinutes: 630,
    label: "(UTC+10:30) Lord Howe Island",
    searchTerms: "+10:30 10:30 plus ten thirty lord howe",
  },
  {
    zone: "Pacific/Guadalcanal",
    offset: "+11:00",
    offsetMinutes: 660,
    label: "(UTC+11:00) Solomon Islands, New Caledonia",
    searchTerms: "+11 +11:00 11 11:00 plus eleven solomon islands new caledonia noumea",
  },
  {
    zone: "Pacific/Auckland",
    offset: "+12:00",
    offsetMinutes: 720,
    label: "(UTC+12:00) Auckland, Wellington, Fiji",
    searchTerms: "+12 +12:00 12 12:00 plus twelve new zealand auckland wellington fiji nzst",
  },
  {
    zone: "Pacific/Chatham",
    offset: "+12:45",
    offsetMinutes: 765,
    label: "(UTC+12:45) Chatham Islands",
    searchTerms: "+12:45 12:45 plus twelve fortyfive chatham islands",
  },
  {
    zone: "Pacific/Tongatapu",
    offset: "+13:00",
    offsetMinutes: 780,
    label: "(UTC+13:00) Tonga, Apia, Phoenix Islands",
    searchTerms: "+13 +13:00 13 13:00 plus thirteen tonga apia samoa",
  },
  {
    zone: "Pacific/Kiritimati",
    offset: "+14:00",
    offsetMinutes: 840,
    label: "(UTC+14:00) Line Islands (Kiritimati)",
    searchTerms: "+14 +14:00 14 14:00 plus fourteen kiritimati line islands",
  },
];

export const browserTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;

// Resolves a browser IANA timezone to the closest matching representative slot.
export function matchDefaultSlot(zoneName: string): TimeZoneSlot {
  const direct = TIME_ZONE_SLOTS.find((s) => s.zone === zoneName);
  if (direct) return direct;

  // Aliases (e.g. Asia/Calcutta -> Asia/Kolkata)
  if (zoneName === "Asia/Calcutta") {
    return TIME_ZONE_SLOTS.find((s) => s.zone === "Asia/Kolkata")!;
  }

  // Fallback by current UTC offset in minutes
  try {
    const now = new Date();
    const formatter = new Intl.DateTimeFormat("en-US", { timeZone: zoneName, timeZoneName: "shortOffset" });
    const parts = formatter.formatToParts(now);
    const offsetPart = parts.find((p) => p.type === "timeZoneName")?.value || "";
    // e.g. "GMT+5:30" or "GMT-8"
    const match = offsetPart.match(/GMT([+-])(\d+)(?::(\d+))?/);
    if (match) {
      const sign = match[1] === "-" ? -1 : 1;
      const hours = parseInt(match[2], 10);
      const minutes = match[3] ? parseInt(match[3], 10) : 0;
      const totalMinutes = sign * (hours * 60 + minutes);
      const slot = TIME_ZONE_SLOTS.find((s) => s.offsetMinutes === totalMinutes);
      if (slot) return slot;
    }
  } catch {
    // ignore
  }

  return TIME_ZONE_SLOTS.find((s) => s.zone === "Asia/Kolkata") || TIME_ZONE_SLOTS[0];
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

  // Scroll selected option into view when opening
  useEffect(() => {
    if (isOpen && !isTyping && listRef.current) {
      const selectedEl = listRef.current.querySelector(".tz-option.selected");
      if (selectedEl) {
        selectedEl.scrollIntoView({ block: "nearest" });
      }
    }
  }, [isOpen, isTyping]);

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

  // The displayed text in the input: always shows the selectedSlot's label unless the user is actively searching
  const displayedValue = isTyping ? query : selectedSlot.label;

  return (
    <div className="tz-combobox" ref={containerRef}>
      <input type="hidden" name={name} value={selectedSlot.zone} />
      <div className="tz-input-wrap">
        <input
          id={id}
          ref={inputRef}
          type="text"
          className="tz-input"
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
          onKeyDown={handleKeyDown}
          autoComplete="off"
        />
        <button
          type="button"
          className="tz-toggle"
          aria-label="Toggle timezone list"
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
        <ul className="tz-dropdown" role="listbox" ref={listRef}>
          {filteredSlots.length === 0 ? (
            <li className="tz-empty">No matching time zone found</li>
          ) : (
            filteredSlots.map((slot, index) => {
              const isSelected = slot.zone === selectedSlot.zone;
              const isHighlighted = index === highlightedIndex;
              return (
                <li
                  key={slot.zone}
                  role="option"
                  aria-selected={isSelected}
                  className={`tz-option ${isSelected ? "selected" : ""} ${isHighlighted ? "highlighted" : ""}`}
                  onMouseEnter={() => setHighlightedIndex(index)}
                  onMouseDown={(e) => {
                    // Prevent input blur before click handler processes
                    e.preventDefault();
                    handleSelect(slot);
                  }}
                  onClick={() => handleSelect(slot)}
                >
                  <span className="tz-badge">{slot.offset}</span>
                  <span className="tz-label">{slot.label}</span>
                </li>
              );
            })
          )}
        </ul>
      )}
    </div>
  );
}
