-- Abfahrtskontrolle nach dem Konzept „Abfahrtkontrolle Konzept“:
-- Kategorien mit „In Ordnung / Mangel“, Pflichtpunkte (BG Verkehr / gesetzlich) gesperrt,
-- Zusatzpunkte je Fahrzeuggruppe schaltbar, eigene Punkte, UVV Ladebordwand und
-- Elektro-Niederhubwagen mit Prüfplakette, Winterpunkte vom 01.11. bis 31.03.,
-- „Darf ich so losfahren?“ bei Mängeln und Abfahrtsfreigabe.

-- ---------------------------------------------------------------------------
-- Prüfpunkte: Pflicht, eigene Punkte, Foto- und Stopp-Regel, neue Bedingungen
-- ---------------------------------------------------------------------------

alter table public.vorlage_pruefpunkte
  add column pflicht boolean not null default false,
  add column aktiv boolean not null default true,
  add column foto_bei_mangel boolean not null default true,
  add column mangel_stoppt boolean not null default false,
  drop constraint vorlage_pruefpunkte_bedingung_check,
  add constraint vorlage_pruefpunkte_bedingung_check
    check (bedingung in ('immer', 'adr', 'anhaenger', 'ladebordwand', 'ameise', 'winter'));

alter table public.pruefpunkte
  add column pflicht boolean not null default false,
  add column eigen boolean not null default false,
  add column foto_bei_mangel boolean not null default true,
  add column mangel_stoppt boolean not null default false,
  drop constraint pruefpunkte_bedingung_check,
  add constraint pruefpunkte_bedingung_check
    check (bedingung in ('immer', 'adr', 'anhaenger', 'ladebordwand', 'ameise', 'winter')),
  add constraint pruefpunkte_frage_check check (char_length(btrim(frage)) between 3 and 200);

-- Pflichtpunkte kann der Verkehrsleiter nicht abschalten oder ändern, eigene Punkte
-- legt er nur als Zusatz an. Datenbankfunktionen (security definer) dürfen alles.
create function public.pruefpunkt_schutz()
returns trigger language plpgsql set search_path = '' as $$
begin
  if current_user <> 'authenticated' then
    return new;
  end if;
  if tg_op = 'INSERT' then
    new.pflicht := false;
    new.eigen := true;
    new.monatliche_fotos := false;
    if new.bedingung not in ('immer', 'anhaenger', 'adr', 'ladebordwand', 'ameise', 'winter') then
      new.bedingung := 'immer';
    end if;
    return new;
  end if;
  if old.pflicht and (not new.aktiv or new.frage is distinct from old.frage or new.mangel_stoppt is distinct from old.mangel_stoppt
      or new.foto_bei_mangel is distinct from old.foto_bei_mangel) then
    raise exception 'Pflichtpunkte (BG Verkehr / gesetzlich) können nicht geändert werden.';
  end if;
  if new.pflicht is distinct from old.pflicht or new.eigen is distinct from old.eigen
     or new.firma_id is distinct from old.firma_id or new.fahrzeugart_id is distinct from old.fahrzeugart_id
     or new.monatliche_fotos is distinct from old.monatliche_fotos or new.mangel_bei_ja is distinct from old.mangel_bei_ja then
    raise exception 'Dieser Prüfpunkt kann so nicht geändert werden.';
  end if;
  return new;
end;
$$;

create trigger pruefpunkt_schutz
  before insert or update on public.pruefpunkte
  for each row execute function public.pruefpunkt_schutz();

create policy "Verkehrsleiter löschen eigene Prüfpunkte" on public.pruefpunkte
  for delete using (public.ist_verkehrsleiter(firma_id) and eigen);

-- ---------------------------------------------------------------------------
-- Alte Checkliste nicht löschen, sondern ausblenden: frühere Antworten verweisen
-- weiter darauf. Danach die neue Standard-Checkliste.
-- Reihenfolge: Kategorie * 100 + Position.
-- Alle Fragen sind positiv formuliert: „In Ordnung“ = Ja, „Mangel“ = Nein.
-- ---------------------------------------------------------------------------

