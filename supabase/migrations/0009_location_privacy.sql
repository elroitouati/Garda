-- פרטיות מיקום: כשמישהו לא משתף, לא נשמר עליו שום מיקום — גם לא "המיקום האחרון"
create or replace function private.locations_privacy() returns trigger
language plpgsql as $$
begin
  if not new.sharing then
    new.lat := null; new.lng := null; new.accuracy := null; new.heading := null;
  end if;
  return new;
end $$;
drop trigger if exists locations_privacy on public.locations;
create trigger locations_privacy before insert or update on public.locations
  for each row execute function private.locations_privacy();

-- ניקוי מה שכבר נשמר אצל מי שהשהה
update public.locations set lat = null, lng = null, accuracy = null, heading = null where not sharing;
