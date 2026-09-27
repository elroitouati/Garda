-- יפית (דודה) נוספה לטיול
insert into public.members (id, name, color, household_id, is_admin, sort)
values ('yafit', 'יפית', '#476E7A', 'tuati', false, 13)
on conflict (id) do nothing;
