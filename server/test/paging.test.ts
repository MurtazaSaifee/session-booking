import { describe, expect, it } from "vitest";
import { z } from "zod";
import { ErrorCode } from "../src/errors.js";
import { PAGE_SIZE, decodeCursor, encodeCursor, toPage } from "../src/paging.js";

const ID = "3f2b8c1e-7a4d-4e6f-9b1a-2c3d4e5f6a7b";
const instant = z.iso.datetime({ offset: true });

function encoded(value: unknown): string {
  return Buffer.from(JSON.stringify(value)).toString("base64url");
}

describe("cursors", () => {
  it("gives back the position it was made from", () => {
    const position = { value: "2027-01-18T09:50:00.000Z", id: ID };

    expect(decodeCursor(encodeCursor(position), instant)).toEqual(position);
  });

  it.each([
    ["not a cursor at all", "@@@"],
    ["valid JSON of the wrong shape", encoded({ value: "2027-01-18T09:50:00.000Z", id: ID })],
    ["too many parts", encoded(["2027-01-18T09:50:00.000Z", ID, "extra"])],
    ["a value that fails the list's check", encoded(["next tuesday", ID])],
    ["an id that isn't a uuid", encoded(["2027-01-18T09:50:00.000Z", "1 or 1=1"])],
  ])("refuses %s", (_name, cursor) => {
    expect(() => decodeCursor(cursor, instant)).toThrowError(
      expect.objectContaining({ status: 400, code: ErrorCode.VALIDATION }),
    );
  });
});

describe("toPage", () => {
  const rows = (count: number) => Array.from({ length: count }, (_, i) => ({ name: `row ${i}`, id: ID }));
  const position = (row: { name: string; id: string }) => ({ value: row.name, id: row.id });

  it("has no next page when every row fits", () => {
    expect(toPage(rows(PAGE_SIZE), position)).toEqual({ items: rows(PAGE_SIZE), next: null });
  });

  it("drops the extra row and continues from the last row shown", () => {
    const page = toPage(rows(PAGE_SIZE + 1), position);

    expect(page.items).toEqual(rows(PAGE_SIZE));
    expect(decodeCursor(page.next as string, z.string())).toEqual({ value: `row ${PAGE_SIZE - 1}`, id: ID });
  });

  it("handles an empty list", () => {
    expect(toPage([], position)).toEqual({ items: [], next: null });
  });
});
