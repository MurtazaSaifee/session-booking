# Decisions

The main calls, and what each one costs:

- **Postgres refuses double-bookings,** through exclusion constraints, so no code path can forget the rule. The cost is one business rule living in the schema.
- **A reminder is a row saved with its session,** and a background check delivers it. A crash can't lose or repeat one. The cost is that it can arrive up to a minute late.
- **A session is a moment and working hours are clock times,** so clock changes need no special handling. The cost is that changing a professional's timezone moves the times members can book.
- **A sign-in ends 7 days after login,** however active the person is. That limits a stolen token. The cost is logging in again every week.
- **This isn't ready for real patients yet.** [Running this in production](#running-this-in-production) lists what's missing.

## Preventing double-booking

Two members can press Book on the same slot at the same moment. Both requests read the calendar before either saves, so a check in code lets both through.

The database has the last word. The `sessions` table has two Postgres exclusion constraints on the session's time range, counting booked sessions only: one per professional and one per member. They catch partial overlaps too. A member's 09:30 session with a professional in Kolkata blocks a 09:00 and a 10:00 slot with a professional in Singapore, which a unique index on start time would miss.

A booking is two queries and takes no lock:

1. One read gets the professional, their hours and both people's busy times. The start must be one of the slots built from those, and this is what refuses off-grid, past and out-of-hours times.
2. One statement saves the session and its reminders, using `on conflict do nothing`. If nothing was saved, the member lost the race and one more query picks the message: "You already have a session at that time" or "That time was just booked".

I started with a plain insert and a retry on deadlock. Two plain inserts can wait on each other while the constraints are checked, and Postgres cancels one. Under load, a member who lost could get a 500 instead of "just booked". In a test of 10 members racing for one slot, that failed 2 runs in 30. More retries only turned it into a timeout. `on conflict` backs out of a clash instead of waiting on it, and the same test then passed 40 runs out of 40 on a busy machine.

**Trade-off:** I put business rules in code everywhere else, and this one is in the schema. It's worth the exception because the guarantee can't depend on every future code path remembering a lock.

## Cancelling and rescheduling

A reschedule updates the same row, so a member can't end up with no session or two. The session's time, its reminders and the notice to the professional all change in one statement, and any failure leaves everything as it was.

Each session has a `version` that goes up on every move and cancel. A change only applies if the version is still the one it read. If not, it reads the session again once and rechecks every rule. So a cancel racing a move can't miss the move's new reminders, or apply the 24-hour rule to the old time.

The 24-hour rule uses real elapsed milliseconds, so a clock change can't shift it. "Up to 24 hours before" includes exactly 24 hours, and one millisecond later is refused.

## Reminder scheduling and delivery

A reminder is a row next to its session, written in the same statement as the change that creates or cancels it. A session and its reminders can't disagree, even after a crash.

A background check runs at start-up and then every 60 seconds. Each batch of 100 is one short transaction:

1. Claim due reminders with `for update skip locked`, so two checkers never take the same row.
2. Write each text on the recipient's clock.
3. In one statement, save the notifications and mark the reminders sent.

Delivery is exactly once because the notification and the "sent" mark commit together. A crash partway through rolls back the batch, and the next run picks it up. As a backstop, `notifications.reminder_id` is unique. A second delivery is dropped and logged rather than failing, so one bad row can't stop everyone's reminders.

If the server was down, a due reminder goes out when it comes back, as long as the session hasn't started. After that it's marked skipped. Every reminder states the real date and time, so a late one is still correct.

I considered these and didn't use them:

- **Timers in memory:** lost on restart.
- **A job queue:** the session and its job become two writes that can disagree, so it would need an outbox table anyway.
- **A 30-minute check:** a "1 hour before" reminder could arrive 30 minutes before.

**Trade-off:** exactly once holds because delivery is a database write. Real email or push would be at least once, with an idempotency key.

## Timezones and clock changes

There are two kinds of time here, and they're stored differently:

- **A session is a moment.** It's stored as a UTC instant, and everyone sees that moment on their own clock.
- **Working hours are clock times.** Monday 09:00 is stored as a weekday and a time, with the timezone on the professional's record. It only becomes an instant when slots are built for a specific date, so 09:00 stays 09:00 across a clock change.

Dates are walked in calendar days on the professional's clock. Slots inside a day step in real elapsed time, so they never overlap. On a clock-change night in London, a 00:00 to 05:00 range holds 4 slots in March and a 00:00 to 04:00 range holds 5 in October.

Two odd cases follow from clocks changing:

- **A time that doesn't exist:** 01:30 on the March night in London is skipped. A range starting then moves forward by the missing hour, to 02:30.
- **A time that happens twice:** on the October night, two different slots read 1:00 am. Those times show their UTC offset, like "1:00 am – 1:50 am (GMT+1)" and "(GMT+0)", on the screens and in notifications, so a member can tell which one they're booking. Other times stay plain.

