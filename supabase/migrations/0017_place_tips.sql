-- טיפים של המשפחה: המלצה שקשורה למקום, קופצת למי שמגיע אליו ומופיעה בכרטיס המקום
create table if not exists public.place_tips (
  id uuid primary key default gen_random_uuid(),
  created_by text not null references public.members(id) on delete cascade,
  place_id text references public.places(id) on delete cascade,
  lat double precision not null,
  lng double precision not null,
  place_name text,
  body text not null check (char_length(body) between 1 and 200),
  created_at timestamptz not null default now()
);
alter table public.place_tips enable row level security;
create policy "family reads" on public.place_tips for select using (public.is_family());
create policy "tip as me" on public.place_tips for insert with check (created_by = public.my_member_id());
create policy "delete my tip" on public.place_tips for delete using (created_by = public.my_member_id() or public.is_admin());
alter publication supabase_realtime add table public.place_tips;
