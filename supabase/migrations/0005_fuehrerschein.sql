-- Führerscheinkontrolle: Fahrer reicht Fotos und Fristen ein, Verwalter bestätigt.
-- Fotos: Bucket fuehrerscheine, Pfad {firma_id}/{pruefung_id}/{vorne|hinten}-….jpg
-- Details: specs/002-fuehrerschein/spec.md

alter table public.firma_einstellungen
  add column fuehrerschein_intervall_monate smallint not null default 6
  check (fuehrerschein_intervall_monate between 1 and 12);

create table public.fuehrerschein_pruefungen (
  id uuid primary key,
  firma_id uuid not null references public.firmen (id) on delete cascade,
  fahrer_id uuid not null references public.fahrer (id) on delete cascade,
  eingereicht_am timestamptz not null default now(),
  foto_vorne text not null,
  foto_hinten text not null,
  klassen text[] not null,
  gueltig_bis date not null,
  code95_bis date,
  status text not null default 'eingereicht',
  geprueft_am timestamptz,
  geprueft_von uuid references auth.users (id) on delete set null,
  geprueft_von_name text,
  vermerk text,
  check (status in ('eingereicht', 'bestaetigt', 'abgelehnt', 'ersetzt')),
  check (cardinality(klassen) > 0)
);

create index on public.fuehrerschein_pruefungen (firma_id, fahrer_id, eingereicht_am desc);

alter table public.fuehrerschein_pruefungen enable row level security;

-- Nur lesen; Schreiben ausschließlich über die Funktionen unten.
create policy "Verwalter und eigener Fahrer sehen Führerscheinprüfungen" on public.fuehrerschein_pruefungen
  for select using (public.ist_verwalter(firma_id) or fahrer_id = public.eigener_fahrer(firma_id));

