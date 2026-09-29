-- סרטונים באלבום: אותה טבלה (לבבות, תגובות, מפה ומצגת עובדים כרגיל)
alter table public.photos add column if not exists kind text not null default 'photo' check (kind in ('photo', 'video'));
alter table public.photos add column if not exists duration real;