alter table public.vorlage_pruefpunkte add column veraltet boolean not null default false;
alter table public.pruefpunkte add column veraltet boolean not null default false;
update public.vorlage_pruefpunkte set veraltet = true, aktiv = false where pflicht = false and veraltet = false;
alter table public.pruefpunkte disable trigger pruefpunkt_schutz;
update public.pruefpunkte set veraltet = true, aktiv = false where pflicht = false and veraltet = false;
alter table public.pruefpunkte enable trigger pruefpunkt_schutz;

insert into public.vorlage_pruefpunkte (abschnitt, reihenfolge, frage, mangel_bei_ja, bedingung, monatliche_fotos, pflicht, aktiv, foto_bei_mangel, mangel_stoppt) values
  -- Rund um das Fahrzeug
  ('Rund um das Fahrzeug', 101, 'Haben die Reifen genügend Luftdruck und Profil?', false, 'immer', true, true, true, true, false),
  ('Rund um das Fahrzeug', 102, 'Sind die Räder ohne Schäden, sicher befestigt und frei von Fremdkörpern?', false, 'immer', false, true, true, true, false),
  ('Rund um das Fahrzeug', 103, 'Ist die Bremsanlage dicht (keine Luftgeräusche, kein Ölverlust)?', false, 'immer', false, true, true, true, true),
  ('Rund um das Fahrzeug', 104, 'Sind die Scheinwerfer und Leuchten sauber, unbeschädigt und funktionsfähig?', false, 'immer', false, true, true, true, false),
  ('Rund um das Fahrzeug', 105, 'Sind die Kennzeichen, Warntafeln, Warnmarkierungen etc. sauber und einsatzbereit?', false, 'immer', false, true, true, true, false),
  ('Rund um das Fahrzeug', 106, 'Sind Planen, Bordwände, Klappen und Türen geschlossen?', false, 'immer', false, true, true, true, false),
  ('Rund um das Fahrzeug', 107, 'Ist die Kupplung sicher verriegelt und sind alle Leitungen angeschlossen?', false, 'anhaenger', false, true, true, true, true),
  ('Rund um das Fahrzeug', 108, 'Sind Aufbau und Führerhaus ohne Schäden?', false, 'immer', false, false, true, true, false),
  ('Rund um das Fahrzeug', 109, 'Sind die Aufstiege, Haltegriffe und Standflächen unbeschädigt?', false, 'immer', false, false, true, true, false),
  ('Rund um das Fahrzeug', 110, 'Sind die Unterlegkeile intakt und verstaut?', false, 'immer', false, false, true, true, false),
  ('Rund um das Fahrzeug', 111, 'Ist die Federung unbeschädigt (keine Luftgeräusche)?', false, 'immer', false, false, false, true, false),
  ('Rund um das Fahrzeug', 112, 'Ist der Aufbau in Fahrstellung (z. B. Kipper abgesenkt)?', false, 'immer', false, false, false, true, false),
  -- Motorraum
  ('Motorraum', 201, 'Sind Motoröl und Kühlwasser ausreichend?', false, 'immer', false, true, true, false, false),
  ('Motorraum', 202, 'Ist das Fahrzeug frei von Leckagen (Öl, Kraftstoff, Kühlmittel)?', false, 'immer', false, true, true, true, false),
  ('Motorraum', 203, 'Sind Diesel und AdBlue ausreichend?', false, 'immer', false, false, true, false, false),
  ('Motorraum', 204, 'Ist genug Scheibenwaschwasser drin?', false, 'immer', false, false, true, false, false),
  -- Ladung & Sicherung
  ('Ladung & Sicherung', 301, 'Ist die Ladung ausreichend gesichert?', false, 'immer', false, true, true, true, true),
  ('Ladung & Sicherung', 302, 'Werden zulässiges Gesamtgewicht und Achslasten eingehalten?', false, 'immer', false, true, true, false, true),
  ('Ladung & Sicherung', 303, 'Sind genug Zurrmittel an Bord und sind sie unbeschädigt?', false, 'immer', false, true, true, true, false),
  ('Ladung & Sicherung', 304, 'Sind Antirutschmatten und Kantenschutz vorhanden?', false, 'immer', false, false, true, false, false),
  ('Ladung & Sicherung', 305, 'Sind die Beförderungspapiere vollständig?', false, 'immer', false, true, true, false, false),
  ('Ladung & Sicherung', 306, 'Ist der Nachtrag durchgeführt?', false, 'immer', false, false, true, false, false),
  -- Fahrerhaus & Funktionscheck
  ('Fahrerhaus & Funktionscheck', 401, 'Sind die Scheiben sauber und ist die Sicht frei?', false, 'immer', false, true, true, false, false),
  ('Fahrerhaus & Funktionscheck', 402, 'Sind die Spiegel unbeschädigt und richtig eingestellt?', false, 'immer', false, true, true, true, false),
  ('Fahrerhaus & Funktionscheck', 403, 'Funktionieren Scheibenwischer und Waschanlage?', false, 'immer', false, true, true, false, false),
  ('Fahrerhaus & Funktionscheck', 404, 'Funktionieren Betriebs- und Feststellbremse (Bremsprobe gemacht)?', false, 'immer', false, true, true, false, true),
  ('Fahrerhaus & Funktionscheck', 405, 'Ist die Lenkung ohne Spiel?', false, 'immer', false, true, true, false, true),
  ('Fahrerhaus & Funktionscheck', 406, 'Funktioniert die Hupe?', false, 'immer', false, true, true, false, false),
  ('Fahrerhaus & Funktionscheck', 407, 'Zeigen die Kontrollleuchten keine Warnung?', false, 'immer', false, true, true, true, false),
  ('Fahrerhaus & Funktionscheck', 408, 'Sind Warndreieck, Warnleuchte, Warnweste und Verbandkasten an Bord?', false, 'immer', false, true, true, false, false),
  ('Fahrerhaus & Funktionscheck', 409, 'Ist die Fahrerkarte gesteckt und das Gerät auf Arbeitszeit gestellt?', false, 'immer', false, true, true, false, false),
  ('Fahrerhaus & Funktionscheck', 410, 'Sind die Maut-Achsen richtig eingestellt?', false, 'immer', false, false, true, false, false),
  ('Fahrerhaus & Funktionscheck', 411, 'Ist eine Tachorolle vorhanden?', false, 'immer', false, false, true, false, false),
  ('Fahrerhaus & Funktionscheck', 412, 'Ist sonst alles in Ordnung (keine weiteren Auffälligkeiten)?', false, 'immer', false, false, true, true, false),
  -- Papiere & Nachweise
  ('Papiere & Nachweise', 501, 'Ist dein Führerschein gültig und dabei?', false, 'immer', false, true, true, false, true),
  ('Papiere & Nachweise', 502, 'Ist der Fahrerqualifizierungsnachweis (Code 95 / FQN) dabei?', false, 'immer', false, true, true, false, false),
  ('Papiere & Nachweise', 503, 'Ist die Zulassungsbescheinigung Teil I des Lkw dabei?', false, 'immer', false, true, true, false, false),
  ('Papiere & Nachweise', 504, 'Ist die Zulassungsbescheinigung Teil I des Anhängers dabei?', false, 'anhaenger', false, true, true, false, false),
  ('Papiere & Nachweise', 505, 'Ist die EU-Lizenz (beglaubigte Abschrift) dabei?', false, 'immer', false, true, true, false, false),
  ('Papiere & Nachweise', 506, 'Ist der Nachweis der Güterschaden-Haftpflichtversicherung dabei?', false, 'immer', false, true, true, false, false),
  ('Papiere & Nachweise', 507, 'Ist dein ADR-Schein gültig und dabei?', false, 'adr', false, true, true, false, true),
  -- Gefahrgut (ADR)
  ('Gefahrgut (ADR)', 601, 'Sind 2 Feuerlöscher à 6 kg an Bord und ist das Prüfdatum gültig?', false, 'adr', false, true, true, false, true),
  ('Gefahrgut (ADR)', 602, 'Ist ein Unterlegkeil vorhanden?', false, 'adr', false, true, true, false, false),
  ('Gefahrgut (ADR)', 603, 'Sind zwei selbststehende Warnzeichen vorhanden?', false, 'adr', false, true, true, false, false),
  ('Gefahrgut (ADR)', 604, 'Ist Augenspülflüssigkeit vorhanden?', false, 'adr', false, true, true, false, false),
  ('Gefahrgut (ADR)', 605, 'Ist für jedes Besatzungsmitglied eine Warnweste da?', false, 'adr', false, true, true, false, false),
  ('Gefahrgut (ADR)', 606, 'Ist eine Leuchte vorhanden?', false, 'adr', false, true, true, false, false),
  ('Gefahrgut (ADR)', 607, 'Sind Schutzhandschuhe und Augenschutzbrille vorhanden?', false, 'adr', false, true, true, false, false),
  ('Gefahrgut (ADR)', 608, 'Sind Schaufel, Kanalabdeckung und Auffangbehälter vorhanden?', false, 'adr', false, true, true, false, false),
  -- UVV Ladebordwand
  ('UVV Ladebordwand', 701, 'Plattform, Gelenke und Scharniere ohne sichtbare Schäden', false, 'ladebordwand', false, true, true, true, true),
  ('UVV Ladebordwand', 702, 'Hydraulik dicht – keine Ölspuren an Zylindern und Leitungen', false, 'ladebordwand', false, true, true, true, true),
  ('UVV Ladebordwand', 703, 'Bedienelemente und Not-Aus funktionieren', false, 'ladebordwand', false, true, true, true, true),
  ('UVV Ladebordwand', 704, 'Warnleuchten / Warnflaggen vorhanden und funktionsfähig', false, 'ladebordwand', false, true, true, true, false),
  ('UVV Ladebordwand', 705, 'Plattform in Fahrstellung gesichert / verriegelt', false, 'ladebordwand', false, true, true, true, true),
  ('UVV Ladebordwand', 706, 'Abrollsicherung (Kippsicherung) funktioniert', false, 'ladebordwand', false, false, true, true, false),
  ('UVV Ladebordwand', 707, 'Rutschfester Belag der Plattform in Ordnung', false, 'ladebordwand', false, false, true, true, false),
  -- UVV Elektro-Niederhubwagen
  ('UVV Elektro-Niederhubwagen', 801, 'Akku geladen, Ladekabel und Stecker unbeschädigt', false, 'ameise', false, true, true, true, false),
  ('UVV Elektro-Niederhubwagen', 802, 'Deichsel und Bremse (Totmannfunktion) arbeiten', false, 'ameise', false, true, true, true, true),
  ('UVV Elektro-Niederhubwagen', 803, 'Bauchschalter / Not-Aus funktioniert', false, 'ameise', false, true, true, true, true),
  ('UVV Elektro-Niederhubwagen', 804, 'Hupe funktioniert', false, 'ameise', false, true, true, true, false),
  ('UVV Elektro-Niederhubwagen', 805, 'Gabeln, Lastrollen und Antriebsrad ohne Schäden', false, 'ameise', false, true, true, true, false),
  ('UVV Elektro-Niederhubwagen', 806, 'Keine Leckagen an der Hydraulik', false, 'ameise', false, false, true, true, false),
  ('UVV Elektro-Niederhubwagen', 807, 'Ameise auf dem Fahrzeug gegen Verrutschen gesichert', false, 'ameise', false, false, true, true, true),
  -- Winterliche Verhältnisse (nur 01.11. bis 31.03.)
  ('Winterliche Verhältnisse', 901, 'Sind Winterreifen (Alpine-Symbol) auf den Antriebsachsen montiert?', false, 'winter', false, true, true, false, true),
  ('Winterliche Verhältnisse', 902, 'Sind Scheiben, Spiegel und Leuchten frei von Eis und Schnee?', false, 'winter', false, true, true, false, true),
  ('Winterliche Verhältnisse', 903, 'Sind Dach und Plane frei von Schnee und Eis?', false, 'winter', false, false, true, false, false),
  ('Winterliche Verhältnisse', 904, 'Ist Frostschutz im Scheibenwaschwasser?', false, 'winter', false, false, true, false, false),
  ('Winterliche Verhältnisse', 905, 'Sind Schneeketten an Bord?', false, 'winter', false, false, false, false, false);

