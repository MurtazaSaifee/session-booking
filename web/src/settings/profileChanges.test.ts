import { describe, expect, it } from "vitest";
import { profileChanges } from "./profileChanges";

const saved = { title: "Counsellor", bio: "Ten years of practice." };

describe("profileChanges", () => {
  it("returns nothing when neither field changed", () => {
    expect(profileChanges(saved, "Counsellor", "Ten years of practice.")).toEqual({});
  });

  it("returns only the bio when only the bio changed", () => {
    expect(profileChanges(saved, "Counsellor", "Twelve years of practice.")).toEqual({
      bio: "Twelve years of practice.",
    });
  });

  it("ignores surrounding spaces", () => {
    expect(profileChanges(saved, "  Counsellor ", " Ten years of practice.  ")).toEqual({});
  });
});
