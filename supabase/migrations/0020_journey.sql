-- חומרים ל"המסע" (החוויה של סוף הטיול): מנהלים בלבד.
-- מפתחות: general · person:<member> · day:<date> · stats
create table if not exists public.journey (
  key text primary key,
  data jsonb not null default '{}',
  updated_by text references public.members(id) on delete set null,
  updated_at timestamptz not null default now()
);
alter table public.journey enable row level security;
create policy "admins read" on public.journey for select using (public.is_admin());
create policy "admins write" on public.journey for all using (public.is_admin()) with check (public.is_admin());
