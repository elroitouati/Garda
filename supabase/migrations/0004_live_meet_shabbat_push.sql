-- טואטי בגארדה — מיקומים חיים, נקודת מפגש, שבת והתראות Push

-- ── מיקומים: שורה אחת לכל בן משפחה, בלי היסטוריה ─────────────
create table public.locations (
  member_id text primary key references public.members(id) on delete cascade,
  lat double precision,
  lng double precision,
  accuracy real,
  heading real,
  sharing boolean not null default true,
  updated_at timestamptz not null default now()
);
alter table public.locations enable row level security;
create policy "family reads" on public.locations for select using (public.is_family());
create policy "write mine" on public.locations for insert with check (member_id = public.my_member_id());
create policy "update mine" on public.locations for update using (member_id = public.my_member_id()) with check (member_id = public.my_member_id());
create policy "delete mine" on public.locations for delete using (member_id = public.my_member_id());

-- מחיקת כל המיקומים אחרי הטיול (5.10 בבוקר, ושוב כל יום למקרה שפוספס)
create or replace function private.purge_locations() returns void language sql security definer as $$
  delete from public.locations where now() >= '2026-10-05 00:00:00+02';
$$;
do $$ begin
  create extension if not exists pg_cron;
  perform cron.schedule('garda-purge-locations', '15 3 * * *', 'select private.purge_locations()');
exception when others then raise notice 'pg_cron unavailable: %', sqlerrm;
end $$;

-- ── נקודת מפגש ─────────────────────────────────────────────
create table public.meetings (
  id uuid primary key default gen_random_uuid(),
  created_by text not null references public.members(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 80),
  lat double precision not null,
  lng double precision not null,
  meet_at timestamptz not null,
  audience text not null default 'all' check (audience in ('all', 'household')),
  household_id text references public.households(id) on delete cascade,
  active boolean not null default true,
  created_at timestamptz not null default now()
);
alter table public.meetings enable row level security;
create policy "family reads" on public.meetings for select
  using (public.is_family() and (audience = 'all' or household_id = public.my_household_id() or created_by = public.my_member_id()));
create policy "create as me" on public.meetings for insert with check (created_by = public.my_member_id());
create policy "cancel mine" on public.meetings for update using (created_by = public.my_member_id() or public.is_admin())
  with check (created_by = public.my_member_id() or public.is_admin());

-- ── שבת: זמנים (מנהג ארץ ישראל), ניתנים לעריכה ─────────────
create table public.shabbat (
  id int primary key default 1 check (id = 1),
  title text not null default 'שבת שלום',
  candles timestamptz not null,
  havdalah timestamptz not null
);
alter table public.shabbat enable row level security;
create policy "family reads" on public.shabbat for select using (public.is_family());
create policy "admin writes" on public.shabbat for all using (public.is_admin()) with check (public.is_admin());
-- Hebcal, מוניגה דל גארדה (45.53, 10.54), מנהג ארץ ישראל: שבת ושמיני עצרת
insert into public.shabbat (id, title, candles, havdalah)
values (1, 'שבת ושמיני עצרת', '2026-10-02 18:36:00+02', '2026-10-03 19:38:00+02')
on conflict (id) do nothing;

create or replace function public.in_shabbat(t timestamptz default now()) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.shabbat where t >= candles and t < havdalah)
$$;

-- ── Web Push ───────────────────────────────────────────────
create table public.push_subscriptions (
  endpoint text primary key,
  member_id text not null references public.members(id) on delete cascade,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now()
);
alter table public.push_subscriptions enable row level security;
create policy "mine" on public.push_subscriptions for all
  using (member_id = public.my_member_id()) with check (member_id = public.my_member_id());

-- הודעה חדשה / תזכורת / נקודת מפגש → Edge Function ששולחת Push
do $$ begin
  create extension if not exists pg_net with schema extensions;
exception when others then raise notice 'pg_net unavailable: %', sqlerrm;
end $$;

create or replace function private.notify_push(kind text, id uuid) returns void
language plpgsql security definer set search_path = public, private, extensions as $$
declare url text; secret text;
begin
  select value into url from private.app_config where key = 'push_url';
  select value into secret from private.app_config where key = 'push_secret';
  if url is null or secret is null then return; end if;
  perform net.http_post(
    url := url,
    body := jsonb_build_object('kind', kind, 'id', id),
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-garda-secret', secret)
  );
end $$;

create or replace function private.on_message() returns trigger
language plpgsql security definer set search_path = public, private as $$
begin
  if tg_op = 'INSERT' or new.reminded_at is distinct from old.reminded_at then
    perform private.notify_push('message', new.id);
  end if;
  return new;
end $$;
create trigger messages_push after insert or update of reminded_at on public.messages
  for each row execute function private.on_message();

create or replace function private.on_meeting() returns trigger
language plpgsql security definer set search_path = public, private as $$
begin
  perform private.notify_push('meeting', new.id);
  return new;
end $$;
create trigger meetings_push after insert on public.meetings
  for each row execute function private.on_meeting();

alter publication supabase_realtime add table public.locations, public.meetings, public.shabbat;
