-- סקרים, תגובות אימוג'י, לייק ותשובה לתגובות, וסיכום יומי

-- ── סקרים ─────────────────────────────────────────────────────
create table if not exists public.polls (
  id uuid primary key default gen_random_uuid(),
  created_by text not null references public.members(id) on delete cascade,
  question text not null check (char_length(question) between 1 and 120),
  options text[] not null check (array_length(options, 1) between 2 and 6),
  closed boolean not null default false,
  created_at timestamptz not null default now()
);
alter table public.polls enable row level security;
create policy "family reads" on public.polls for select using (public.is_family());
create policy "poll as me" on public.polls for insert with check (created_by = public.my_member_id());
create policy "close my poll" on public.polls for update using (created_by = public.my_member_id() or public.is_admin());
create policy "delete my poll" on public.polls for delete using (created_by = public.my_member_id() or public.is_admin());

create table if not exists public.poll_votes (
  poll_id uuid not null references public.polls(id) on delete cascade,
  member_id text not null references public.members(id) on delete cascade,
  option int not null,
  created_at timestamptz not null default now(),
  primary key (poll_id, member_id)
);
alter table public.poll_votes enable row level security;
create policy "family reads" on public.poll_votes for select using (public.is_family());
create policy "vote as me" on public.poll_votes for insert with check (member_id = public.my_member_id());
create policy "change my vote" on public.poll_votes for update using (member_id = public.my_member_id());
create policy "remove my vote" on public.poll_votes for delete using (member_id = public.my_member_id());

create or replace function private.on_poll() returns trigger
language plpgsql security definer set search_path = public, private as $$
begin
  perform private.notify_push('poll', new.id);
  return new;
end $$;
drop trigger if exists polls_push on public.polls;
create trigger polls_push after insert on public.polls for each row execute function private.on_poll();

-- ── תגובות אימוג'י: הלב הוא אחת האפשרויות ──────────────────
alter table public.photo_likes add column if not exists emoji text not null default '❤️'
  check (emoji in ('❤️', '😂', '😍', '🔥', '😮', '👏'));
drop policy if exists "change my reaction" on public.photo_likes;
create policy "change my reaction" on public.photo_likes for update using (member_id = public.my_member_id());

-- ── לייק ותשובה לתגובה ─────────────────────────────────────
alter table public.photo_comments add column if not exists parent_id uuid references public.photo_comments(id) on delete cascade;
create table if not exists public.comment_likes (
  comment_id uuid not null references public.photo_comments(id) on delete cascade,
  member_id text not null references public.members(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (comment_id, member_id)
);
alter table public.comment_likes enable row level security;
create policy "family reads" on public.comment_likes for select using (public.is_family());
create policy "like as me" on public.comment_likes for insert with check (member_id = public.my_member_id());
create policy "unlike mine" on public.comment_likes for delete using (member_id = public.my_member_id());

alter publication supabase_realtime add table public.polls, public.poll_votes, public.comment_likes;

-- ── הסיפור של היום: התראה בכל ערב ב-21:30 שעון איטליה (19:30 UTC) ──
do $$ begin
  perform cron.schedule('garda-daily-story', '30 19 * * *', $cron$select private.notify_push('daily', gen_random_uuid())$cron$);
exception when others then raise notice 'pg_cron unavailable: %', sqlerrm;
end $$;
