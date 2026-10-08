-- Tests für Abfahrtskontrolle (RLS und Datenbankfunktionen).
-- Läuft komplett in einem DO-Block und endet IMMER mit einem Fehler,
-- damit alle Testdaten zurückgerollt werden. Ergebnis steht in der Meldung:
--   ERGEBNIS: 12 ok, 0 Fehler
-- Ausführen im SQL-Editor oder per Supabase-Konnektor (als postgres).

do $$
declare
  vl uuid := gen_random_uuid();          -- Verkehrsleiter
  un uuid := gen_random_uuid();          -- Unternehmer
  fa uuid := gen_random_uuid();          -- Fahrer Firma A
  fb uuid := gen_random_uuid();          -- Fahrer Firma B
  firma_a uuid := gen_random_uuid();
  firma_b uuid := gen_random_uuid();
  fahrer_a uuid;
  lkw uuid;
  anh uuid;
  k1 uuid := gen_random_uuid();
  k2 uuid := gen_random_uuid();
  antworten jsonb;
  erg jsonb;
  n int;
  ok int := 0;
  fehler text[] := '{}';
begin
  insert into auth.users (id, email, aud, role) values
    (vl, 'vl@test.invalid', 'authenticated', 'authenticated'),
    (un, 'un@test.invalid', 'authenticated', 'authenticated'),
    (fa, 'fa@test.invalid', 'authenticated', 'authenticated'),
    (fb, 'fb@test.invalid', 'authenticated', 'authenticated');

  -- Firma A legt der Verkehrsleiter an (Trigger: Mitgliedschaft + Standard).
  perform set_config('request.jwt.claims', json_build_object('sub', vl, 'role', 'authenticated')::text, true);
  set local role authenticated;
  insert into public.firmen (id, name) values (firma_a, 'Testfirma A');
  reset role;

  -- 1. Neue Firma hat Einstellungen, Fahrzeugart „Standard“ und 29 Prüfpunkte.
  select count(*) into n from public.pruefpunkte p
    join public.fahrzeugarten a on a.id = p.fahrzeugart_id
   where p.firma_id = firma_a and a.name = 'Standard';
  if n = 29 and exists (select 1 from public.firma_einstellungen where firma_id = firma_a and kontrolle_bis = '09:00') then
    ok := ok + 1;
  else
    fehler := fehler || ('1 Standard-Checkliste: ' || n);
  end if;

  insert into public.firmen (id, name) values (firma_b, 'Testfirma B');
  insert into public.mitgliedschaften (user_id, firma_id, rolle) values (un, firma_a, 'unternehmer');
  insert into public.fahrer (firma_id, user_id, vorname, nachname) values (firma_a, fa, 'Test', 'Fahrer') returning id into fahrer_a;
  insert into public.fahrer (firma_id, user_id, vorname, nachname) values (firma_b, fb, 'Fremd', 'Fahrer');
  insert into public.mitgliedschaften (user_id, firma_id, rolle) values (fa, firma_a, 'fahrer'), (fb, firma_b, 'fahrer');
  insert into public.fahrzeuge (firma_id, kennzeichen, hu_faellig) values (firma_a, 'TEST-1', '2027-01-01') returning id into lkw;
  insert into public.fahrzeuge (firma_id, kennzeichen, ist_anhaenger) values (firma_a, 'TEST-A1', true) returning id into anh;

  -- Unterschrift liegt in Storage (wie nach dem Upload aus dem Browser).
  insert into storage.objects (bucket_id, name, owner_id) values
    ('kontrollen', firma_a || '/' || k1 || '/unterschrift.png', fa::text),
    ('kontrollen', firma_a || '/' || k1 || '/antwort-1-1.jpg', fa::text),
    ('kontrollen', firma_a || '/' || k2 || '/unterschrift.png', fa::text);

  -- Alle sichtbaren Punkte ohne Mangel beantworten (ohne ADR, mit Anhänger).
  select jsonb_agg(jsonb_build_object(
           'pruefpunktId', id,
           'antwortJa', not mangel_bei_ja,
           'bemerkung', null,
           'fotoPfade', case when monatliche_fotos then jsonb_build_array(firma_a || '/' || k1 || '/antwort-1-1.jpg') else '[]'::jsonb end))
    into antworten
    from public.pruefpunkte where firma_id = firma_a and bedingung in ('immer', 'anhaenger');

  perform set_config('request.jwt.claims', json_build_object('sub', fa, 'role', 'authenticated')::text, true);
  set local role authenticated;

  -- 2. Unvollständige Kontrolle wird abgelehnt.
  begin
    perform public.kontrolle_einreichen(jsonb_build_object(
      'kontrolleId', k1, 'firmaId', firma_a, 'fahrzeugId', lkw, 'anhaengerId', anh,
      'durchgefuehrtAm', now(), 'unterschriftPfad', firma_a || '/' || k1 || '/unterschrift.png',
      'antworten', antworten - 0));
    fehler := fehler || '2 unvollständig angenommen'::text;
  exception when raise_exception then
    ok := ok + 1;
  end;

  -- 3. Mangel ohne Foto wird abgelehnt.
  begin
    perform public.kontrolle_einreichen(jsonb_build_object(
      'kontrolleId', k1, 'firmaId', firma_a, 'fahrzeugId', lkw, 'anhaengerId', anh,
      'durchgefuehrtAm', now(), 'unterschriftPfad', firma_a || '/' || k1 || '/unterschrift.png',
      'antworten', (select jsonb_agg(case when (e ->> 'antwortJa')::boolean and e ->> 'pruefpunktId' = (
                      select id::text from public.pruefpunkte where firma_id = firma_a and frage = 'Bremsen in Ordnung?')
                    then e || '{"antwortJa": false, "bemerkung": "Bremse quietscht"}' else e end)
                    from jsonb_array_elements(antworten) x(e))));
    fehler := fehler || '3 Mangel ohne Foto angenommen'::text;
  exception when raise_exception then
    ok := ok + 1;
  end;

  -- 4. Vollständige Kontrolle wird angenommen.
  begin
    erg := public.kontrolle_einreichen(jsonb_build_object(
      'kontrolleId', k1, 'firmaId', firma_a, 'fahrzeugId', lkw, 'anhaengerId', anh,
      'durchgefuehrtAm', now(), 'unterschriftPfad', firma_a || '/' || k1 || '/unterschrift.png',
      'antworten', antworten));
    if (erg ->> 'kontrolle_id')::uuid = k1 and jsonb_array_length(erg -> 'maengel') = 0 then
      ok := ok + 1;
    else
      fehler := fehler || ('4 Ergebnis: ' || erg::text);
    end if;
  exception when others then
    fehler := fehler || ('4 abgelehnt: ' || sqlerrm);
  end;

  -- 5. Kontrolle ist nicht änderbar (kein Update erlaubt, 0 Zeilen).
  update public.kontrollen set hat_mangel = true where id = k1;
  get diagnostics n = row_count;
  if n = 0 then ok := ok + 1; else fehler := fehler || '5 Kontrolle geändert'::text; end if;

  -- 6. Mangel mit Foto und Beschreibung: Mangel entsteht, Mail-Empfänger = Verkehrsleiter.
  begin
    erg := public.kontrolle_einreichen(jsonb_build_object(
      'kontrolleId', k2, 'firmaId', firma_a, 'fahrzeugId', lkw, 'anhaengerId', null,
      'durchgefuehrtAm', now(), 'unterschriftPfad', firma_a || '/' || k2 || '/unterschrift.png',
      'antworten', (select jsonb_agg(jsonb_build_object(
                      'pruefpunktId', id,
                      'antwortJa', case when frage = 'Weitere Auffälligkeiten?' then true else not mangel_bei_ja end,
                      'bemerkung', case when frage = 'Weitere Auffälligkeiten?' then 'Spiegel lose' end,
                      'fotoPfade', case when frage = 'Weitere Auffälligkeiten?' then jsonb_build_array(firma_a || '/' || k1 || '/antwort-1-1.jpg') else '[]'::jsonb end))
                    from public.pruefpunkte where firma_id = firma_a and bedingung = 'immer')));
    fehler := fehler || ('6 Foto aus fremdem Ordner angenommen: ' || erg::text);
  exception when raise_exception then
    ok := ok + 1;  -- Foto muss im Ordner der eigenen Kontrolle liegen
  end;
  reset role;
  insert into storage.objects (bucket_id, name, owner_id) values ('kontrollen', firma_a || '/' || k2 || '/antwort-20-1.jpg', fa::text);
  set local role authenticated;
  begin
    erg := public.kontrolle_einreichen(jsonb_build_object(
      'kontrolleId', k2, 'firmaId', firma_a, 'fahrzeugId', lkw, 'anhaengerId', null,
      'durchgefuehrtAm', now(), 'unterschriftPfad', firma_a || '/' || k2 || '/unterschrift.png',
      'antworten', (select jsonb_agg(jsonb_build_object(
                      'pruefpunktId', id,
                      'antwortJa', case when frage = 'Weitere Auffälligkeiten?' then true else not mangel_bei_ja end,
                      'bemerkung', case when frage = 'Weitere Auffälligkeiten?' then 'Spiegel lose' end,
                      'fotoPfade', case when frage = 'Weitere Auffälligkeiten?' then jsonb_build_array(firma_a || '/' || k2 || '/antwort-20-1.jpg') else '[]'::jsonb end))
                    from public.pruefpunkte where firma_id = firma_a and bedingung = 'immer')));
    if jsonb_array_length(erg -> 'maengel') = 1 and erg -> 'verkehrsleiter_emails' = '["vl@test.invalid"]'::jsonb then
      ok := ok + 1;
    else
      fehler := fehler || ('7 Mangel-Ergebnis: ' || erg::text);
    end if;
  exception when others then
    fehler := fehler || ('7 abgelehnt: ' || sqlerrm);
  end;

  -- 8. Fahrer sieht eigene Kontrollen (2), aber keine Einstellungen.
  select count(*) into n from public.kontrollen;
  if n = 2 and not exists (select 1 from public.firma_einstellungen) then
    ok := ok + 1;
  else
    fehler := fehler || ('8 Fahrer sieht Kontrollen: ' || n);
  end if;

  -- 9. Fahrer darf Mangel nicht schließen.
  begin
    perform public.mangel_schliessen((select id from public.maengel limit 1), 'repariert');
    fehler := fehler || '9 Fahrer schließt Mangel'::text;
  exception when raise_exception then
    ok := ok + 1;
  end;

  -- 10. Fahrer fremder Firma sieht nichts und darf nicht in Firma A hochladen.
  perform set_config('request.jwt.claims', json_build_object('sub', fb, 'role', 'authenticated')::text, true);
  select count(*) into n from public.kontrollen;
  begin
    insert into storage.objects (bucket_id, name) values ('kontrollen', firma_a || '/' || gen_random_uuid() || '/unterschrift.png');
    fehler := fehler || '10 fremder Upload erlaubt'::text;
  exception when insufficient_privilege then
    if n = 0 and not exists (select 1 from storage.objects where bucket_id = 'kontrollen') then
      ok := ok + 1;
    else
      fehler := fehler || ('10 fremder Fahrer sieht Kontrollen: ' || n);
    end if;
  end;

  -- 11. Unternehmer darf Prüfpunkte nicht ändern, aber Mangel schließen.
  perform set_config('request.jwt.claims', json_build_object('sub', un, 'role', 'authenticated')::text, true);
  update public.pruefpunkte set frage = 'geändert' where firma_id = firma_a;
  get diagnostics n = row_count;
  begin
    perform public.mangel_schliessen((select id from public.maengel where firma_id = firma_a limit 1), 'Spiegel festgeschraubt');
    if n = 0 and exists (select 1 from public.maengel where firma_id = firma_a and status = 'behoben' and behoben_von = un) then
      ok := ok + 1;
    else
      fehler := fehler || ('11 Unternehmer änderte Prüfpunkte: ' || n);
    end if;
  exception when others then
    fehler := fehler || ('11 Mangel schließen: ' || sqlerrm);
  end;

  -- 12. Verkehrsleiter darf Prüfpunkte ändern; alte Antworten behalten den Fragetext.
  perform set_config('request.jwt.claims', json_build_object('sub', vl, 'role', 'authenticated')::text, true);
  update public.pruefpunkte set frage = 'Bremsen geprüft?' where firma_id = firma_a and frage = 'Bremsen in Ordnung?';
  get diagnostics n = row_count;
  if n = 1 and exists (select 1 from public.antworten where kontrolle_id = k1 and frage = 'Bremsen in Ordnung?') then
    ok := ok + 1;
  else
    fehler := fehler || ('12 Verkehrsleiter ändert Prüfpunkt: ' || n);
  end if;
  reset role;

  raise exception 'ERGEBNIS: % ok, % Fehler %', ok, cardinality(fehler), array_to_string(fehler, ' | ');
end;
$$;