-- Hochladen nur, solange die Prüfung noch nicht eingereicht ist.
create function public.fuehrerschein_offen(p uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select not exists (select 1 from public.fuehrerschein_pruefungen where id = p);
$$;

create function public.fuehrerschein_einreichen(p jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  p_id uuid := (p ->> 'pruefungId')::uuid;
  f_id uuid := (p ->> 'firmaId')::uuid;
  vorne text := p ->> 'fotoVorne';
  hinten text := p ->> 'fotoHinten';
  bis date := nullif(p ->> 'gueltigBis', '')::date;
  c95 date := nullif(p ->> 'code95Bis', '')::date;
  kl text[];
  ordner text;
  ich uuid;
  fahrername text;
begin
  if p_id is null or f_id is null then
    raise exception 'Die Einreichung ist unvollständig.' using hint = 'entwurf';
  end if;
  ordner := f_id::text || '/' || p_id::text || '/';

  ich := public.eigener_fahrer(f_id);
  if ich is null then
    raise exception 'Du bist in dieser Firma nicht als aktiver Fahrer eingetragen.' using hint = 'fahrer';
  end if;

  -- Erneutes Senden (z. B. nach Netzabbruch) liefert das frühere Ergebnis.
  if exists (select 1 from public.fuehrerschein_pruefungen where id = p_id) then
    if exists (select 1 from public.fuehrerschein_pruefungen where id = p_id and fahrer_id = ich) then
      return jsonb_build_object('pruefung_id', p_id, 'bereits_eingereicht', true, 'verkehrsleiter_emails', '[]'::jsonb);
    end if;
    raise exception 'Diese Prüfung gibt es schon.' using hint = 'entwurf';
  end if;

  if vorne is null or left(vorne, length(ordner)) <> ordner
     or not exists (select 1 from storage.objects o where o.bucket_id = 'fuehrerscheine' and o.name = vorne) then
    raise exception 'Bitte fotografiere die Vorderseite.' using hint = 'vorne';
  end if;
  if hinten is null or left(hinten, length(ordner)) <> ordner
     or not exists (select 1 from storage.objects o where o.bucket_id = 'fuehrerscheine' and o.name = hinten) then
    raise exception 'Bitte fotografiere die Rückseite.' using hint = 'hinten';
  end if;

  select coalesce(array_agg(distinct x.k order by x.k), '{}') into kl
  from jsonb_array_elements_text(coalesce(p -> 'klassen', '[]')) as x(k);
  if cardinality(kl) = 0 then
    raise exception 'Bitte wähle deine Führerscheinklassen.' using hint = 'klassen';
  end if;
  if not kl <@ array['AM','A1','A2','A','B','BE','C1','C1E','C','CE','D1','D1E','D','DE','L','T'] then
    raise exception 'Unbekannte Führerscheinklasse.' using hint = 'klassen';
  end if;

  if bis is null then
    raise exception 'Bitte trage ein, bis wann deine Fahrerlaubnis gilt.' using hint = 'gueltig_bis';
  end if;

  -- Ältere, noch nicht geprüfte Einreichungen werden ersetzt.
  update public.fuehrerschein_pruefungen
     set status = 'ersetzt'
   where fahrer_id = ich and status = 'eingereicht';

  insert into public.fuehrerschein_pruefungen (id, firma_id, fahrer_id, foto_vorne, foto_hinten, klassen, gueltig_bis, code95_bis)
  values (p_id, f_id, ich, vorne, hinten, kl, bis, c95);

  select vorname || ' ' || nachname into fahrername from public.fahrer where id = ich;

  return jsonb_build_object(
    'pruefung_id', p_id,
    'fahrer', fahrername,
    'verkehrsleiter_emails', (
      select coalesce(jsonb_agg(distinct u.email), '[]')
      from public.mitgliedschaften m join auth.users u on u.id = m.user_id
      where m.firma_id = f_id and m.rolle = 'verkehrsleiter' and u.email is not null
    )
  );
end;
$$;

-- Bestätigen oder ablehnen: nur Verwalter, nur einmal, Ablehnung mit Grund.
create function public.fuehrerschein_pruefen(pruefung_id uuid, bestaetigt boolean, vermerk text)
returns void language plpgsql security definer set search_path = '' as $$
declare
  pr public.fuehrerschein_pruefungen;
  grund text := nullif(btrim(vermerk), '');
begin
  select * into pr from public.fuehrerschein_pruefungen where id = pruefung_id;
  if pr.id is null or not public.ist_verwalter(pr.firma_id) then
    raise exception 'Prüfung nicht gefunden.' using hint = 'pruefung';
  end if;
  if pr.status <> 'eingereicht' then
    raise exception 'Diese Prüfung ist schon abgeschlossen.' using hint = 'pruefung';
  end if;
  if not bestaetigt and grund is null then
    raise exception 'Bitte schreibe, warum du ablehnst.' using hint = 'vermerk';
  end if;

  update public.fuehrerschein_pruefungen
     set status = case when bestaetigt then 'bestaetigt' else 'abgelehnt' end,
         geprueft_am = now(),
         geprueft_von = auth.uid(),
         geprueft_von_name = auth.jwt() ->> 'email',
         vermerk = grund
   where id = pruefung_id;
end;
$$;

revoke execute on function public.fuehrerschein_offen(uuid) from public, anon;
revoke execute on function public.fuehrerschein_einreichen(jsonb) from public, anon;
revoke execute on function public.fuehrerschein_pruefen(uuid, boolean, text) from public, anon;
grant execute on function public.fuehrerschein_offen(uuid) to authenticated;
grant execute on function public.fuehrerschein_einreichen(jsonb) to authenticated;
grant execute on function public.fuehrerschein_pruefen(uuid, boolean, text) to authenticated;

-- Fotos
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('fuehrerscheine', 'fuehrerscheine', false, 5242880, array['image/jpeg'])
on conflict (id) do nothing;

create policy "Fahrer laden Führerscheinfotos hoch" on storage.objects
  for insert to authenticated with check (
    bucket_id = 'fuehrerscheine'
    and public.eigener_fahrer(public.ordner_uuid(name, 1)) is not null
    and public.ordner_uuid(name, 2) is not null
    and public.fuehrerschein_offen(public.ordner_uuid(name, 2))
  );

create policy "Verwalter und eigener Fahrer sehen Führerscheinfotos" on storage.objects
  for select to authenticated using (
    bucket_id = 'fuehrerscheine'
    and (
      public.ist_verwalter(public.ordner_uuid(name, 1))
      or owner_id = (select auth.uid())::text
    )
  );

-- Fahrer brauchen den Prüfabstand für ihre eigene Fristanzeige.
create policy "Mitglieder sehen Einstellungen" on public.firma_einstellungen
  for select using (public.ist_mitglied(firma_id));
