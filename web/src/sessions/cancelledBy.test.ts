import { describe, expect, it } from "vitest";
import { SessionStatus, type MySession } from "./api";
import { cancelledBy } from "./cancelledBy";

const session: MySession = {
  id: "3f2b8c1e-7a4d-4e6f-9b1a-2c3d4e5f6a7b",
  otherPersonName: "Nora Quill",
  start: "2027-01-18T03:30:00.000Z",
  end: "2027-01-18T04:20:00.000Z",
  status: SessionStatus.CANCELLED,
  cancelledByYou: false,
};

describe("cancelledBy", () => {
  it("names the other person when they cancelled", () => {
    expect(cancelledBy(session)).toBe("Cancelled by Nora Quill");
  });

  it("says you when the viewer cancelled", () => {
    expect(cancelledBy({ ...session, cancelledByYou: true })).toBe("Cancelled by you");
  });
});
