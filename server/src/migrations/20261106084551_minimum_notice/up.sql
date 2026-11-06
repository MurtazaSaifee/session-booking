-- How far ahead a member must book with this professional. Empty until they choose, and the code applies the default.
alter table users add column if not exists minimum_notice_minutes integer;
