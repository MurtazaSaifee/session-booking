alter table sessions drop constraint sessions_member_overlap;
alter table sessions add constraint sessions_member_overlap exclude using gist
  (member_id with =, tstzrange(starts_at, ends_at) with &&) where (status = 'BOOKED');
