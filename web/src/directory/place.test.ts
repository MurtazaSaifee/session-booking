import { describe, expect, it } from "vitest";
import { placeName } from "./place";

describe("placeName", () => {
  it("uses the city from a region and city", () => {
    expect(placeName("Asia/Kolkata")).toBe("Kolkata");
  });

  it("turns underscores into spaces", () => {
    expect(placeName("Asia/Kuala_Lumpur")).toBe("Kuala Lumpur");
  });

  it("uses the last part of a longer name", () => {
    expect(placeName("America/Argentina/Buenos_Aires")).toBe("Buenos Aires");
  });

  it("keeps a name with no region as it is", () => {
    expect(placeName("UTC")).toBe("UTC");
  });
});
