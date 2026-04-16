-- =============================================================================
-- Pass display_name through from auth signup metadata to profiles.
--
-- signInWithOtp({ email, options: { data: { display_name } } })
--   → auth.users.raw_user_meta_data.display_name
--   → profiles.display_name   (via the trigger updated below)
--
-- Safe to rerun: we CREATE OR REPLACE the function.
-- =============================================================================

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email, display_name)
  values (
    new.id,
    new.email,
    nullif(trim(new.raw_user_meta_data ->> 'display_name'), '')
  );
  return new;
end;
$$;
