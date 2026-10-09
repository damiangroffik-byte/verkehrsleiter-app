-- Tests für die Führerscheinkontrolle (RLS und Datenbankfunktionen).
-- Endet IMMER mit einem Fehler, damit alle Testdaten zurückgerollt werden:
--   ERGEBNIS: 8 ok, 0 Fehler

do $$
declare
  vl uuid := gen_random_uuid();
  fa uuid := gen_random_uuid();
  fb uuid := gen_random_uuid();
  firma_a uuid := gen_random_uuid();
  firma_b uuid := gen_random_uuid();
  p1 uuid := gen_random_uuid();
  p2 uuid := gen_random_uuid();
  eintrag jsonb;
  erg jsonb;
  n int;
  ok int := 0;
  fehler text[] := '{}';
begin
  insert into auth.users (id, email, aud, role) values
    (vl, 'vl@test.invalid', 'authenticated', 'authenticated'),
    (fa, 'fa@test.invalid', 'authenticated', 'authenticated'),
    (fb, 'fb@test.invalid', 'authenticated', 'authenticated');

  perform set_config('request.jwt.claims', json_build_object('sub', vl, 'role', 'authenticated', 'email', 'vl@test.invalid')::text, true);
  set local role authenticated;
  insert into public.firmen (id, name) values (firma_a, 'Testfirma A');
  reset role;

  insert into public.firmen (id, name) values (firma_b, 'Testfirma B');
  insert into public.fahrer (firma_id, user_id, vorname, nachname) values (firma_a, fa, 'Test', 'Fahrer');
  insert into public.fahrer (firma_id, user_id, vorname, nachname) values (firma_b, fb, 'Fremd', 'Fahrer');
  insert into public.mitgliedschaften (user_id, firma_id, rolle) values (fa, firma_a, 'fahrer'), (fb, firma_b, 'fahrer');

  insert into storage.objects (bucket_id, name, owner_id) values
    ('fuehrerscheine', firma_a || '/' || p1 || '/vorne-1.jpg', fa::text),
    ('fuehrerscheine', firma_a || '/' || p1 || '/hinten-1.jpg', fa::text),
    ('fuehrerscheine', firma_a || '/' || p2 || '/vorne-1.jpg', fa::text),
    ('fuehrerscheine', firma_a || '/' || p2 || '/hinten-1.jpg', fa::text);

  -- 1. Standard-Prüfabstand ist 6 Monate.
  if exists (select 1 from public.firma_einstellungen where firma_id = firma_a and fuehrerschein_intervall_monate = 6) then
    ok := ok + 1;
  else
    fehler := fehler || '1 Prüfabstand'::text;
  end if;

  eintrag := jsonb_build_object(
    'pruefungId', p1, 'firmaId', firma_a,
    'fotoVorne', firma_a || '/' || p1 || '/vorne-1.jpg',
    'fotoHinten', firma_a || '/' || p1 || '/hinten-1.jpg',
    'klassen', jsonb_build_array('CE', 'B', 'C'), 'gueltigBis', '2030-05-01');

  perform set_config('request.jwt.claims', json_build_object('sub', fa, 'role', 'authenticated')::text, true);
  set local role authenticated;

  -- 2. Ohne Rückseite wird abgelehnt.
  begin
    perform public.fuehrerschein_einreichen(eintrag - 'fotoHinten');
    fehler := fehler || '2 ohne Rückseite angenommen'::text;
  exception when others then
    if sqlerrm like '%Rückseite%' then ok := ok + 1; else fehler := fehler || ('2 ' || sqlerrm); end if;
  end;

  -- 3. Vollständige Einreichung klappt, Klassen sortiert, Mail an Verkehrsleiter.
  begin
    erg := public.fuehrerschein_einreichen(eintrag);
    if erg -> 'verkehrsleiter_emails' = '["vl@test.invalid"]'::jsonb
       and exists (select 1 from public.fuehrerschein_pruefungen where id = p1 and klassen = '{B,C,CE}' and status = 'eingereicht') then
      ok := ok + 1;
    else
      fehler := fehler || ('3 Ergebnis: ' || erg::text);
    end if;
  exception when others then
    fehler := fehler || ('3 ' || sqlerrm);
  end;

  -- 4. Nach dem Einreichen kein Upload mehr in den Ordner (Storage-Regel).
  begin
    insert into storage.objects (bucket_id, name, owner_id) values ('fuehrerscheine', firma_a || '/' || p1 || '/vorne-2.jpg', fa::text);
    fehler := fehler || '4 Upload nach Einreichen erlaubt'::text;
  exception when others then
    ok := ok + 1;
  end;

  -- 5. Fahrer kann nicht selbst bestätigen.
  begin
    perform public.fuehrerschein_pruefen(p1, true, null);
    fehler := fehler || '5 Fahrer bestätigt selbst'::text;
  exception when others then
    ok := ok + 1;
  end;

  -- 6. Neue Einreichung ersetzt die offene.
  perform public.fuehrerschein_einreichen(eintrag || jsonb_build_object(
    'pruefungId', p2,
    'fotoVorne', firma_a || '/' || p2 || '/vorne-1.jpg',
    'fotoHinten', firma_a || '/' || p2 || '/hinten-1.jpg'));
  if (select status from public.fuehrerschein_pruefungen where id = p1) = 'ersetzt' then
    ok := ok + 1;
  else
    fehler := fehler || '6 nicht ersetzt'::text;
  end if;

  -- 7. Fremder Fahrer sieht nichts.
  perform set_config('request.jwt.claims', json_build_object('sub', fb, 'role', 'authenticated')::text, true);
  select count(*) into n from public.fuehrerschein_pruefungen where firma_id = firma_a;
  if n = 0 then ok := ok + 1; else fehler := fehler || ('7 sieht ' || n); end if;

  -- 8. Verkehrsleiter: Ablehnen ohne Grund geht nicht, Bestätigen speichert Name.
  perform set_config('request.jwt.claims', json_build_object('sub', vl, 'role', 'authenticated', 'email', 'vl@test.invalid')::text, true);
  begin
    perform public.fuehrerschein_pruefen(p2, false, ' ');
    fehler := fehler || '8 Ablehnung ohne Grund'::text;
  exception when others then
    perform public.fuehrerschein_pruefen(p2, true, null);
    if exists (select 1 from public.fuehrerschein_pruefungen
               where id = p2 and status = 'bestaetigt' and geprueft_von = vl and geprueft_von_name = 'vl@test.invalid') then
      ok := ok + 1;
    else
      fehler := fehler || '8 Bestätigung fehlt'::text;
    end if;
  end;
  reset role;

  raise exception 'ERGEBNIS: % ok, % Fehler %', ok, cardinality(fehler), array_to_string(fehler, ' | ');
end;
$$;
