-- שנאל נוספה לטיול
insert into public.members (id, name, color, household_id, is_admin, sort)
values ('shanel', 'שנאל', '#9C3D3D', 'tuati', false, 14)
on conflict (id) do nothing;