Luxon does every conversion on the server. The web shows times in the timezone on the person's profile, not the browser's, and the screen names that timezone. A person travelling still sees the zone they chose, instead of times that change without warning.

## How slots are laid out

Slots start at the beginning of each working-hours range and repeat every 60 minutes: a 50-minute session and a 10-minute gap. A slot is offered only if its session ends inside the range, so 09:00 to 17:00 gives 8 slots, the last at 16:00.

The gap gives a professional time to finish one conversation and prepare for the next person. A fixed grid also stops the calendar breaking up. If a member could start at any minute, a 09:20 booking would leave 20 minutes before it that nobody could use. Counting from the start of the range means a professional who starts at 09:30 gets 09:30, 10:30 and so on.

A professional can have several ranges a day, for a lunch break. Touching ranges are fine. Overlapping ranges and ranges that cross midnight are refused.

The slot builder is a pure function with no database or clock, so every timezone case is a table test.

## Sign-in and access

- **Tokens:** a 15-minute JWT and a refresh token, both in httpOnly cookies. A script on the page can't read an httpOnly cookie, which it could with localStorage.
- **Refresh:** only the token's hash is stored, and it rotates on every use. The new token keeps the old one's expiry, so a sign-in ends 7 days after login. Otherwise a stolen token could be refreshed forever.
- **Logout:** it revokes the refresh token and clears the cookies. A copied access token still works for up to 15 minutes. That's the cost of using a JWT over a token checked on every request.
- **Passwords:** hashed with scrypt and a random salt.
- **Cross-site requests:** every change must be JSON. With SameSite cookies, that stops cross-site form posts.
- **Access control:** every session and notification query starts from the signed-in user, so another person's session returns the same 404 as a missing one. The slots response holds only times, and merges the member's and professional's busy times so it can't reveal why a slot is gone.

## Working with the database

- **Fewest round trips first:** I aim for one or two queries per request, with the SQL doing the work. A write that must succeed together is one statement, which needs no transaction.
- **Knex, not an ORM:** exclusion constraints and `skip locked` need real SQL. Knex is the default, and raw SQL is fine wherever performance calls for it.
- **Plain SQL migrations:** each one is safe to run twice in a row, and a test runs every file twice to prove it.
- **Soft deletes:** a saved week of working hours replaces the old one by setting `deleted_at`. Dead refresh tokens are the one exception and are really deleted, because a spent credential isn't a record anyone reads and a soft delete wouldn't shrink the table.
- **Lists are bounded:** sessions, professionals and notifications page at 20 rows, continuing from the last row seen. Page 500 costs the same as page 1, and a row moving lists can't repeat or skip. The cost is no jump to "page 7 of 12".

## Measurements

I measured these during the build on a local scratch database with 100,000 users, 1,000,000 sessions and 2,000,000 refresh tokens, to check the design at production size. Query times are Postgres execution times from `EXPLAIN ANALYZE`, so they leave out the network and the app.

| What                                                  | Result                                                | What it decided                 |
| ----------------------------------------------------- | ----------------------------------------------------- | ------------------------------- |
| A person's cancelled sessions                         | 20 ms without an index, 0.23 ms with one              | Added the list indexes          |
| The sessions query, all three lists at once           | 0.75 ms                                               | One query per page load         |
| List of professionals                                 | 11 ms unbounded (2,000 profiles), 0.08 ms for 20 rows | Paged the list                  |
| Notifications, 1 million for one person               | 0.35 ms first page, 0.06 ms for a page halfway down   | Cursor paging, not offsets      |
| Claiming due reminders, 2 million rows, 1,000 pending | 2.6 ms                                                | A partial index on pending rows |
| Building slots                                        | About 1.1 ms with Luxon, about 0.3 ms in Postgres     | Kept Luxon                      |
| Refresh tokens with no clean-up                       | 463 MB at 2 million rows                              | Added a clean-up job            |

Building slots in SQL would save about 1 ms on something people do rarely, and cost the pure function and its table tests.

## Assumptions

- **"The next 4 weeks" means 28 days from now, in real elapsed time.** One fixed length is the same for every member in every timezone.
- **A session stays in Upcoming until its end time passes.** A session in progress is the one a person is most likely looking for.
- **A reminder is created only if it's due strictly after the time of booking.** A session booked exactly 24 hours ahead gets no 24-hour reminder, because a reminder due that instant tells the member nothing they haven't just seen.
- **A session has started at exactly its start time,** so a reminder checked at that moment is skipped. It can no longer do its job.
- **A reschedule stays with the same professional.** Changing professional means cancelling and booking again, so the choice of person is always a deliberate one.
- **Moving a session to its current time is refused.** Nothing would change, and the professional would get a notice about nothing.
- **A member's calendar hides slots that clash with their own sessions.** Offering a time that would only be refused wastes their effort.
- **A professional can cancel any of their sessions at any time, including past ones.** I read "at any time" literally, because they need control of their own calendar. The member is always notified. This does let a professional change history, which is one reason the audit log comes first in production.
- **Members can't cancel or move a session that has ended, and nobody can reschedule one.** Moving something that already happened has no meaning.
- **The other person is notified of every cancel and move.** Nobody should find out about a change by missing a session.
- **Changing working hours leaves booked sessions alone.** A professional editing their week shouldn't take away a member's session without a word. If a session has to go, they cancel it and the member is told.
- **Each professional sets their own minimum notice, from 0 to 28 days.** People prepare differently, so one fixed rule wouldn't suit everyone. It's 2 hours until they change it, and it applies only to new times, never to sessions already booked.

