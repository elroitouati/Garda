-- תמונה בהודעה (נשמרת באחסון של התמונות, לא נכנסת לאלבום)
alter table public.messages add column if not exists photo_path text;
