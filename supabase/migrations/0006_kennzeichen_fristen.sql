-- Kennzeichen einheitlich (KN-BC333), Fahrer wählt Fahrzeug aus der Liste oder tippt es selbst ein
-- und trägt bei jeder Abfahrtskontrolle die Prüftermine (HU, SP, Tacho) ein.

create function public.kennzeichen_normal(t text)
returns text language sql immutable set search_path = '' as $$
  select nullif(btrim(regexp_replace(regexp_replace(
    case when s like '%-%' then s else regexp_replace(s, ' ', '-') end,
    '\s', '', 'g'), '-+', '-', 'g'), '-'), '')
  from (select regexp_replace(btrim(upper(t)), '\s+', ' ', 'g') as s) x;
$$;

create function public.kennzeichen_gueltig(t text)
returns boolean language sql immutable set search_path = '' as $$
  select coalesce(t ~ '^[A-ZÄÖÜ]{1,3}-[A-Z]{1,2}[0-9]{1,4}[EH]?$', false);
$$;

-- Prüftermin aus der Eingabe des Fahrers: Pflicht, als Datum lesbar und plausibel.
create function public.pruefdatum(wert text, name text)
returns date language plpgsql stable set search_path = '' as $$
declare
  d date;
begin
  begin
    d := nullif(btrim(wert), '')::date;
  exception when others then
    d := null;
  end;
  if d is null or d < date '2000-01-01' or d > date '2100-01-01' then
    raise exception 'Bitte trage den Termin für % ein.', name using hint = 'fristen';
  end if;
  return d;
end;
$$;

create function public.fahrzeug_kennzeichen_trigger()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.kennzeichen := public.kennzeichen_normal(new.kennzeichen);
  return new;
end;
$$;

create trigger kennzeichen_einheitlich
  before insert or update of kennzeichen on public.fahrzeuge
  for each row execute function public.fahrzeug_kennzeichen_trigger();

-- Bestehende Kennzeichen ins einheitliche Format bringen.
update public.fahrzeuge set kennzeichen = kennzeichen where kennzeichen is distinct from public.kennzeichen_normal(kennzeichen);

