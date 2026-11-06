import { describe, expect, it } from "vitest";
import {
  LEGACY_ZONE_NAMES,
  modernZoneName,
  searchTimeZones,
  timeZoneOptions,
  ZONE_KEYWORDS,
  zoneOffset,
} from "./timeZones";

const JANUARY = new Date("2027-01-15T12:00:00Z");
const JULY = new Date("2027-07-15T12:00:00Z");

function zonesFound(query: string, current = "Europe/London"): string[] {
  return searchTimeZones(timeZoneOptions(current), query).map((option) => option.zone);
}

describe("timeZoneOptions", () => {
  it.each(["America/Bogota", "Australia/Darwin", "Pacific/Fiji", "Asia/Kuala_Lumpur", "Africa/Johannesburg"])(
    "offers %s as itself",
    (zone) => {
      expect(timeZoneOptions(zone).filter((option) => option.zone === zone)).toHaveLength(1);
    },
  );

  it("keeps a saved zone that isn't in the list, instead of swapping it", () => {
    const options = timeZoneOptions("Asia/Calcutta");
    const saved = options.find((option) => option.zone === "Asia/Calcutta");
    expect(saved?.offset).toBe("+05:30");
    expect(options.filter((option) => option.zone === "Asia/Kolkata")).toHaveLength(1);
  });

  it("doesn't list a zone twice", () => {
    const zones = timeZoneOptions("UTC").map((option) => option.zone);
    expect(new Set(zones).size).toBe(zones.length);
  });

  it("orders the list by offset", () => {
    const offsets = timeZoneOptions("UTC").map((option) => option.offsetMinutes);
    expect(offsets).toEqual([...offsets].sort((a, b) => a - b));
  });
});

describe("zoneOffset", () => {
  it("tells apart two zones with the same offset today but different clock changes", () => {
    expect(zoneOffset("America/Bogota", JANUARY).offset).toBe("-05:00");
    expect(zoneOffset("America/New_York", JANUARY).offset).toBe("-05:00");
    expect(zoneOffset("America/Bogota", JULY).offset).toBe("-05:00");
    expect(zoneOffset("America/New_York", JULY).offset).toBe("-04:00");
  });

  it("handles half-hour offsets and UTC itself", () => {
    expect(zoneOffset("Asia/Kolkata", JANUARY)).toEqual({ offset: "+05:30", offsetMinutes: 330 });
    expect(zoneOffset("UTC", JANUARY)).toEqual({ offset: "+00:00", offsetMinutes: 0 });
  });
});

describe("legacy zone names", () => {
  it.each(Object.entries(LEGACY_ZONE_NAMES))("%s is the same clock as %s", (legacy, modern) => {
    expect(zoneOffset(legacy, JANUARY)).toEqual(zoneOffset(modern, JANUARY));
    expect(zoneOffset(legacy, JULY)).toEqual(zoneOffset(modern, JULY));
  });

  it("leaves other names alone", () => {
    expect(modernZoneName("America/Bogota")).toBe("America/Bogota");
  });
});

describe("searchTimeZones", () => {
  it.each([
    ["Bogota", "America/Bogota"],
    ["bogotá", "America/Bogota"],
    ["new york", "America/New_York"],
    ["port au prince", "America/Port-au-Prince"],
    ["kolkata", "Asia/Kolkata"],
    ["calcutta", "Asia/Kolkata"],
    ["india", "Asia/Kolkata"],
    ["malaysia", "Asia/Kuala_Lumpur"],
    ["+5:30", "Asia/Kolkata"],
    ["530", "Asia/Kolkata"],
    ["UTC+5:30", "Asia/Kolkata"],
    ["plus five thirty", "Asia/Kolkata"],
    ["plus five forty five", "Asia/Kathmandu"],
    ["minus five", "America/Bogota"],
  ])("%s finds %s", (query, zone) => {
    expect(zonesFound(query)).toContain(zone);
  });

  it("a signed offset doesn't find the opposite sign", () => {
    expect(zonesFound("-5")).not.toContain("Asia/Karachi");
    expect(zonesFound("+5")).not.toContain("America/Bogota");
  });

  it("an empty search shows everything", () => {
    expect(zonesFound("  ")).toHaveLength(timeZoneOptions("Europe/London").length);
  });

  it("a search with no match finds nothing", () => {
    expect(zonesFound("atlantis")).toEqual([]);
  });

  it("every zone with keywords is a real, listed zone", () => {
    const zones = timeZoneOptions("UTC").map((option) => option.zone);
    expect(zones).toEqual(expect.arrayContaining(Object.keys(ZONE_KEYWORDS)));
  });
});
