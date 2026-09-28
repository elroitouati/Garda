-- חלוקה לארבע משפחות (כפי שאלרואי סימן)
insert into public.households (id, name, sort) values
  ('tuati', 'יתיר ושרון', 0),
  ('efi', 'אפי ויפית', 1),
  ('eyal', 'אייל ויערה', 2),
  ('gil', 'גיל, אווה וליאל', 3)
on conflict (id) do update set name = excluded.name, sort = excluded.sort;

-- השיוך, וסדר שמשאיר כל משפחה יחד בכל הרשימות
update public.members m set household_id = v.hh, sort = v.sort
from (values
  ('yatir', 'tuati', 1), ('sharon', 'tuati', 2), ('shiilo', 'tuati', 3), ('elroi', 'tuati', 4), ('etel', 'tuati', 5), ('shanel', 'tuati', 6),
  ('efi', 'efi', 7), ('yafit', 'efi', 8), ('lia', 'efi', 9),
  ('eyal', 'eyal', 10), ('yaara', 'eyal', 11),
  ('gil', 'gil', 12), ('eva', 'gil', 13), ('liel', 'gil', 14)
) as v(id, hh, sort)
where m.id = v.id;

-- טיסות, רכב ומלון משותפים לכולם: household_id ריק = לכל המשפחות
alter table public.essentials alter column household_id drop not null;
update public.essentials set household_id = null where household_id = 'tuati';
drop policy if exists "own household" on public.essentials;
create policy "own household" on public.essentials for select
  using (public.is_family() and (household_id is null or household_id = public.my_household_id() or public.is_admin()));
drop policy if exists "own household writes" on public.essentials;
create policy "own household writes" on public.essentials for all
  using (public.is_admin()) with check (public.is_admin());

-- טלפוני ההורים של כל משפחה לכרטיס החירום. כל הורה יתבקש למלא את המספר שלו בכניסה.
insert into public.emergency_contacts (household_id, name, name_latin, phone, sort, member_id)
select v.hh, v.name, v.latin, '', v.sort, v.id
from (values
  ('efi', 'אפי', 'Efi', 1, 'efi'), ('efi', 'יפית', 'Yafit', 2, 'yafit'),
  ('eyal', 'אייל', 'Eyal', 1, 'eyal'), ('eyal', 'יערה', 'Yaara', 2, 'yaara'),
  ('gil', 'גיל', 'Gil', 1, 'gil'), ('gil', 'אווה', 'Eva', 2, 'eva')
) as v(hh, name, latin, sort, id)
where not exists (select 1 from public.emergency_contacts c where c.member_id = v.id);

-- מסך "מי אתה?" מקבל גם את המשפחה, כדי להציג את הרשימה בקבוצות
create or replace function public.check_pin(pin text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare r text;
begin
  r := private.pin_ok(pin);
  if r <> 'ok' then return jsonb_build_object('error', r); end if;
  return jsonb_build_object('members', coalesce((
    select jsonb_agg(jsonb_build_object('id', m.id, 'name', m.name, 'color', m.color, 'initials', m.initials,
      'household', h.name) order by h.sort, m.sort)
    from public.members m left join public.households h on h.id = m.household_id
    where m.active and m.guardian_id is null), '[]'::jsonb));
end $$;
