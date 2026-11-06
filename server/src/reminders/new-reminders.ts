import { REMINDER_LEAD_TIME, ReminderKind, ReminderStatus } from "./reminder-values.js";

// The reminders a session gets, one CTE for both people. `source` is a CTE holding the session's id, member_id,
// professional_id and starts_at. Only reminders still in the future are created, using :now.
export function newRemindersCte(source: string): string {
  return `
    new_reminders as (
      insert into reminders (session_id, recipient_id, kind, due_at, status)
      select s.id, recipient.id, reminder.kind, s.starts_at - reminder.lead_time, :pending
      from ${source} s
      cross join lateral (values (s.member_id), (s.professional_id)) as recipient (id)
      cross join (
        values
          (:dayBefore, cast(:dayBeforeLeadTime as interval)),
          (:hourBefore, cast(:hourBeforeLeadTime as interval))
      ) as reminder (kind, lead_time)
      where s.starts_at - reminder.lead_time > :now
    )`;
}

export const newRemindersParams = {
  pending: ReminderStatus.PENDING,
  dayBefore: ReminderKind.DAY_BEFORE,
  hourBefore: ReminderKind.HOUR_BEFORE,
  dayBeforeLeadTime: REMINDER_LEAD_TIME[ReminderKind.DAY_BEFORE],
  hourBeforeLeadTime: REMINDER_LEAD_TIME[ReminderKind.HOUR_BEFORE],
};
