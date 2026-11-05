import { describe, expect, it } from "vitest";
import { CancelledBy, SessionStatus, type MySession } from "./api";
import { cancelledLabel } from "./cancelledLabel";

const session: MySession = {
  id: "3f2b8c1e-7a4d-4e6f-9b1a-2c3d4e5f6a7b",
  otherPersonName: "Nora Quill",
  start: "2027-01-18T03:30:00.000Z",
  end: "2027-01-18T04:20:00.000Z",
  status: SessionStatus.CANCELLED,
  cancelledBy: CancelledBy.OTHER_PERSON,
};

describe("cancelledLabel", () => {
  it("names the other person when they cancelled", () => {
    expect(cancelledLabel(session)).toBe("Cancelled by Nora Quill");
  });

  it("says you when the viewer cancelled", () => {
    expect(cancelledLabel({ ...session, cancelledBy: CancelledBy.YOU })).toBe("Cancelled by you");
  });

  it("names no one when there's no record of who cancelled", () => {
    expect(cancelledLabel({ ...session, cancelledBy: null })).toBe("Cancelled");
  });
});
