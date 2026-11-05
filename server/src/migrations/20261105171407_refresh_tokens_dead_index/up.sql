-- The moment a token stops working: when it was revoked, or else when it expires. One index finds both kinds.
-- Building an index here blocks writes. On a big table, build it with CONCURRENTLY as a deploy step first,
-- and this finds it and does nothing.
create index if not exists refresh_tokens_dead_idx on refresh_tokens (coalesce(revoked_at, expires_at));
