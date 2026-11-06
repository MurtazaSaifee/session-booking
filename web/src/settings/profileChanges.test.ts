import { describe, expect, it } from "vitest";
import { profileChanges } from "./profileChanges";

const saved = { title: "Counsellor", bio: "Ten years of practice.", minimumNoticeMinutes: 120 };

describe("profileChanges", () => {
  it("returns nothing when neither field changed", () => {
    expect(profileChanges(saved, "Counsellor", "Ten years of practice.", 120)).toEqual({});
  });

  it("returns only the bio when only the bio changed", () => {
    expect(profileChanges(saved, "Counsellor", "Twelve years of practice.", 120)).toEqual({
      bio: "Twelve years of practice.",
    });
  });

  it("returns only the notice when only the notice changed", () => {
    expect(profileChanges(saved, "Counsellor", "Ten years of practice.", 0)).toEqual({
      minimumNoticeMinutes: 0,
    });
  });

  it("ignores surrounding spaces", () => {
    expect(profileChanges(saved, "  Counsellor ", " Ten years of practice.  ", 120)).toEqual({});
  });
});
