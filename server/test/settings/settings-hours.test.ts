import { afterAll, beforeEach, expect, it } from "vitest";
import { ErrorCode } from "../../src/errors.js";
import { API_V1 } from "../../src/paths.js";
import { createTestApp, resetDb, signUpAgent, testClock, testProfessional } from "../app.js";
import { createTestDb } from "../db.js";

const MONDAY = 1;
const WEDNESDAY = 3;
const HOURS_URL = `${API_V1}/settings/hours`;

const clock = testClock("2027-01-15T09:00:00Z");

const db = createTestDb();
const app = createTestApp(db, clock.now);

beforeEach(() => resetDb(db));

afterAll(() => db.destroy());

it("a new professional has no hours", async () => {
  const professional = await signUpAgent(app, testProfessional);

  const res = await professional.get(HOURS_URL);

  expect(res.status).toBe(200);
  expect(res.body).toEqual({ ranges: [] });
});

it("saves a week with a lunch break and returns it sorted", async () => {
  const professional = await signUpAgent(app, testProfessional);
  const week = [
    { weekday: WEDNESDAY, start: "10:00", end: "14:00" },
    { weekday: MONDAY, start: "13:00", end: "17:00" },
    { weekday: MONDAY, start: "09:00", end: "12:00" },
  ];
  const sorted = [week[2], week[1], week[0]];

  const res = await professional.put(HOURS_URL).send({ ranges: week });

  expect(res.status).toBe(200);
  expect(res.body).toEqual({ ranges: sorted });
  const after = await professional.get(HOURS_URL);
  expect(after.body).toEqual({ ranges: sorted });
});

it("accepts ranges that touch", async () => {
  const professional = await signUpAgent(app, testProfessional);
  const touching = [
    { weekday: MONDAY, start: "09:00", end: "12:00" },
    { weekday: MONDAY, start: "12:00", end: "17:00" },
  ];

  const res = await professional.put(HOURS_URL).send({ ranges: touching });

  expect(res.status).toBe(200);
  expect(res.body).toEqual({ ranges: touching });
});

it("refuses overlapping ranges and keeps the saved week", async () => {
  const professional = await signUpAgent(app, testProfessional);
  const saved = [{ weekday: MONDAY, start: "09:00", end: "17:00" }];
  await professional.put(HOURS_URL).send({ ranges: saved });

  const res = await professional.put(HOURS_URL).send({
    ranges: [
      { weekday: MONDAY, start: "09:00", end: "12:00" },
      { weekday: MONDAY, start: "11:00", end: "15:00" },
    ],
  });

  expect(res.status).toBe(400);
  expect(res.body).toEqual({
    error: ErrorCode.RANGES_OVERLAP,
    message: "Monday's time ranges overlap. Please fix them.",
  });
  const after = await professional.get(HOURS_URL);
  expect(after.body).toEqual({ ranges: saved });
});

it("names the day that overlaps", async () => {
  const professional = await signUpAgent(app, testProfessional);

  const res = await professional.put(HOURS_URL).send({
    ranges: [
      { weekday: MONDAY, start: "09:00", end: "12:00" },
      { weekday: WEDNESDAY, start: "09:00", end: "12:00" },
      { weekday: WEDNESDAY, start: "10:00", end: "14:00" },
    ],
  });

  expect(res.status).toBe(400);
  expect(res.body).toEqual({
    error: ErrorCode.RANGES_OVERLAP,
    message: "Wednesday's time ranges overlap. Please fix them.",
  });
});

const WEEKDAY_MESSAGE = "Please choose a weekday from Monday to Sunday.";
const TIME_MESSAGE = "Times must look like 09:00.";
const ORDER_MESSAGE = "Each time range must end after it starts, on the same day.";

