-- שישי 2.10: הכל זז בחצי שעה (הכנות לשבת עדיין נגמרות לפני כניסת שבת)
update public.activities set start_time = start_time + interval '30 minutes',
  end_time = case when title = 'הכנות לשבת' then end_time else end_time + interval '30 minutes' end
where day = '2026-10-02';
