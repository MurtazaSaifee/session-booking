export type TimeZoneOption = {
  zone: string;
  name: string;
  offset: string;
  offsetMinutes: number;
  label: string;
  searchText: string;
};

// Browsers still report some zones by an old name. Each pair is the same clock, under a name people recognise.
export const LEGACY_ZONE_NAMES: Record<string, string> = {
  "America/Buenos_Aires": "America/Argentina/Buenos_Aires",
  "America/Godthab": "America/Nuuk",
  "America/Indianapolis": "America/Indiana/Indianapolis",
  "America/Louisville": "America/Kentucky/Louisville",
  "Asia/Calcutta": "Asia/Kolkata",
  "Asia/Katmandu": "Asia/Kathmandu",
  "Asia/Rangoon": "Asia/Yangon",
  "Asia/Saigon": "Asia/Ho_Chi_Minh",
  "Atlantic/Faeroe": "Atlantic/Faroe",
  "Europe/Kiev": "Europe/Kyiv",
  "Pacific/Ponape": "Pacific/Pohnpei",
  "Pacific/Truk": "Pacific/Chuuk",
};

// Extra search words. A word belongs here only if every place it names keeps this zone's clock all year,
// so a country with several clocks, or a city with different clock changes, stays out.
export const ZONE_KEYWORDS: Record<string, string> = {
  "Africa/Johannesburg": "south africa",
  "Africa/Lagos": "nigeria",
  "America/Bogota": "colombia",
  "America/Lima": "peru",
  "America/Los_Angeles": "pacific time san francisco seattle",
  "America/New_York": "eastern time boston miami washington",
  "America/Chicago": "central time dallas houston",
  "America/Denver": "mountain time",
  "Asia/Bangkok": "thailand",
  "Asia/Colombo": "sri lanka",
  "Asia/Dhaka": "bangladesh",
  "Asia/Dubai": "uae abu dhabi",
  "Asia/Ho_Chi_Minh": "vietnam saigon hanoi",
  "Asia/Karachi": "pakistan islamabad lahore",
  "Asia/Kathmandu": "nepal",
  "Asia/Kolkata": "india calcutta mumbai bombay delhi bengaluru bangalore chennai hyderabad",
  "Asia/Kuala_Lumpur": "malaysia",
  "Asia/Manila": "philippines",
  "Asia/Seoul": "korea",
  "Asia/Shanghai": "china beijing",
  "Asia/Tokyo": "japan osaka kyoto",
  "Europe/Berlin": "germany",
  "Europe/London": "uk britain england edinburgh",
  "Europe/Paris": "france",
};

// "forty five" comes first, or "five" would be replaced inside it.
const NUMBER_WORDS: Record<string, string> = {
  "forty five": "45",
  plus: "+",
  minus: "-",
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
};

export function modernZoneName(zone: string): string {
  return LEGACY_ZONE_NAMES[zone] ?? zone;
}

export const browserTimeZone = modernZoneName(Intl.DateTimeFormat().resolvedOptions().timeZone);

export function zoneOffset(zone: string, date: Date): { offset: string; offsetMinutes: number } {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: zone,
    timeZoneName: "longOffset",
  }).formatToParts(date);
  const name = parts.find((part) => part.type === "timeZoneName")?.value ?? "";
  const match = name.match(/GMT([+-])(\d{2})(?::(\d{2}))?/);
  if (!match) return { offset: "+00:00", offsetMinutes: 0 };
  const [, sign, hours, minutes = "00"] = match;
  const offsetMinutes = (sign === "-" ? -1 : 1) * (Number(hours) * 60 + Number(minutes));
  return { offset: `${sign}${hours}:${minutes}`, offsetMinutes };
}

function withoutAccents(text: string): string {
  return text.normalize("NFD").replace(/\p{M}/gu, "");
}

function compact(text: string): string {
  return withoutAccents(text)
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

function toOption(zone: string): TimeZoneOption {
  const { offset, offsetMinutes } = zoneOffset(zone, new Date());
  const name = zone.replaceAll("_", " ");
  const sign = offset[0];
  const hours = offset.slice(1, 3);
  const minutes = offset.slice(4);
  const offsetForms = [`${hours}${minutes}`, `${Number(hours)}${minutes}`, hours, String(Number(hours))].map(
    (form) => `${sign}${form}`,
  );
  return {
    zone,
    name,
    offset,
    offsetMinutes,
    label: `(UTC${offset}) ${name}`,
    searchText: [compact(`${zone} ${ZONE_KEYWORDS[zone] ?? ""}`), ...offsetForms].join(" "),
  };
}

function sortOptions(options: TimeZoneOption[]): TimeZoneOption[] {
  return options.sort((a, b) => a.offsetMinutes - b.offsetMinutes || a.zone.localeCompare(b.zone));
}

// Built once, on first use: it takes about 30ms, and only the pages with this picker need it.
let allOptions: TimeZoneOption[] | null = null;

function supportedOptions(): TimeZoneOption[] {
  allOptions ??= sortOptions(
    [...new Set([...Intl.supportedValuesOf("timeZone").map(modernZoneName), "UTC"])].map(toOption),
  );
  return allOptions;
}

// Every real timezone, plus `current` if it isn't one of them. It is never swapped for a similar zone: two places
// with the same offset today can be an hour apart next month.
export function timeZoneOptions(current: string): TimeZoneOption[] {
  const options = supportedOptions();
  if (options.some((option) => option.zone === current)) return options;
  return sortOptions([...options, toOption(current)]);
}

export function searchTimeZones(options: TimeZoneOption[], query: string): TimeZoneOption[] {
  let words = withoutAccents(query).toLowerCase().trim();
  for (const [word, value] of Object.entries(NUMBER_WORDS)) {
    words = words.replaceAll(new RegExp(`\\b${word}\\b`, "g"), value);
  }
  words = words.replace(/^(utc|gmt)\s*(?=[+-])/, "");
  if (!words) return options;

  // A leading sign means an offset, so "-5" doesn't also find "+5". Anywhere else it is part of a name.
  const needle = /^[+-]/.test(words) ? words[0] + words.replace(/[^0-9]/g, "") : compact(words);
  return options.filter((option) => option.searchText.includes(needle));
}
