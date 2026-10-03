-- "המסע": כל המשפחה קוראת את החומרים (כתיבה נשארת למנהלים),
-- ומנהל משחרר לכולם עם key='release' -> התראה לכולם
drop policy if exists "admins read" on public.journey;
drop policy if exists "family read" on public.journey;
create policy "family read" on public.journey for select using (public.is_family());

create or replace function private.on_journey_release() returns trigger
language plpgsql security definer set search_path = public, private as $$
begin
  if new.key = 'release' and coalesce((new.data->>'open')::boolean, false)
     and (tg_op = 'INSERT' or not coalesce((old.data->>'open')::boolean, false)) then
    perform private.notify_push('masa', null);
  end if;
  return new;
end $$;
drop trigger if exists journey_release_push on public.journey;
create trigger journey_release_push after insert or update on public.journey for each row execute function private.on_journey_release();

do $$ begin
  alter publication supabase_realtime add table public.journey;
exception when duplicate_object then null; end $$;