## Known limitations

- **Changing timezone:** a professional's working hours keep the same clock times, so the times members can book move. Booked sessions don't move. Existing notifications keep their original times. The settings screen warns about this, but nobody else is told. Reminders not yet delivered use the new timezone.
- **Blocked dates:** a professional can't block off a holiday yet.
- **Stolen refresh token:** it's single-use, but if a thief uses it first, the real user's next refresh fails and signs them out, while the thief stays signed in until that sign-in's 7 days end.
- **Notification list:** it doesn't update while it's open. The badge shows new arrivals.
- **Previous page:** it shows the remembered page, so a session cancelled since then looks booked until a reload.
- **Web tests:** the web has unit tests for its logic but no component tests. I checked the screens by hand in a browser.

## Running this in production

None of the following is built. Rate limiting, audit logs, consent records, encryption at rest and CI are all out of scope here, and a healthcare product needs every one of them.

What makes this product different is that the fact someone is seeing a counsellor is itself sensitive, even with no clinical notes in the system. A booking row, a log line or a notification can reveal it. So the first question for each item below is who can see that a person is getting support.

**Accountability and privacy law**

- **An append-only audit log:** who changed what, and when, with the before and after values, for sessions, cancellations and settings. It would also record staff who read a member's sessions. Soft deletes only keep the row and the time, not who did it.
- **A retention job and account closure:** Singapore's and Malaysia's PDPA both limit how long personal data is kept. Singapore's doesn't give a general right to deletion on request, so the job is what meets the duty there. Today only working hours are soft-deleted, and nobody can close an account. Production needs both, with a job that hard-deletes or anonymises personal data once it's past its retention period. Setting that period is a legal question, and clinical record rules may set a longer one.
- **Breach response:** Malaysia's 2024 PDPA amendments added mandatory breach notification and data protection officers. Production needs a named owner and a tested plan before launch.
- **Consent records:** what each person agreed to, and when.
- **Data residency:** where data is hosted and backed up, and what may cross a border, needs legal advice for each country. Malaysia or Singapore is the likely home. Any third party would get no names or session details.

**Security**

- Rate limiting on login, sign-up and booking.
- Encryption at rest, including backups, and TLS everywhere.
- Secrets from a secrets manager, with a rotation plan for the signing key.
- Reuse detection for refresh tokens, which ends every copy of a sign-in when a spent token comes back.
- Multi-factor sign-in, and a regular review of who has access.
- A check that logs hold no personal data. A failed request logs its real error, and database errors can contain values.

**Reliability**

- CI that runs the tests and the type check on every change.
- Monitoring and alerts on errors, and on the age of the oldest pending reminder. A stuck checker should wake someone up, since a missed reminder is a missed session.
- Tested backups and restores.
- A `DB_POOL_MAX` set so that copies times pool size stays under the database's connection limit.

**Migrations and indexes**

Production would run migrations as a deploy step, not at start-up. Today they run at start-up in one transaction, so a failed batch undoes itself and start-up waits for it.

To add an index to a big table, build it with `CREATE INDEX CONCURRENTLY` as a deploy step, because it can't run inside a transaction. The migration's `if not exists` then does nothing. Forgetting this step blocks writes to the table for the whole build. A failed concurrent build leaves an invalid index, which you drop and rebuild.

Never drop and recreate an index under the same name on a live table. The `working_hours` soft-delete migration does that, and it's safe only because it ships with the empty table.

## What I'd do next

- **Real email reminders:** the one out-of-scope feature I'd add first. If a professional cancels an hour before a session, a member who isn't in the app won't know until they're waiting for someone who isn't coming.
- **Blocked dates:** refusing the block until the day has no sessions, so no booked member is affected.
- **Timezone changes:** re-anchor a professional's hours when they move, or notify the members affected.
- **Live notifications:** the 30-second bell is fine at this size, but 100,000 open tabs is about 3,300 requests a second. The checker would publish a "something new" ping through a service like Ably, and the browser would fetch from the API, so the text and names stay out of the third party.
- **Lost updates:** two tabs editing the same profile field means the last save wins. A version check would catch it.
- **Web component tests** for the booking and settings screens.