-- Prüfpunkte einer Fahrzeuggruppe aus der Vorlage anlegen.
create function public.pruefpunkte_aus_vorlage(f uuid, art uuid)
returns void language sql security definer set search_path = '' as $$
  insert into public.pruefpunkte (firma_id, fahrzeugart_id, abschnitt, reihenfolge, frage, mangel_bei_ja, bedingung,
    monatliche_fotos, aktiv, pflicht, foto_bei_mangel, mangel_stoppt)
  select f, art, v.abschnitt, v.reihenfolge, v.frage, v.mangel_bei_ja, v.bedingung,
    v.monatliche_fotos, v.aktiv, v.pflicht, v.foto_bei_mangel, v.mangel_stoppt
  from public.vorlage_pruefpunkte v
  where not v.veraltet;
$$;

revoke execute on function public.pruefpunkte_aus_vorlage(uuid, uuid) from public, anon, authenticated;

create or replace function public.firma_standard_anlegen(f uuid)
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
    perform public.pruefpunkte_aus_vorlage(f, art);
  end if;
end;
$$;

-- Neue Checkliste für alle bestehenden Fahrzeuggruppen.
select public.pruefpunkte_aus_vorlage(a.firma_id, a.id) from public.fahrzeugarten a;

-- Neue Fahrzeuggruppe mit den Prüfpunkten einer bestehenden Gruppe (inkl. eigener Punkte).
create function public.fahrzeuggruppe_anlegen(f uuid, gruppenname text, vorlage uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  art uuid;
  n text := btrim(gruppenname);
begin
  if not public.ist_verkehrsleiter(f) then
    raise exception 'Nur der Verkehrsleiter kann Fahrzeuggruppen anlegen.';
  end if;
  if n is null or char_length(n) not between 2 and 40 then
    raise exception 'Bitte gib der Gruppe einen Namen (2 bis 40 Zeichen).';
  end if;
  if exists (select 1 from public.fahrzeugarten where firma_id = f and lower(name) = lower(n)) then
    raise exception 'Die Gruppe „%“ gibt es schon.', n;
  end if;
  insert into public.fahrzeugarten (firma_id, name) values (f, n) returning id into art;
  if exists (select 1 from public.fahrzeugarten where id = vorlage and firma_id = f) then
    insert into public.pruefpunkte (firma_id, fahrzeugart_id, abschnitt, reihenfolge, frage, mangel_bei_ja, bedingung,
      monatliche_fotos, aktiv, pflicht, eigen, foto_bei_mangel, mangel_stoppt)
    select f, art, p.abschnitt, p.reihenfolge, p.frage, p.mangel_bei_ja, p.bedingung,
      p.monatliche_fotos, p.aktiv, p.pflicht, p.eigen, p.foto_bei_mangel, p.mangel_stoppt
    from public.pruefpunkte p where p.fahrzeugart_id = vorlage and not p.veraltet;
  else
    perform public.pruefpunkte_aus_vorlage(f, art);
  end if;
  return art;
end;
$$;

revoke execute on function public.fahrzeuggruppe_anlegen(uuid, text, uuid) from public, anon;
grant execute on function public.fahrzeuggruppe_anlegen(uuid, text, uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Fahrzeuge: Ladebordwand und Elektro-Ameise mit UVV-Prüfplakette
-- ---------------------------------------------------------------------------

alter table public.fahrzeuge
  add column ladebordwand boolean not null default false,
  add column ameise boolean not null default false,
  add column ladebordwand_uvv_bis date,
  add column ameise_uvv_bis date;

-- Winterpunkte vom 01.11. bis 31.03.
create function public.ist_winter(d date)
returns boolean language sql immutable set search_path = '' as $$
  select extract(month from d) in (11, 12, 1, 2, 3);
$$;

-- Prüfplakette „gültig bis MM/JJJJ“ → letzter Tag des Monats.
create function public.plakette_bis(wert text, name text)
returns date language plpgsql stable set search_path = '' as $$
declare
  d date;
begin
  begin
    d := (btrim(wert) || '-01')::date;
  exception when others then
    d := null;
  end;
  if d is null or d < date '2000-01-01' or d > date '2100-01-01' then
    raise exception 'Bitte trage ein, bis wann die Prüfplakette % gültig ist.', name using hint = 'uvv';
  end if;
  return (d + interval '1 month - 1 day')::date;
end;
$$;

-- ---------------------------------------------------------------------------
-- Kontrollen und Antworten: „Darf ich so losfahren?“, Freigabe, Standort
-- ---------------------------------------------------------------------------

alter table public.antworten add column losfahren boolean;
alter table public.kontrollen
  add column abfahrt_freigegeben boolean not null default true,
  add column standort jsonb;

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
  aus jsonb := coalesce(p -> 'ausstattung', '{}');
  mit_lbw boolean := coalesce((aus ->> 'ladebordwand')::boolean, false);
  mit_ameise boolean := coalesce((aus ->> 'ameise')::boolean, false);
  lbw_bis date;
  ameise_bis date;
  ort jsonb := p -> 'standort';
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
  winter boolean;
  reifen_faellig boolean;
  pp record;
  a jsonb;
  fotos text[];
  bem text;
  mangel boolean;
  los boolean;
  freigabe boolean := true;
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
      return jsonb_build_object('kontrolle_id', k_id, 'bereits_eingereicht', true, 'maengel', '[]'::jsonb, 'verkehrsleiter_emails', '[]'::jsonb,
        'abfahrt_freigegeben', (select abfahrt_freigegeben from public.kontrollen where id = k_id));
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
  if mit_lbw then
    lbw_bis := public.plakette_bis(fr ->> 'ladebordwand', 'der Ladebordwand');
  end if;
  if mit_ameise then
    ameise_bis := public.plakette_bis(fr ->> 'ameise', 'der Elektro-Ameise');
  end if;

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
  update public.fahrzeuge
     set hu_faellig = hu, sp_faellig = sp, tacho_faellig = tacho,
         ladebordwand = mit_lbw, ameise = mit_ameise,
         ladebordwand_uvv_bis = coalesce(lbw_bis, ladebordwand_uvv_bis),
         ameise_uvv_bis = coalesce(ameise_bis, ameise_uvv_bis)
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

  -- Standort nur übernehmen, wenn er plausibel ist (der Fahrer kann ihn ablehnen).
  if jsonb_typeof(ort) = 'object' and jsonb_typeof(ort -> 'lat') = 'number' and jsonb_typeof(ort -> 'lng') = 'number'
     and abs((ort ->> 'lat')::numeric) <= 90 and abs((ort ->> 'lng')::numeric) <= 180 then
    ort := jsonb_build_object('lat', round((ort ->> 'lat')::numeric, 5), 'lng', round((ort ->> 'lng')::numeric, 5),
      'genauigkeit', case when jsonb_typeof(ort -> 'genauigkeit') = 'number' then round((ort ->> 'genauigkeit')::numeric) end);
  else
    ort := null;
  end if;

  art := coalesce(
    fz.fahrzeugart_id,
    (select id from public.fahrzeugarten where firma_id = f_id and name = 'Standard')
  );
  select coalesce(e.zeitzone, 'Europe/Berlin') into tz from public.firma_einstellungen e where e.firma_id = f_id;
  tz := coalesce(tz, 'Europe/Berlin');
  winter := public.ist_winter((zeitpunkt at time zone tz)::date);

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

  insert into public.kontrollen (id, firma_id, fahrer_id, fahrzeug_id, anhaenger_id, durchgefuehrt_am, unterschrift_pfad, fristen, standort)
  values (
    k_id, f_id, ich, fz.id, anh.id, zeitpunkt, unterschrift,
    jsonb_strip_nulls(jsonb_build_object('hu_faellig', fz.hu_faellig, 'sp_faellig', fz.sp_faellig, 'tacho_faellig', fz.tacho_faellig,
      'anhaenger_hu_faellig', anh.hu_faellig, 'anhaenger_sp_faellig', anh.sp_faellig,
      'ladebordwand_uvv_bis', lbw_bis, 'ameise_uvv_bis', ameise_bis)),
    ort
  );

  for pp in
    select * from public.pruefpunkte
    where fahrzeugart_id = art and firma_id = f_id and aktiv and not veraltet
      and (bedingung = 'immer'
        or (bedingung = 'adr' and (fz.adr or coalesce(anh.adr, false)))
        or (bedingung = 'anhaenger' and anh.id is not null)
        or (bedingung = 'ladebordwand' and mit_lbw)
        or (bedingung = 'ameise' and mit_ameise)
        or (bedingung = 'winter' and winter))
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
    los := null;

    if exists (
      select 1 from unnest(fotos) t(v)
      where v not like ordner || '%'
         or not exists (select 1 from storage.objects o where o.bucket_id = 'kontrollen' and o.name = v)
    ) then
      raise exception 'Ein Foto zu „%“ wurde nicht hochgeladen.', pp.frage using hint = 'pruefpunkt:' || pp.id;
    end if;

    if mangel then
      if bem is null then
        raise exception 'Bitte beschreibe den Mangel: %', pp.frage using hint = 'pruefpunkt:' || pp.id;
      end if;
      if pp.foto_bei_mangel and cardinality(fotos) = 0 then
        raise exception 'Bitte mache ein Foto vom Mangel: %', pp.frage using hint = 'pruefpunkt:' || pp.id;
      end if;
      -- Ohne Antwort auf „Darf ich so losfahren?“ (ältere App-Version) gilt die Abfahrt nicht als freigegeben.
      if pp.mangel_stoppt then
        los := false;
      elsif jsonb_typeof(a -> 'losfahren') = 'boolean' then
        los := (a ->> 'losfahren')::boolean;
      end if;
      freigabe := freigabe and coalesce(los, false);
    end if;
    if pp.monatliche_fotos and reifen_faellig and cardinality(fotos) = 0 then
      raise exception 'Bitte fotografiere diesen Monat alle Reifen.' using hint = 'pruefpunkt:' || pp.id;
    end if;

    insert into public.antworten (firma_id, kontrolle_id, pruefpunkt_id, abschnitt, frage, mangel_bei_ja, monatliche_fotos, antwort_ja, ist_mangel, bemerkung, foto_pfade, reihenfolge, losfahren)
    values (f_id, k_id, pp.id, pp.abschnitt, pp.frage, pp.mangel_bei_ja, pp.monatliche_fotos, (a ->> 'antwortJa')::boolean, mangel, bem, fotos, pp.reihenfolge, los)
    returning id into antwort;

    if mangel then
      insert into public.maengel (firma_id, antwort_id, kontrolle_id, fahrzeug_id)
      values (f_id, antwort, k_id, fz.id)
      returning jsonb_build_object('id', id, 'frage', pp.frage, 'bemerkung', bem, 'foto_pfad', fotos[1], 'losfahren', los)
      into eintrag;
      maengel_liste := maengel_liste || eintrag;
    end if;
  end loop;

  -- Antworten auf Prüfpunkte, die es in dieser Fahrzeuggruppe nicht (mehr) gibt, sind ein Fehler.
  -- Antworten auf Punkte, die heute nur nicht gelten (z. B. Winter), werden ignoriert.
  if exists (
    select 1 from jsonb_array_elements(p -> 'antworten') x(v)
    where not exists (
      select 1 from public.pruefpunkte q
      where q.id::text = v ->> 'pruefpunktId' and q.firma_id = f_id and q.fahrzeugart_id = art and q.aktiv and not q.veraltet
    )
  ) then
    raise exception 'Die Checkliste hat sich geändert. Bitte lade die Seite neu.' using hint = 'entwurf';
  end if;

  update public.kontrollen
     set hat_mangel = jsonb_array_length(maengel_liste) > 0, abfahrt_freigegeben = freigabe
   where id = k_id;

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
    'abfahrt_freigegeben', freigabe,
    'verkehrsleiter_emails', case when jsonb_array_length(maengel_liste) = 0 then '[]'::jsonb else (
      select coalesce(jsonb_agg(distinct u.email), '[]')
      from public.mitgliedschaften m join auth.users u on u.id = m.user_id
      where m.firma_id = f_id and m.rolle = 'verkehrsleiter' and u.email is not null
    ) end
  );
end;
$$;
