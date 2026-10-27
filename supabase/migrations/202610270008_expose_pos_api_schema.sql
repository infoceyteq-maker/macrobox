-- Supabase-hosted PostgREST configuration only. Do not run this in the local
-- PGlite preview, which has no `authenticator` role.
--
-- The isolated POS schema must be exposed to the Data API so @supabase/ssr can
-- use `db.schema = macrobox_pos` and send the matching Accept-Profile header.
-- The existing public/storage/graphql_public exposure is preserved. RLS and
-- explicit grants remain the authorization boundary.

alter role authenticator
  set pgrst.db_schemas = 'public, storage, graphql_public, macrobox_pos';

notify pgrst, 'reload config';
notify pgrst, 'reload schema';
