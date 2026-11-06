import { describe, expect, it } from "vitest";
import { matchDefaultSlot, TIME_ZONE_SLOTS } from "./TimeZoneSelect";

describe("TimeZoneSelect slots and default matching", () => {
  it("has exactly one timezone entry per UTC offset slot", () => {
    const offsets = TIME_ZONE_SLOTS.map((s) => s.offsetMinutes);
    const uniqueOffsets = new Set(offsets);
    expect(offsets.length).toBe(uniqueOffsets.size);
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
    expect(kolkata!.searchTerms).toContain("+5:30");
    expect(kolkata!.searchTerms).toContain("kolkata");
    expect(kolkata!.searchTerms).toContain("calcutta");
  });
});

