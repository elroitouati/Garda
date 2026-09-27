-- טואטי בגארדה — הודעות משפחתיות ואלבום תמונות

-- ── הודעות ─────────────────────────────────────────────────
create table public.messages (
  id uuid primary key default gen_random_uuid(),
  sender_id text not null references public.members(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 500),
  important boolean not null default false,
  audience text not null default 'all' check (audience in ('all', 'household', 'custom')),
  household_id text references public.households(id) on delete cascade,
  recipients text[],                      -- כש-audience = 'custom'
  lat double precision,
  lng double precision,
  reminded_at timestamptz,                -- "שלח תזכורת" מקפיץ מחדש למי שלא ראה
  created_at timestamptz not null default now()
);
create index on public.messages(created_at desc);

create table public.message_reads (
  message_id uuid not null references public.messages(id) on delete cascade,
  member_id text not null references public.members(id) on delete cascade,
  read_at timestamptz not null default now(),
  primary key (message_id, member_id)
);

create or replace function public.can_see_message(m public.messages) returns boolean
language sql stable security definer set search_path = public as $$
  select public.is_family() and (
    m.audience = 'all'
    or m.sender_id = public.my_member_id()
    or (m.audience = 'household' and m.household_id = public.my_household_id())
    or (m.audience = 'custom' and public.my_member_id() = any(m.recipients))
  )
$$;

alter table public.messages enable row level security;
alter table public.message_reads enable row level security;

create policy "audience reads" on public.messages for select using (public.can_see_message(messages));
create policy "send as me" on public.messages for insert with check (sender_id = public.my_member_id());
create policy "delete mine" on public.messages for delete using (sender_id = public.my_member_id());

create policy "family reads" on public.message_reads for select using (public.is_family());
create policy "mark my read" on public.message_reads for insert with check (member_id = public.my_member_id());

create or replace function public.remind_message(message_id uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  update public.messages set reminded_at = now()
  where id = remind_message.message_id and sender_id = public.my_member_id();
end $$;

-- ── תמונות ─────────────────────────────────────────────────
create table public.photos (
  id uuid primary key default gen_random_uuid(),
  member_id text not null references public.members(id) on delete cascade,
  path text not null,
  thumb_path text not null,
  lat double precision not null,
  lng double precision not null,
  loc_source text not null default 'device' check (loc_source in ('device', 'exif', 'schedule', 'manual')),
  taken_at timestamptz not null default now(),
  width int,
  height int,
  created_at timestamptz not null default now()
);
create index on public.photos(taken_at desc);

alter table public.photos enable row level security;
create policy "family reads" on public.photos for select using (public.is_family());
create policy "upload as me" on public.photos for insert with check (member_id = public.my_member_id());
create policy "move mine" on public.photos for update using (member_id = public.my_member_id() or public.is_admin())
  with check (member_id = public.my_member_id() or public.is_admin());
create policy "delete mine" on public.photos for delete using (member_id = public.my_member_id() or public.is_admin());

insert into storage.buckets (id, name, public) values ('photos', 'photos', false) on conflict (id) do nothing;
create policy "family reads photos" on storage.objects for select
  using (bucket_id = 'photos' and public.is_family());
create policy "family uploads photos" on storage.objects for insert
  with check (bucket_id = 'photos' and public.is_family() and (storage.foldername(name))[1] = public.my_member_id());
create policy "delete own photo files" on storage.objects for delete
  using (bucket_id = 'photos' and ((storage.foldername(name))[1] = public.my_member_id() or public.is_admin()));

alter publication supabase_realtime add table public.messages, public.message_reads, public.photos;

-- "ראיתי" אחרי תזכורת מעדכן את זמן הקריאה
create policy "update my read" on public.message_reads for update using (member_id = public.my_member_id()) with check (member_id = public.my_member_id());
