import type { Db } from "./db.js";
import { hashPassword } from "./auth/passwords.js";
import { Role } from "./roles.js";
import { SessionStatus } from "./session-status.js";
import { newRemindersCte, newRemindersParams } from "./reminders/new-reminders.js";
import type { TimeRange } from "./settings/hours.js";

export const DEMO_PASSWORD = "password123";

const SEED_LOCK_ID = 727275;

type ProfessionalSeed = {
  name: string;
  email: string;
  timezone: string;
  title: string;
  bio: string;
  ranges: TimeRange[];
};

type MemberSeed = {
  name: string;
  email: string;
  timezone: string;
};

// Monday = 1 through Friday = 5
const MON_TO_FRI = [1, 2, 3, 4, 5];

function weekdayRanges(weekdays: number[], ranges: { start: string; end: string }[]): TimeRange[] {
  return weekdays.flatMap((weekday) => ranges.map((r) => ({ weekday, start: r.start, end: r.end })));
}

export const DEMO_PROFESSIONALS: ProfessionalSeed[] = [
  {
    name: "Priya Nair",
    email: "priya@example.com",
    timezone: "Asia/Kolkata",
    title: "Counsellor",
    bio: "Licensed counsellor supporting people through life transitions, stress, and anxiety with practical, compassionate guidance.",
    // Indian business hours with a lunch break
    ranges: weekdayRanges(MON_TO_FRI, [
      { start: "09:30", end: "13:00" },
      { start: "14:00", end: "18:00" },
    ]),
  },
  {
    name: "Daniel Tan",
    email: "daniel@example.com",
    timezone: "Asia/Singapore",
    title: "Career coach",
    bio: "Executive and career coach helping professionals navigate pivots, build leadership confidence, and find purposeful work.",
    // Standard Singapore hours with a lunch break
    ranges: weekdayRanges(MON_TO_FRI, [
      { start: "09:00", end: "12:00" },
      { start: "13:00", end: "17:00" },
    ]),
  },
  {
    name: "Aisha Rahman",
    email: "aisha@example.com",
    timezone: "Asia/Kuala_Lumpur",
    title: "Counsellor",
    bio: "Counsellor focusing on workplace well-being, mindfulness, and personal growth through evidence-based approaches.",
    // Continuous hours
    ranges: weekdayRanges(MON_TO_FRI, [{ start: "09:00", end: "17:00" }]),
  },
  {
    name: "Emily Clarke",
    email: "emily@example.com",
    timezone: "Australia/Sydney",
    title: "Psychologist",
    bio: "Registered psychologist supporting individuals with cognitive-behavioural strategies for anxiety and sustainable mental health.",
    // Sydney hours with a lunch break
    ranges: weekdayRanges(MON_TO_FRI, [
      { start: "09:00", end: "13:00" },
      { start: "14:00", end: "17:00" },
    ]),
  },
];

export const DEMO_MEMBERS: MemberSeed[] = [
  {
    name: "Sam Lee",
    email: "sam@example.com",
    timezone: "Asia/Singapore",
  },
  {
    name: "Alex Morgan",
    email: "alex@example.com",
    timezone: "Europe/London",
  },
];

// Seeds demo data only when the database has no users. Restarts find existing users and do nothing.
export async function seedIfEmpty(db: Db, now: Date): Promise<boolean> {
  return db.transaction(async (trx) => {
    await trx.raw("select pg_advisory_xact_lock(?)", [SEED_LOCK_ID]);

    const existing = await trx.raw<{ rows: [{ exists: boolean }] }>(
      "select exists(select 1 from users limit 1) as exists",
    );
    if (existing.rows[0].exists) return false;

    const passwordHash = await hashPassword(DEMO_PASSWORD);

    const usersToInsert = [
      ...DEMO_PROFESSIONALS.map((p) => ({
        role: Role.PROFESSIONAL,
        name: p.name,
        email: p.email,
        timezone: p.timezone,
        title: p.title,
        bio: p.bio,
      })),
      ...DEMO_MEMBERS.map((m) => ({
        role: Role.MEMBER,
        name: m.name,
        email: m.email,
        timezone: m.timezone,
        title: null,
        bio: null,
      })),
    ];

    const userRows = await trx.raw<{ rows: { id: string; email: string }[] }>(
      `
      insert into users (role, name, email, password_hash, timezone, title, bio)
      select role, name, email, :passwordHash, timezone, title, bio
      from json_to_recordset(cast(:users as json))
        as (role text, name text, email text, timezone text, title text, bio text)
      returning id, email
      `,
      {
        passwordHash,
        users: JSON.stringify(usersToInsert),
      },
    );

    const userMap = new Map(userRows.rows.map((r) => [r.email, r.id]));

    const hoursToInsert = DEMO_PROFESSIONALS.flatMap((p) => {
      const professionalId = userMap.get(p.email)!;
      return p.ranges.map((r) => ({
        professional_id: professionalId,
        weekday: r.weekday,
        start_time: r.start,
        end_time: r.end,
      }));
    });

    await trx.raw(
      `
      insert into working_hours (professional_id, weekday, start_time, end_time)
      select professional_id, weekday, start_time, end_time
      from json_to_recordset(cast(:hours as json))
        as (professional_id uuid, weekday smallint, start_time time, end_time time)
      `,
      { hours: JSON.stringify(hoursToInsert) },
    );

    const samId = userMap.get("sam@example.com")!;
    const priyaId = userMap.get("priya@example.com")!;

    // Align to the nearest minute so times display cleanly.
    const startMinute = Math.floor(now.getTime() / 60_000) * 60_000;
    const upcomingStart = new Date(startMinute + 70 * 60_000);
    const upcomingEnd = new Date(upcomingStart.getTime() + 50 * 60_000);

    const pastStart = new Date(startMinute - 48 * 60 * 60_000);
    const pastEnd = new Date(pastStart.getTime() + 50 * 60_000);

    await trx.raw(
      `
      with seeded_sessions as (
        insert into sessions (member_id, professional_id, starts_at, ends_at, status)
        values
          (:memberId, :professionalId, :upcomingStart, :upcomingEnd, :booked),
          (:memberId, :professionalId, :pastStart, :pastEnd, :booked)
        returning *
      ),
      ${newRemindersCte("seeded_sessions")}
      select id from seeded_sessions
      `,
      {
        memberId: samId,
        professionalId: priyaId,
        upcomingStart,
        upcomingEnd,
        pastStart,
        pastEnd,
        now,
        ...newRemindersParams,
        booked: SessionStatus.BOOKED,
      },
    );

    return true;
  });
}

