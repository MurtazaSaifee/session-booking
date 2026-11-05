-- Postgres checks a table's constraints oldest first and reports the first one broken. Re-creating the
-- professional's rule puts the member's first, so a member racing themselves hears they already have it.
alter table sessions drop constraint if exists sessions_professional_overlap;
alter table sessions add constraint sessions_professional_overlap exclude using gist
  (professional_id with =, tstzrange(starts_at, ends_at) with &&) where (status = 'BOOKED');
