-- יום שלישי 29.9: התוכנית של אייל היא לכולם. Movieland והבריכה יוצאים מהיום.
update public.days set title = 'מפלי ורונה וריבה', subtitle = 'צפון האגם', center_place_id = 'varone' where date = '2026-09-29';
delete from public.activities where day = '2026-09-29' and place_id in ('movieland') ;
delete from public.activities where day = '2026-09-29' and household_id is null and place_id = 'hotel' and start_time = '15:30';
update public.activities set household_id = null, hidden_for = '{}' where day = '2026-09-29' and household_id = 'eyal';
update public.activities set notes = 'כשעה וחצי נסיעה.' where day = '2026-09-29' and title = 'חזרה למוניגה';
-- הערב על האש אחרי החזרה מהצפון
update public.activities set start_time = '20:00', end_time = '22:00', hidden_for = '{}'
where day = '2026-09-29' and title = 'ערב על האש';
