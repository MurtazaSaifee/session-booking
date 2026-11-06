# AI usage

AI wrote nearly all of this code. I made the design calls, reviewed the work and pushed back when it was wrong, and I can explain every line.

## Tools

**Claude Code** was the main workhorse.

- **Opus 5.5** for design, coding and review.
- **Haiku** for busywork and exploring the codebase.
- Early on, Haiku and then Sonnet wrote the code in subagents while the main thread reviewed it. Partway through I moved all coding to the main thread, because briefing and re-reviewing each subagent repeated the work and cost more than it saved.

**Antigravity IDE with Gemini 3.8 Flash** was my second opinion.

- Reading code diffs and making changes by hand.
- A side-by-side chat for explaining tricky code and concepts.
- An adversarial code review for each ticket, and one for the whole codebase.
- A UI and UX pass to look at and fix each screen.

## How I worked

I started with a spec, questioned one decision at a time, then broke the work into small tickets. The normal flow for a commit was tests, an AI review and then my own read of the diff.

## Where I corrected the AI

**Scale and performance**

- **"It's only a demo."** Claude said some indexes could go because I wouldn't feel the speed-up "at demo size". I told it to treat this as a production system and audit what it had built. Lists now page at 20 rows and their queries use indexes. [DECISIONS.md](DECISIONS.md#measurements) has the numbers from testing at a million sessions.
- **Too many queries.** A booking ran a series of awaited queries. I asked for one or two per request, and challenged Claude's claim that a row lock and the reads can't share one statement. It tested this against a held lock. The claim was right, because a statement's snapshot is fixed when it starts, but the test also showed the lock added nothing the exclusion constraints didn't already give. So I dropped it. A booking is now two queries and no lock.
- **Reschedule round trips.** Claude kept three round trips to keep one ownership rule tidy. I chose performance, and it's now two.

**Product rules**

- **Cancelling past sessions.** Claude recommended that a professional could only cancel sessions that hadn't started, to keep past records true. The requirement says "at any time", and professionals need control of their own calendar, so I chose any time. The cost is that history can change, which is why the audit log comes first in production.
- **Moving a session to its own time.** Claude allowed it. Nothing would change, and the professional would get a notice about nothing. It's now refused with a clear message.
- **Working hours.** Claude proposed one range per weekday. I changed it to several, because professionals take lunch breaks.
- **Minimum notice.** Claude recommended one app-wide setting. I made it per professional, because I expected that to be the most requested change in a real product.
- **Change notices.** I added a notification to the other person on every cancel and move. Nobody should find out by missing a session.
- **Cancelled sessions.** Claude offered to file them under Upcoming or Past. I suggested a place of their own, so My sessions now has a Cancelled list and a rebooked time doesn't show two rows.

**Database**

- **Knex over raw SQL.** Claude's spec used plain SQL with a home-made migration runner. I switched to Knex, with raw SQL where performance calls for it.
- **No business rules in `CHECK` constraints.** I took out the ones Claude added, since the input is validated anyway. Unique keys, foreign keys and the exclusion constraints stay, because code can't enforce those under concurrency.
- **Soft deletes.** Claude's first working hours save deleted the old rows. I asked for `deleted_at`, because this kind of data shouldn't vanish.
- **Migrations safe to run twice.** Claude recommended against it for tables, since a failed batch rolls back whole. With a CI/CD pipeline in mind, I required it, and a test now runs every file twice.
- **Index builds.** Claude recommended changing the migration runner so index builds wouldn't block writes. I asked what that would cost: all-or-nothing batches would go, and start-up would still wait. I chose `create index if not exists`, with the concurrent build as a deploy step. Never dropping and recreating an index under the same name on a live table is a rule I followed for five years at my last company.
- **Who cancelled.** Claude recommended storing the role. I chose the user id, because the database can confirm it's a real user and it still works if someone else can cancel later.

**API, sign-in and structure**

- **`PATCH` for the profile.** Claude built a `PUT` that replaced the title and bio together. I asked why the web should send a field that hadn't changed. With `PATCH`, a second tab saving a stale title can't undo the first tab's change.
- **JWT.** Claude recommended an opaque cookie token and said JWT logout can't be immediate. I challenged that from experience, and it corrected the claim. I chose JWT with refresh tokens because I understand it better and can defend it.
- **Role checks.** Claude recommended a check inside each handler. I put it on the settings router, so no professional route can forget it.
- **Structure.** I reworked the folder structure of both the front end and the back end several times as the code grew, including moving SQL out of the route files and splitting one crowded folder into `booking`, `slots` and `time`. In the code review after each ticket, I also enforced a rule that most files stay around 100 lines.

**My own code reviews and testing**

- **Manual interventions.** Reading the diffs myself, I caught a race when two test runners created the test database at once, unbounded test connection pools, a deprecated type, an unused import and an oversized sign-up component. All were fixed before they went further.
- **Screens.** With 25 sessions in each list, My sessions was far too long, so I asked for tabs. I also sent screenshots of the header at five widths and had it rebuilt, with one fixed layout for each width range.