it.each([
  {
    case: "end before start",
    range: { weekday: MONDAY, start: "12:00", end: "09:00" },
    message: ORDER_MESSAGE,
  },
  {
    case: "end equal to start",
    range: { weekday: MONDAY, start: "09:00", end: "09:00" },
    message: ORDER_MESSAGE,
  },
  {
    case: "crossing midnight",
    range: { weekday: MONDAY, start: "22:00", end: "02:00" },
    message: ORDER_MESSAGE,
  },
  {
    case: "a time without a leading zero",
    range: { weekday: MONDAY, start: "9:00", end: "12:00" },
    message: TIME_MESSAGE,
  },
  { case: "24:00", range: { weekday: MONDAY, start: "09:00", end: "24:00" }, message: TIME_MESSAGE },
  { case: "weekday 0", range: { weekday: 0, start: "09:00", end: "12:00" }, message: WEEKDAY_MESSAGE },
  { case: "weekday 8", range: { weekday: 8, start: "09:00", end: "12:00" }, message: WEEKDAY_MESSAGE },
  {
    case: "a fractional weekday",
    range: { weekday: 1.5, start: "09:00", end: "12:00" },
    message: WEEKDAY_MESSAGE,
  },
  {
    case: "a range that isn't an object",
    range: "09:00",
    message: "Each time range needs a weekday, a start and an end.",
  },
])("refuses $case", async ({ range, message }) => {
  const professional = await signUpAgent(app, testProfessional);

  const res = await professional.put(HOURS_URL).send({ ranges: [range] });

  expect(res.status).toBe(400);
  expect(res.body).toEqual({ error: ErrorCode.VALIDATION, message });
});

it("refuses a body with no ranges", async () => {
  const professional = await signUpAgent(app, testProfessional);

  const res = await professional.put(HOURS_URL).send({});

  expect(res.status).toBe(400);
  expect(res.body).toEqual({
    error: ErrorCode.VALIDATION,
    message: "Please send your working hours as a list of time ranges.",
  });
});

it("refuses more than 50 ranges", async () => {
  const professional = await signUpAgent(app, testProfessional);
  const tooMany = Array.from({ length: 51 }, () => ({ weekday: MONDAY, start: "09:00", end: "10:00" }));

  const res = await professional.put(HOURS_URL).send({ ranges: tooMany });

  expect(res.status).toBe(400);
  expect(res.body).toEqual({
    error: ErrorCode.VALIDATION,
    message: "You can save at most 50 time ranges.",
  });
});

it("replaces the whole week on each save", async () => {
  const professional = await signUpAgent(app, testProfessional);
  const wednesday = [{ weekday: WEDNESDAY, start: "10:00", end: "14:00" }];
  await professional.put(HOURS_URL).send({ ranges: [{ weekday: MONDAY, start: "09:00", end: "17:00" }] });

  await professional.put(HOURS_URL).send({ ranges: wednesday });

  const after = await professional.get(HOURS_URL);
  expect(after.body).toEqual({ ranges: wednesday });
});

it("saving no ranges clears the week", async () => {
  const professional = await signUpAgent(app, testProfessional);
  await professional.put(HOURS_URL).send({ ranges: [{ weekday: MONDAY, start: "09:00", end: "17:00" }] });

  const res = await professional.put(HOURS_URL).send({ ranges: [] });

  expect(res.status).toBe(200);
  expect(res.body).toEqual({ ranges: [] });
  const after = await professional.get(HOURS_URL);
  expect(after.body).toEqual({ ranges: [] });
});

it("two saves at the same moment leave one whole week", async () => {
  const professional = await signUpAgent(app, testProfessional);
  const weekA = [
    { weekday: MONDAY, start: "09:00", end: "12:00" },
    { weekday: MONDAY, start: "13:00", end: "17:00" },
  ];
  const weekB = [{ weekday: MONDAY, start: "10:00", end: "13:00" }];

  for (let round = 0; round < 5; round++) {
    const [first, second] = await Promise.all([
      professional.put(HOURS_URL).send({ ranges: weekA }),
      professional.put(HOURS_URL).send({ ranges: weekB }),
    ]);

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    const after = await professional.get(HOURS_URL);
    expect([weekA, weekB]).toContainEqual(after.body.ranges);
  }
});
