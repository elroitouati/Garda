-- אלבום: לבבות, תגובות, והתראה מרוכזת על תמונות חדשות

create table public.photo_likes (
  photo_id uuid not null references public.photos(id) on delete cascade,
  member_id text not null references public.members(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (photo_id, member_id)
);
alter table public.photo_likes enable row level security;
create policy "family reads" on public.photo_likes for select using (public.is_family());
create policy "like as me" on public.photo_likes for insert with check (member_id = public.my_member_id());
create policy "unlike mine" on public.photo_likes for delete using (member_id = public.my_member_id());

create table public.photo_comments (
  id uuid primary key default gen_random_uuid(),
  photo_id uuid not null references public.photos(id) on delete cascade,
  member_id text not null references public.members(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 300),
  created_at timestamptz not null default now()
);
create index on public.photo_comments(photo_id);
alter table public.photo_comments enable row level security;
create policy "family reads" on public.photo_comments for select using (public.is_family());
create policy "comment as me" on public.photo_comments for insert with check (member_id = public.my_member_id());
create policy "delete my comment" on public.photo_comments for delete using (member_id = public.my_member_id() or public.is_admin());

-- התראה מרוכזת: כל 5 דקות, "12 תמונות חדשות מ..." (לא התראה לכל תמונה)
alter table public.photos add column if not exists notified boolean not null default false;
update public.photos set notified = true;  -- מה שכבר עלה לא יקפיץ התראה
do $$ begin
  perform cron.schedule('garda-photo-digest', '*/5 * * * *', $cron$select private.notify_push('photos', gen_random_uuid())$cron$);
exception when others then raise notice 'pg_cron unavailable: %', sqlerrm;
end $$;

alter publication supabase_realtime add table public.photo_likes, public.photo_comments;
