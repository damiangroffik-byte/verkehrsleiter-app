-- Abfahrtskontrolle: Prüfpunkte je Fahrzeugart, Firmen-Einstellungen,
-- unveränderbare Kontrollen mit Antworten, Mängel, fehlende Kontrollen.
-- Details: specs/001-abfahrtskontrolle/data-model.md

-- ---------------------------------------------------------------------------
-- Hilfsfunktionen
-- ---------------------------------------------------------------------------

create function public.ist_verkehrsleiter(f uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.mitgliedschaften m
    where m.firma_id = f and m.user_id = auth.uid() and m.rolle = 'verkehrsleiter'
  );
$$;

-- Fahrer-Datensatz des angemeldeten Nutzers in Firma f (nur aktive Fahrer).
create function public.eigener_fahrer(f uuid)
returns uuid language sql stable security definer set search_path = '' as $$
  select id from public.fahrer
  where firma_id = f and user_id = auth.uid() and aktiv
  limit 1;
$$;

revoke execute on function public.ist_verkehrsleiter(uuid) from public, anon;
revoke execute on function public.eigener_fahrer(uuid) from public, anon;
grant execute on function public.ist_verkehrsleiter(uuid) to authenticated;
grant execute on function public.eigener_fahrer(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Standard-Checkliste (global, nur lesen)
-- ---------------------------------------------------------------------------

create table public.vorlage_pruefpunkte (
  id uuid primary key default gen_random_uuid(),
  abschnitt text not null,
  reihenfolge int not null,
  frage text not null,
  mangel_bei_ja boolean not null,
  bedingung text not null default 'immer' check (bedingung in ('immer', 'adr', 'anhaenger')),
  monatliche_fotos boolean not null default false
);

alter table public.vorlage_pruefpunkte enable row level security;
create policy "Angemeldete sehen die Vorlage" on public.vorlage_pruefpunkte
  for select to authenticated using (true);

-- Reihenfolge: Abschnitt * 100 + Position, damit Abschnitte sortiert bleiben.
insert into public.vorlage_pruefpunkte (abschnitt, reihenfolge, frage, mangel_bei_ja, bedingung, monatliche_fotos) values
  ('Vor der Abfahrt', 101, 'Führerschein gültig und dabei?', false, 'immer', false),
  ('Vor der Abfahrt', 102, 'Fahrerqualifizierungsnachweis (FQN) dabei?', false, 'immer', false),
  ('Vor der Abfahrt', 103, 'Fahrerkarte gesteckt?', false, 'immer', false),
  ('Vor der Abfahrt', 104, 'ADR-Schein dabei?', false, 'adr', false),
  ('Vor der Abfahrt', 105, 'Tachorolle vorhanden?', false, 'immer', false),
  ('Vor der Abfahrt', 106, 'Zulassungsbescheinigung Teil I LKW dabei?', false, 'immer', false),
  ('Vor der Abfahrt', 107, 'Zulassungsbescheinigung Teil I Anhänger dabei?', false, 'anhaenger', false),
  ('Vor der Abfahrt', 108, 'EU-Lizenz dabei?', false, 'immer', false),
  ('Vor der Abfahrt', 109, 'Nachweis Güterschaden-Haftpflichtversicherung dabei?', false, 'immer', false),
  ('Allgemein', 201, 'Nachtrag durchgeführt?', false, 'immer', false),
  ('Allgemein', 202, 'Maut-Achsen eingestellt?', false, 'immer', false),
  ('Allgemein', 203, 'Diesel ausreichend?', false, 'immer', false),
  ('Allgemein', 204, 'AdBlue ausreichend?', false, 'immer', false),
  ('Allgemein', 205, 'Beförderungspapiere vollständig?', false, 'immer', false),
  ('LKW', 301, 'Reifen, Räder, Felgen beschädigt?', true, 'immer', true),
  ('LKW', 302, 'Beleuchtung beschädigt?', true, 'immer', false),
  ('LKW', 303, 'Aufbau oder Führerhaus beschädigt?', true, 'immer', false),
  ('LKW', 304, 'Bremsen in Ordnung?', false, 'immer', false),
  ('LKW', 305, 'Ladungssicherung in Ordnung?', false, 'immer', false),
  ('Sonstiges', 401, 'Weitere Auffälligkeiten?', true, 'immer', false),
  ('Gefahrgut (ADR)', 501, '2 Feuerlöscher à 6 kg vorhanden und Prüfdatum gültig?', false, 'adr', false),
  ('Gefahrgut (ADR)', 502, 'Unterlegkeil vorhanden?', false, 'adr', false),
  ('Gefahrgut (ADR)', 503, 'Zwei selbststehende Warnzeichen vorhanden?', false, 'adr', false),
  ('Gefahrgut (ADR)', 504, 'Augenspülflüssigkeit vorhanden?', false, 'adr', false),
  ('Gefahrgut (ADR)', 505, 'Warnweste je Besatzungsmitglied?', false, 'adr', false),
  ('Gefahrgut (ADR)', 506, 'Leuchte vorhanden?', false, 'adr', false),
  ('Gefahrgut (ADR)', 507, 'Schutzhandschuhe vorhanden?', false, 'adr', false),
  ('Gefahrgut (ADR)', 508, 'Augenschutzbrille vorhanden?', false, 'adr', false),
  ('Gefahrgut (ADR)', 509, 'Schaufel, Kanalabdeckung, Auffangbehälter vorhanden?', false, 'adr', false);

-- ---------------------------------------------------------------------------
-- Prüfpunkte je Fahrzeugart
-- ---------------------------------------------------------------------------

create table public.pruefpunkte (
  id uuid primary key default gen_random_uuid(),
  firma_id uuid not null references public.firmen (id) on delete cascade,
  fahrzeugart_id uuid not null references public.fahrzeugarten (id) on delete cascade,
  abschnitt text not null,
  reihenfolge int not null,
  frage text not null,
  mangel_bei_ja boolean not null,
  bedingung text not null default 'immer' check (bedingung in ('immer', 'adr', 'anhaenger')),
  monatliche_fotos boolean not null default false,
  aktiv boolean not null default true
);

create index on public.pruefpunkte (fahrzeugart_id, abschnitt, reihenfolge);
create index on public.pruefpunkte (firma_id);

alter table public.pruefpunkte enable row level security;
create policy "Mitglieder sehen Prüfpunkte" on public.pruefpunkte
  for select using (public.ist_mitglied(firma_id));
create policy "Verkehrsleiter legen Prüfpunkte an" on public.pruefpunkte
  for insert with check (public.ist_verkehrsleiter(firma_id));
create policy "Verkehrsleiter ändern Prüfpunkte" on public.pruefpunkte
  for update using (public.ist_verkehrsleiter(firma_id)) with check (public.ist_verkehrsleiter(firma_id));

-- Fahrzeugarten pflegt nur der Verkehrsleiter (Unternehmer liest).
alter policy "Verwalter verwalten Fahrzeugarten" on public.fahrzeugarten
  rename to "Verkehrsleiter verwalten Fahrzeugarten";
alter policy "Verkehrsleiter verwalten Fahrzeugarten" on public.fahrzeugarten
  using (public.ist_verkehrsleiter(firma_id)) with check (public.ist_verkehrsleiter(firma_id));

-- ---------------------------------------------------------------------------
-- Firmen-Einstellungen
-- ---------------------------------------------------------------------------

create table public.firma_einstellungen (
  firma_id uuid primary key references public.firmen (id) on delete cascade,
  kontrolle_wochentage smallint[] not null default '{1,2,3,4,5}',
  kontrolle_bis time not null default '09:00',
  zeitzone text not null default 'Europe/Berlin',
  check (kontrolle_wochentage <@ '{1,2,3,4,5,6,7}'::smallint[])
);

alter table public.firma_einstellungen enable row level security;
create policy "Verwalter sehen Einstellungen" on public.firma_einstellungen
  for select using (public.ist_verwalter(firma_id));
create policy "Verkehrsleiter ändern Einstellungen" on public.firma_einstellungen
  for update using (public.ist_verkehrsleiter(firma_id)) with check (public.ist_verkehrsleiter(firma_id));

-- Neue Firma: Einstellungen, Fahrzeugart „Standard“ und Standard-Checkliste.
create function public.firma_standard_anlegen(f uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare
  art uuid;
begin
  insert into public.firma_einstellungen (firma_id) values (f)
  on conflict (firma_id) do nothing;

  insert into public.fahrzeugarten (firma_id, name) values (f, 'Standard')
  on conflict (firma_id, name) do nothing;
  select id into art from public.fahrzeugarten where firma_id = f and name = 'Standard';

  if not exists (select 1 from public.pruefpunkte where fahrzeugart_id = art) then
    insert into public.pruefpunkte (firma_id, fahrzeugart_id, abschnitt, reihenfolge, frage, mangel_bei_ja, bedingung, monatliche_fotos)
    select f, art, v.abschnitt, v.reihenfolge, v.frage, v.mangel_bei_ja, v.bedingung, v.monatliche_fotos
    from public.vorlage_pruefpunkte v;
  end if;
end;
$$;

create function public.firma_standard_trigger()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  perform public.firma_standard_anlegen(new.id);
  return new;
end;
$$;

revoke execute on function public.firma_standard_anlegen(uuid) from public, anon, authenticated;
revoke execute on function public.firma_standard_trigger() from public, anon, authenticated;

create trigger firma_standard
  after insert on public.firmen
  for each row execute function public.firma_standard_trigger();

select public.firma_standard_anlegen(id) from public.firmen;

-- ---------------------------------------------------------------------------
-- Kontrollen, Antworten, Mängel (Einfügen nur über kontrolle_einreichen)
-- ---------------------------------------------------------------------------

create table public.kontrollen (
  id uuid primary key,
  firma_id uuid not null references public.firmen (id) on delete cascade,
  fahrer_id uuid not null references public.fahrer (id),
  fahrzeug_id uuid not null references public.fahrzeuge (id),
  anhaenger_id uuid references public.fahrzeuge (id),
  durchgefuehrt_am timestamptz not null,
  eingegangen_am timestamptz not null default now(),
  unterschrift_pfad text not null,
  fristen jsonb not null default '{}',
  hat_mangel boolean not null default false
);

create index on public.kontrollen (firma_id, durchgefuehrt_am desc);
create index on public.kontrollen (fahrzeug_id, durchgefuehrt_am desc);
create index on public.kontrollen (fahrer_id, durchgefuehrt_am desc);
create index on public.kontrollen (anhaenger_id);

create table public.antworten (
  id uuid primary key default gen_random_uuid(),
  firma_id uuid not null references public.firmen (id) on delete cascade,
  kontrolle_id uuid not null references public.kontrollen (id) on delete cascade,
  pruefpunkt_id uuid references public.pruefpunkte (id) on delete set null,
  abschnitt text not null,
  frage text not null,
  mangel_bei_ja boolean not null,
  monatliche_fotos boolean not null default false,
  antwort_ja boolean not null,
  ist_mangel boolean not null,
  bemerkung text,
  foto_pfade text[] not null default '{}',
  reihenfolge int not null
);

create index on public.antworten (kontrolle_id);
create index on public.antworten (firma_id);
create index on public.antworten (pruefpunkt_id);

create table public.maengel (
  id uuid primary key default gen_random_uuid(),
  firma_id uuid not null references public.firmen (id) on delete cascade,
  antwort_id uuid not null unique references public.antworten (id) on delete cascade,
  kontrolle_id uuid not null references public.kontrollen (id) on delete cascade,
  fahrzeug_id uuid not null references public.fahrzeuge (id),
  status text not null default 'offen' check (status in ('offen', 'behoben')),
  behoben_am timestamptz,
  behoben_von uuid references auth.users (id) on delete set null,
  vermerk text,
  gemailt_am timestamptz,
  check (status = 'offen' or (behoben_am is not null and nullif(btrim(vermerk), '') is not null))
);

create index on public.maengel (firma_id, status);
create index on public.maengel (kontrolle_id);
create index on public.maengel (fahrzeug_id);
create index on public.maengel (behoben_von);

create table public.kontrolle_fehlt (
  id uuid primary key default gen_random_uuid(),
  firma_id uuid not null references public.firmen (id) on delete cascade,
  fahrer_id uuid not null references public.fahrer (id) on delete cascade,
  datum date not null,
  erledigt_durch uuid references public.kontrollen (id) on delete set null,
  gemailt_am timestamptz,
  unique (fahrer_id, datum)
);

create index on public.kontrolle_fehlt (firma_id, datum);
create index on public.kontrolle_fehlt (erledigt_durch);

alter table public.kontrollen enable row level security;
alter table public.antworten enable row level security;
alter table public.maengel enable row level security;
alter table public.kontrolle_fehlt enable row level security;

-- Nur lesen. Keine Insert/Update/Delete-Policies: Nachweis bleibt unverändert.
create policy "Verwalter und eigener Fahrer sehen Kontrollen" on public.kontrollen
  for select using (public.ist_verwalter(firma_id) or fahrer_id = public.eigener_fahrer(firma_id));
create policy "Verwalter und eigener Fahrer sehen Antworten" on public.antworten
  for select using (
    public.ist_verwalter(firma_id)
    or exists (select 1 from public.kontrollen k where k.id = kontrolle_id and k.fahrer_id = public.eigener_fahrer(k.firma_id))
  );
create policy "Verwalter und meldender Fahrer sehen Mängel" on public.maengel
  for select using (
    public.ist_verwalter(firma_id)
    or exists (select 1 from public.kontrollen k where k.id = kontrolle_id and k.fahrer_id = public.eigener_fahrer(k.firma_id))
  );
create policy "Verwalter sehen fehlende Kontrollen" on public.kontrolle_fehlt
  for select using (public.ist_verwalter(firma_id));

-- ---------------------------------------------------------------------------
-- Kontrolle einreichen
-- ---------------------------------------------------------------------------

-- Fehler tragen im HINT das betroffene Feld, damit die App es markieren kann.
create function public.kontrolle_einreichen(p jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  k_id uuid := (p ->> 'kontrolleId')::uuid;
  f_id uuid := (p ->> 'firmaId')::uuid;
  fz_id uuid := (p ->> 'fahrzeugId')::uuid;
  anh_id uuid := nullif(p ->> 'anhaengerId', '')::uuid;
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
  if k_id is null or f_id is null or fz_id is null or zeitpunkt is null then
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

  select * into fz from public.fahrzeuge
  where id = fz_id and firma_id = f_id and not ist_anhaenger and aktiv;
  if fz.id is null then
    raise exception 'Bitte wähle ein Fahrzeug deiner Firma.' using hint = 'fahrzeug';
  end if;

  if anh_id is not null then
    select * into anh from public.fahrzeuge
    where id = anh_id and firma_id = f_id and ist_anhaenger and aktiv;
    if anh.id is null then
      raise exception 'Bitte wähle einen Anhänger deiner Firma.' using hint = 'anhaenger';
    end if;
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
    jsonb_build_object('hu_faellig', fz.hu_faellig, 'sp_faellig', fz.sp_faellig, 'tacho_faellig', fz.tacho_faellig)
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

-- Versand-Nachweis für Mängel-Mails (meldender Fahrer oder Verwalter).
create function public.maengel_gemailt(ids uuid[])
returns void language sql security definer set search_path = '' as $$
  update public.maengel m
     set gemailt_am = now()
   where m.id = any (ids) and m.gemailt_am is null
     and (public.ist_verwalter(m.firma_id)
       or exists (select 1 from public.kontrollen k where k.id = m.kontrolle_id and k.fahrer_id = public.eigener_fahrer(k.firma_id)));
$$;

-- Mangel schließen: nur Verwalter, nur offen → behoben, Vermerk Pflicht.
create function public.mangel_schliessen(mangel_id uuid, vermerk text)
returns void language plpgsql security definer set search_path = '' as $$
declare
  m public.maengel;
begin
  select * into m from public.maengel where id = mangel_id;
  if m.id is null or not public.ist_verwalter(m.firma_id) then
    raise exception 'Mangel nicht gefunden.' using hint = 'mangel';
  end if;
  if m.status <> 'offen' then
    raise exception 'Der Mangel ist schon geschlossen.' using hint = 'mangel';
  end if;
  if nullif(btrim(vermerk), '') is null then
    raise exception 'Bitte schreibe einen Vermerk.' using hint = 'vermerk';
  end if;

  update public.maengel
     set status = 'behoben', behoben_am = now(), behoben_von = auth.uid(), vermerk = btrim(mangel_schliessen.vermerk)
   where id = mangel_id;
end;
$$;

-- Letzte Reifenfotos je Fahrzeug, auch aus Kontrollen anderer Fahrer
-- (Fahrer sehen sonst nur ihre eigenen Kontrollen).
create function public.reifenfotos_zuletzt(f uuid)
returns table (fahrzeug_id uuid, zuletzt timestamptz)
language sql stable security definer set search_path = '' as $$
  select k.fahrzeug_id, max(k.durchgefuehrt_am)
  from public.kontrollen k
  join public.antworten an on an.kontrolle_id = k.id
  where k.firma_id = f and public.ist_mitglied(f)
    and an.monatliche_fotos and cardinality(an.foto_pfade) > 0
  group by k.fahrzeug_id;
$$;

revoke execute on function public.kontrolle_einreichen(jsonb) from public, anon;
revoke execute on function public.maengel_gemailt(uuid[]) from public, anon;
revoke execute on function public.mangel_schliessen(uuid, text) from public, anon;
revoke execute on function public.reifenfotos_zuletzt(uuid) from public, anon;
grant execute on function public.kontrolle_einreichen(jsonb) to authenticated;
grant execute on function public.maengel_gemailt(uuid[]) to authenticated;
grant execute on function public.mangel_schliessen(uuid, text) to authenticated;
grant execute on function public.reifenfotos_zuletzt(uuid) to authenticated;