create or replace function public.kontrolle_einreichen(p jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  k_id uuid := (p ->> 'kontrolleId')::uuid;
  f_id uuid := (p ->> 'firmaId')::uuid;
  fz_id uuid := nullif(p ->> 'fahrzeugId', '')::uuid;
  anh_id uuid := nullif(p ->> 'anhaengerId', '')::uuid;
  fz_kz text := public.kennzeichen_normal(p ->> 'kennzeichen');
  anh_kz text := public.kennzeichen_normal(p ->> 'anhaengerKennzeichen');
  fr jsonb := coalesce(p -> 'fristen', '{}');
  hu date;
  sp date;
  tacho date;
  anh_hu date;
  anh_sp date;
  zeitpunkt timestamptz := (p ->> 'durchgefuehrtAm')::timestamptz;
  unterschrift text := p ->> 'unterschriftPfad';
  ordner text := f_id::text || '/' || k_id::text || '/';
  ich uuid;
  fz public.fahrzeuge;
  anh public.fahrzeuge;
  art uuid;
  tz text;
  reifen_faellig boolean;
  pp record;
  a jsonb;
  fotos text[];
  bem text;
  mangel boolean;
  antwort uuid;
  eintrag jsonb;
  maengel_liste jsonb := '[]';
  fahrername text;
begin
  if k_id is null or f_id is null or (fz_id is null and fz_kz is null) or zeitpunkt is null then
    raise exception 'Die Kontrolle ist unvollständig.' using hint = 'entwurf';
  end if;

  ich := public.eigener_fahrer(f_id);
  if ich is null then
    raise exception 'Du bist in dieser Firma nicht als aktiver Fahrer eingetragen.' using hint = 'fahrer';
  end if;

  -- Erneutes Senden (z. B. nach Netzabbruch) liefert das frühere Ergebnis.
  if exists (select 1 from public.kontrollen where id = k_id) then
    if exists (select 1 from public.kontrollen where id = k_id and fahrer_id = ich) then
      return jsonb_build_object('kontrolle_id', k_id, 'bereits_eingereicht', true, 'maengel', '[]'::jsonb, 'verkehrsleiter_emails', '[]'::jsonb);
    end if;
    raise exception 'Diese Kontrolle gibt es schon.' using hint = 'entwurf';
  end if;

  if zeitpunkt > now() + interval '10 minutes' then
    raise exception 'Der Zeitpunkt der Kontrolle liegt in der Zukunft.' using hint = 'zeitpunkt';
  end if;

  -- Prüftermine trägt der Fahrer bei jeder Kontrolle ein (vorbelegt mit den bekannten Werten).
  hu := public.pruefdatum(fr ->> 'hu', 'HU');
  sp := public.pruefdatum(fr ->> 'sp', 'SP');
  tacho := public.pruefdatum(fr ->> 'tacho', 'Tacho-Prüfung');

  -- Fahrzeug aus der Liste oder selbst eingetipptes Kennzeichen (wird bei Bedarf angelegt).
  if fz_id is not null then
    select * into fz from public.fahrzeuge
    where id = fz_id and firma_id = f_id and not ist_anhaenger and aktiv;
  else
    if not public.kennzeichen_gueltig(fz_kz) then
      raise exception 'Bitte gib das Kennzeichen so ein: KN-BC333.' using hint = 'fahrzeug';
    end if;
    select * into fz from public.fahrzeuge where firma_id = f_id and kennzeichen = fz_kz;
    if fz.id is null then
      insert into public.fahrzeuge (firma_id, kennzeichen) values (f_id, fz_kz) returning * into fz;
    elsif fz.ist_anhaenger then
      raise exception 'Das Kennzeichen % ist als Anhänger eingetragen.', fz_kz using hint = 'fahrzeug';
    elsif not fz.aktiv then
      update public.fahrzeuge set aktiv = true where id = fz.id returning * into fz;
    end if;
  end if;
  if fz.id is null then
    raise exception 'Bitte wähle ein Fahrzeug deiner Firma.' using hint = 'fahrzeug';
  end if;
  update public.fahrzeuge set hu_faellig = hu, sp_faellig = sp, tacho_faellig = tacho
   where id = fz.id returning * into fz;

  if anh_id is not null or anh_kz is not null then
    anh_hu := public.pruefdatum(fr ->> 'anhaengerHu', 'HU des Anhängers');
    anh_sp := public.pruefdatum(fr ->> 'anhaengerSp', 'SP des Anhängers');
    if anh_id is not null then
      select * into anh from public.fahrzeuge
      where id = anh_id and firma_id = f_id and ist_anhaenger and aktiv;
    else
      if not public.kennzeichen_gueltig(anh_kz) then
        raise exception 'Bitte gib das Kennzeichen des Anhängers so ein: KN-BC333.' using hint = 'anhaenger';
      end if;
      select * into anh from public.fahrzeuge where firma_id = f_id and kennzeichen = anh_kz;
      if anh.id is null then
        insert into public.fahrzeuge (firma_id, kennzeichen, ist_anhaenger) values (f_id, anh_kz, true) returning * into anh;
      elsif not anh.ist_anhaenger then
        raise exception 'Das Kennzeichen % ist als Fahrzeug eingetragen, nicht als Anhänger.', anh_kz using hint = 'anhaenger';
      elsif not anh.aktiv then
        update public.fahrzeuge set aktiv = true where id = anh.id returning * into anh;
      end if;
    end if;
    if anh.id is null then
      raise exception 'Bitte wähle einen Anhänger deiner Firma.' using hint = 'anhaenger';
    end if;
    update public.fahrzeuge set hu_faellig = anh_hu, sp_faellig = anh_sp
     where id = anh.id returning * into anh;
  end if;

  if unterschrift is distinct from ordner || 'unterschrift.png'
     or not exists (select 1 from storage.objects o where o.bucket_id = 'kontrollen' and o.name = unterschrift) then
    raise exception 'Bitte unterschreibe die Kontrolle.' using hint = 'unterschrift';
  end if;

  art := coalesce(
    fz.fahrzeugart_id,
    (select id from public.fahrzeugarten where firma_id = f_id and name = 'Standard')
  );
  select coalesce(e.zeitzone, 'Europe/Berlin') into tz from public.firma_einstellungen e where e.firma_id = f_id;
  tz := coalesce(tz, 'Europe/Berlin');

  -- Reifenfotos einmal pro Kalendermonat und Fahrzeug.
  reifen_faellig := not exists (
    select 1 from public.kontrollen k
    join public.antworten an on an.kontrolle_id = k.id
    where k.fahrzeug_id = fz.id
      and an.monatliche_fotos and cardinality(an.foto_pfade) > 0
      and date_trunc('month', k.durchgefuehrt_am at time zone tz) = date_trunc('month', zeitpunkt at time zone tz)
  );

  if jsonb_typeof(p -> 'antworten') is distinct from 'array' then
    raise exception 'Die Kontrolle ist unvollständig.' using hint = 'entwurf';
  end if;

  -- Jede Antwort muss zu einem sichtbaren Prüfpunkt gehören, höchstens einmal.
  if exists (
    select 1 from jsonb_array_elements(p -> 'antworten') x(v)
    group by v ->> 'pruefpunktId' having count(*) > 1
  ) then
    raise exception 'Ein Prüfpunkt wurde doppelt beantwortet.' using hint = 'entwurf';
  end if;

  insert into public.kontrollen (id, firma_id, fahrer_id, fahrzeug_id, anhaenger_id, durchgefuehrt_am, unterschrift_pfad, fristen)
  values (
    k_id, f_id, ich, fz.id, anh.id, zeitpunkt, unterschrift,
    jsonb_build_object('hu_faellig', fz.hu_faellig, 'sp_faellig', fz.sp_faellig, 'tacho_faellig', fz.tacho_faellig,
      'anhaenger_hu_faellig', anh.hu_faellig, 'anhaenger_sp_faellig', anh.sp_faellig)
  );

  for pp in
    select * from public.pruefpunkte
    where fahrzeugart_id = art and firma_id = f_id and aktiv
      and (bedingung = 'immer'
        or (bedingung = 'adr' and (fz.adr or coalesce(anh.adr, false)))
        or (bedingung = 'anhaenger' and anh.id is not null))
    order by reihenfolge
  loop
    select v into a from jsonb_array_elements(p -> 'antworten') x(v)
    where v ->> 'pruefpunktId' = pp.id::text;

    if a is null or jsonb_typeof(a -> 'antwortJa') is distinct from 'boolean' then
      raise exception 'Bitte beantworte: %', pp.frage using hint = 'pruefpunkt:' || pp.id;
    end if;

    select coalesce(array_agg(v), '{}') into fotos
    from jsonb_array_elements_text(coalesce(a -> 'fotoPfade', '[]')) t(v);
    bem := nullif(btrim(a ->> 'bemerkung'), '');
    mangel := (a ->> 'antwortJa')::boolean = pp.mangel_bei_ja;

    if exists (
      select 1 from unnest(fotos) t(v)
      where v not like ordner || '%'
         or not exists (select 1 from storage.objects o where o.bucket_id = 'kontrollen' and o.name = v)
    ) then
      raise exception 'Ein Foto zu „%“ wurde nicht hochgeladen.', pp.frage using hint = 'pruefpunkt:' || pp.id;
    end if;

    if mangel and bem is null then
      raise exception 'Bitte beschreibe den Mangel: %', pp.frage using hint = 'pruefpunkt:' || pp.id;
    end if;
    if mangel and cardinality(fotos) = 0 then
      raise exception 'Bitte mache ein Foto vom Mangel: %', pp.frage using hint = 'pruefpunkt:' || pp.id;
    end if;
    if pp.monatliche_fotos and reifen_faellig and cardinality(fotos) = 0 then
      raise exception 'Bitte fotografiere diesen Monat alle Reifen.' using hint = 'pruefpunkt:' || pp.id;
    end if;

    insert into public.antworten (firma_id, kontrolle_id, pruefpunkt_id, abschnitt, frage, mangel_bei_ja, monatliche_fotos, antwort_ja, ist_mangel, bemerkung, foto_pfade, reihenfolge)
    values (f_id, k_id, pp.id, pp.abschnitt, pp.frage, pp.mangel_bei_ja, pp.monatliche_fotos, (a ->> 'antwortJa')::boolean, mangel, bem, fotos, pp.reihenfolge)
    returning id into antwort;

    if mangel then
      insert into public.maengel (firma_id, antwort_id, kontrolle_id, fahrzeug_id)
      values (f_id, antwort, k_id, fz.id)
      returning jsonb_build_object('id', id, 'frage', pp.frage, 'bemerkung', bem, 'foto_pfad', fotos[1])
      into eintrag;
      maengel_liste := maengel_liste || eintrag;
    end if;
  end loop;

  -- Antworten auf Prüfpunkte, die nicht (mehr) sichtbar sind, sind ein Fehler.
  if (select count(*) from public.antworten where kontrolle_id = k_id) <> jsonb_array_length(p -> 'antworten') then
    raise exception 'Die Checkliste hat sich geändert. Bitte lade die Seite neu.' using hint = 'entwurf';
  end if;

  update public.kontrollen set hat_mangel = jsonb_array_length(maengel_liste) > 0 where id = k_id;

  update public.kontrolle_fehlt
     set erledigt_durch = k_id
   where fahrer_id = ich and erledigt_durch is null
     and datum = (zeitpunkt at time zone tz)::date;

  select vorname || ' ' || nachname into fahrername from public.fahrer where id = ich;

  return jsonb_build_object(
    'kontrolle_id', k_id,
    'kennzeichen', fz.kennzeichen,
    'fahrer', fahrername,
    'maengel', maengel_liste,
    'verkehrsleiter_emails', case when jsonb_array_length(maengel_liste) = 0 then '[]'::jsonb else (
      select coalesce(jsonb_agg(distinct u.email), '[]')
      from public.mitgliedschaften m join auth.users u on u.id = m.user_id
      where m.firma_id = f_id and m.rolle = 'verkehrsleiter' and u.email is not null
    ) end
  );
end;
$$;
