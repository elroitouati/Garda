-- כל הורה ממלא בעצמו את הטלפון שלו לכרטיס החירום (בלי צורך בהרשאת מנהל)
alter table public.emergency_contacts add column if not exists member_id text references public.members(id) on delete set null;
update public.emergency_contacts set member_id = 'yatir' where household_id = 'tuati' and name = 'יתיר' and member_id is null;
update public.emergency_contacts set member_id = 'sharon' where household_id = 'tuati' and name = 'שרון' and member_id is null;

create or replace function public.set_my_emergency_phone(phone text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare clean text := regexp_replace(coalesce(phone, ''), '[^0-9+ -]', '', 'g');
begin
  if not public.is_family() then return jsonb_build_object('error', 'not_family'); end if;
  if length(regexp_replace(clean, '[^0-9]', '', 'g')) < 9 then return jsonb_build_object('error', 'bad_phone'); end if;
  update public.emergency_contacts set phone = clean where member_id = public.my_member_id();
  if not found then return jsonb_build_object('error', 'not_contact'); end if;
  return jsonb_build_object('ok', true);
end $$;
