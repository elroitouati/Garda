-- טואטי בגארדה — סכמה, RLS ו-RPC (שלב 1)
create extension if not exists pgcrypto with schema extensions;

-- ── סכמה פרטית: לא נחשפת דרך ה-API ─────────────────────────────
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table private.app_config (key text primary key, value text not null);
create table private.pin_attempts (
  id bigserial primary key,
  user_id uuid,
  ok boolean not null,
  at timestamptz not null default now()
);

-- להרצה ידנית מה-SQL Editor בלבד: select private.set_pin('1234');
create or replace function private.set_pin(new_pin text) returns void
language plpgsql security definer set search_path = private, extensions as $$
begin
  if new_pin !~ '^\d{4}$' then raise exception 'PIN must be 4 digits'; end if;
  insert into private.app_config(key, value) values ('pin_hash', extensions.crypt(new_pin, extensions.gen_salt('bf')))
  on conflict (key) do update set value = excluded.value;
end $$;

-- בדיקת PIN עם הגבלת ניסיונות (לפי משתמש וגלובלית)
create or replace function private.pin_ok(pin text) returns text
language plpgsql security definer set search_path = private, extensions as $$
declare h text; v_ok boolean;
begin
  if (select count(*) from private.pin_attempts where not ok and user_id = auth.uid() and at > now() - interval '15 minutes') >= 8
     or (select count(*) from private.pin_attempts where not ok and at > now() - interval '15 minutes') >= 60 then
    return 'too_many';
  end if;
  select value into h from private.app_config where key = 'pin_hash';
  if h is null then return 'no_pin'; end if;
  v_ok := coalesce(pin, '') ~ '^\d{4}$' and extensions.crypt(pin, h) = h;
  insert into private.pin_attempts(user_id, ok) values (auth.uid(), v_ok);
  return case when v_ok then 'ok' else 'bad_pin' end;
end $$;

-- ── טבלאות ──────────────────────────────────────────────────────
create table public.households (
  id text primary key,
  name text not null,
  sort int not null default 0
);

create table public.members (
  id text primary key,
  name text not null,
  color text not null default '#2F6B3A',
  initials text,                                   -- אופציונלי; אחרת מחושב (שתי אותיות)
  household_id text not null default 'tuati' references public.households(id),
  is_admin boolean not null default false,
  guardian_id text references public.members(id) on delete set null, -- משתתף בלי טלפון
  avatar_path text,
  sort int not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.devices (
  user_id uuid primary key references auth.users(id) on delete cascade,
  member_id text not null references public.members(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table public.places (
  id text primary key,
  name text not null,
  name_he text,
  kind text not null default 'star',   -- hotel|port|supermarket|castle|park|water|karting|food|cafe|city|museum|bike|airport|mall|star
  lat double precision not null,
  lng double precision not null,
  address text,
  rain_plan boolean not null default false,
  main boolean not null default true,  -- מוצג על המפה כברירת מחדל
  geofence_m int not null default 300,
  notes text,
  sort int not null default 0
);

create table public.days (
  date date primary key,
  title text not null,
  subtitle text,
  center_place_id text references public.places(id) on delete set null,
  is_shabbat boolean not null default false
);

create table public.activities (
  id uuid primary key default gen_random_uuid(),
  day date not null references public.days(date) on delete cascade,
  start_time time not null,           -- שעון Europe/Rome
  end_time time,
  title text not null,
  place_id text references public.places(id) on delete set null,
  option_group text check (option_group in ('A','B')),
  household_id text references public.households(id) on delete cascade, -- null = משותף לכולם
  notes text,
  sort int not null default 0,
  updated_at timestamptz not null default now()
);
create index on public.activities(day);

create table public.essentials (
  id uuid primary key default gen_random_uuid(),
  household_id text not null references public.households(id) on delete cascade,
  kind text not null default 'other',  -- flight|car|hotel|insurance|other
  title text not null,
  subtitle text,
  fields jsonb not null default '[]',  -- [{ "label": "...", "value": "...", "copy": true }]
  address text,
  lat double precision,
  lng double precision,
  sort int not null default 0
);

create table public.emergency_contacts (
  id uuid primary key default gen_random_uuid(),
  household_id text not null references public.households(id) on delete cascade,
  name text not null,
  name_latin text,
  role text,             -- papà / mamma / ...
  phone text not null default '',
  sort int not null default 0
);

-- ── פונקציות עזר ל-RLS ─────────────────────────────────────────
create or replace function public.my_member_id() returns text
language sql stable security definer set search_path = public as $$
  select member_id from public.devices where user_id = auth.uid()
$$;

create or replace function public.my_household_id() returns text
language sql stable security definer set search_path = public as $$
  select m.household_id from public.devices d join public.members m on m.id = d.member_id where d.user_id = auth.uid()
$$;

create or replace function public.is_family() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.devices where user_id = auth.uid())
$$;

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select m.is_admin from public.devices d join public.members m on m.id = d.member_id where d.user_id = auth.uid()), false)
$$;

