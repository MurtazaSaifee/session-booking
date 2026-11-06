import { describe, expect, it } from "vitest";
import { getRuntimeOffset, matchDefaultSlot, TIME_ZONE_SLOTS } from "./TimeZoneSelect";

describe("TimeZoneSelect slots and default matching", () => {
  it("includes representative zones with valid IANA identifiers and dynamic offsets", () => {
    expect(TIME_ZONE_SLOTS.length).toBeGreaterThan(30);
    const uniqueZones = new Set(TIME_ZONE_SLOTS.map((s) => s.zone));
    expect(uniqueZones.size).toBe(TIME_ZONE_SLOTS.length);

    for (const slot of TIME_ZONE_SLOTS) {
      expect(slot.zone).toBeTruthy();
      expect(slot.offset).toMatch(/^[+-]\d{2}:\d{2}$/);
      expect(typeof slot.offsetMinutes).toBe("number");
      expect(slot.label).toContain(`UTC${slot.offset}`);
    }
  });

  it("dynamically calculates accurate runtime offsets via Intl", () => {
    const kolkataOffset = getRuntimeOffset("Asia/Kolkata");
    expect(kolkataOffset.offset).toBe("+05:30");
    expect(kolkataOffset.offsetMinutes).toBe(330);

    const londonOffset = getRuntimeOffset("Europe/London");
    expect(["+00:00", "+01:00"]).toContain(londonOffset.offset);
  });

  it("separates Brisbane and Sydney into distinct slots for non-DST support", () => {
    const brisbane = TIME_ZONE_SLOTS.find((s) => s.zone === "Australia/Brisbane");
    const sydney = TIME_ZONE_SLOTS.find((s) => s.zone === "Australia/Sydney");
    expect(brisbane).toBeDefined();
    expect(sydney).toBeDefined();
    expect(brisbane?.label).toContain("Brisbane");
    expect(sydney?.label).toContain("Sydney");
  });

  it("separates Phoenix and Denver into distinct slots for Arizona MST support", () => {
    const phoenix = TIME_ZONE_SLOTS.find((s) => s.zone === "America/Phoenix");
    const denver = TIME_ZONE_SLOTS.find((s) => s.zone === "America/Denver");
    expect(phoenix).toBeDefined();
    expect(denver).toBeDefined();
    expect(phoenix?.label).toContain("Phoenix");
    expect(denver?.label).toContain("Denver");
  });

  it("maps Asia/Calcutta to Asia/Kolkata (+05:30 slot)", () => {
    const slot = matchDefaultSlot("Asia/Calcutta");
    expect(slot.zone).toBe("Asia/Kolkata");
    expect(slot.offset).toBe("+05:30");
  });

  it("finds Singapore slot for Asia/Singapore", () => {
    const slot = matchDefaultSlot("Asia/Singapore");
    expect(slot.zone).toBe("Asia/Singapore");
    expect(slot.offset).toBe("+08:00");
  });

  it("includes search terms for +5:30 like 'plus five thirty', 'kolkata', 'calcutta'", () => {
    const kolkata = TIME_ZONE_SLOTS.find((s) => s.zone === "Asia/Kolkata");
    expect(kolkata).toBeDefined();
    expect(kolkata!.searchTerms).toContain("plus five thirty");
    expect(kolkata!.searchTerms).toContain("+05:30");
    expect(kolkata!.searchTerms).toContain("kolkata");
    expect(kolkata!.searchTerms).toContain("calcutta");
  });
});