-- ── RLS ────────────────────────────────────────────────────────
alter table public.households enable row level security;
alter table public.members enable row level security;
alter table public.devices enable row level security;
alter table public.places enable row level security;
alter table public.days enable row level security;
alter table public.activities enable row level security;
alter table public.essentials enable row level security;
alter table public.emergency_contacts enable row level security;

create policy "family reads" on public.households for select using (public.is_family());
create policy "admin writes" on public.households for all using (public.is_admin()) with check (public.is_admin());

create policy "family reads" on public.members for select using (public.is_family());
create policy "admin writes" on public.members for all using (public.is_admin()) with check (public.is_admin());

create policy "family reads" on public.devices for select using (public.is_family());
create policy "leave own" on public.devices for delete using (user_id = auth.uid());

create policy "family reads" on public.places for select using (public.is_family());
create policy "admin writes" on public.places for all using (public.is_admin()) with check (public.is_admin());

create policy "family reads" on public.days for select using (public.is_family());
create policy "admin writes" on public.days for all using (public.is_admin()) with check (public.is_admin());

create policy "shared or mine" on public.activities for select
  using (public.is_family() and (household_id is null or household_id = public.my_household_id() or public.is_admin()));
create policy "admin writes" on public.activities for all using (public.is_admin()) with check (public.is_admin());

-- מידע חיוני: כל משפחה רואה רק את שלה (גם מנהלים)
create policy "own household" on public.essentials for select using (household_id = public.my_household_id());
create policy "own household writes" on public.essentials for all
  using (household_id = public.my_household_id() and public.is_admin())
  with check (household_id = public.my_household_id() and public.is_admin());

create policy "own household" on public.emergency_contacts for select using (household_id = public.my_household_id() or public.is_admin());
create policy "admin writes" on public.emergency_contacts for all using (public.is_admin()) with check (public.is_admin());

-- ── RPC ────────────────────────────────────────────────────────
-- שלב 1 בכניסה: בדיקת הקוד והחזרת רשימת המשתתפים לבחירה
create or replace function public.check_pin(pin text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare r text;
begin
  r := private.pin_ok(pin);
  if r <> 'ok' then return jsonb_build_object('error', r); end if;
  return jsonb_build_object('members', coalesce((
    select jsonb_agg(jsonb_build_object('id', id, 'name', name, 'color', color, 'initials', initials) order by sort)
    from public.members where active and guardian_id is null), '[]'::jsonb));
end $$;

-- שלב 2 בכניסה: קישור המכשיר (auth.uid) לבן המשפחה
create or replace function public.join_family(pin text, member_id text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare r text;
begin
  if auth.uid() is null then return jsonb_build_object('error', 'no_session'); end if;
  r := private.pin_ok(pin);
  if r <> 'ok' then return jsonb_build_object('error', r); end if;
  if not exists (select 1 from public.members m where m.id = join_family.member_id and m.active) then
    return jsonb_build_object('error', 'no_member');
  end if;
  insert into public.devices(user_id, member_id) values (auth.uid(), join_family.member_id)
  on conflict (user_id) do update set member_id = excluded.member_id;
  return jsonb_build_object('ok', true, 'member_id', join_family.member_id);
end $$;

-- "החלף משתמש" למכשיר שכבר מחובר
create or replace function public.switch_member(member_id text) returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_family() then return jsonb_build_object('error', 'not_family'); end if;
  if not exists (select 1 from public.members m where m.id = switch_member.member_id and m.active) then
    return jsonb_build_object('error', 'no_member');
  end if;
  update public.devices set member_id = switch_member.member_id where user_id = auth.uid();
  return jsonb_build_object('ok', true);
end $$;

-- תמונת פרופיל: לעצמי, לילד שמשויך אליי, או כל אחד למנהל
create or replace function public.set_avatar(member_id text, path text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not (member_id = public.my_member_id() or public.is_admin()
          or exists (select 1 from public.members m where m.id = set_avatar.member_id and m.guardian_id = public.my_member_id())) then
    raise exception 'not allowed';
  end if;
  update public.members set avatar_path = path where id = set_avatar.member_id;
end $$;

create or replace function public.admin_set_pin(new_pin text) returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then return jsonb_build_object('error', 'not_admin'); end if;
  if new_pin !~ '^\d{4}$' then return jsonb_build_object('error', 'bad_format'); end if;
  perform private.set_pin(new_pin);
  return jsonb_build_object('ok', true);
end $$;

revoke execute on all functions in schema private from public, anon, authenticated;
grant usage on schema private to postgres;

-- ── Storage: תמונות פרופיל (דלי פרטי) ─────────────────────────
insert into storage.buckets (id, name, public) values ('avatars', 'avatars', false) on conflict (id) do nothing;

create policy "family reads avatars" on storage.objects for select
  using (bucket_id = 'avatars' and public.is_family());
create policy "family uploads avatars" on storage.objects for insert
  with check (bucket_id = 'avatars' and public.is_family());

-- ── Realtime: עדכוני ניהול מגיעים לכולם מיד ────────────────────
alter publication supabase_realtime add table public.members, public.households, public.places, public.days, public.activities;
