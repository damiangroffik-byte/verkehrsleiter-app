-- Prüffristen je Fahrzeug: Feuerlöscher kommt dazu, Fahrer erfassen Fristen per Foto,
-- der Verkehrsleiter stellt Erinnerung und automatische Werkstatt-Mails je Prüfart ein.
-- Prüfarten: hu, sp, tacho, feuerloescher, uvv_ladebordwand, uvv_ameise (siehe src/lib/fahrzeugfristen.ts)

alter table public.fahrzeuge add column feuerloescher_bis date;

-- Nachweisfotos (jede Erfassung eine Zeile; das Datum steht zusätzlich am Fahrzeug)
create table public.fahrzeug_frist_belege (
  id uuid primary key default gen_random_uuid(),
  firma_id uuid not null references public.firmen (id) on delete cascade,
  fahrzeug_id uuid not null references public.fahrzeuge (id) on delete cascade,
  art text not null check (art in ('hu', 'sp', 'tacho', 'feuerloescher', 'uvv_ladebordwand', 'uvv_ameise')),
  datum date not null,
  foto_pfad text,
  erfasst_von uuid references auth.users (id) on delete set null,
  erfasst_am timestamptz not null default now()
);

create index on public.fahrzeug_frist_belege (fahrzeug_id, art, erfasst_am desc);
create index on public.fahrzeug_frist_belege (firma_id);

alter table public.fahrzeug_frist_belege enable row level security;
create policy "Mitglieder sehen Fristbelege" on public.fahrzeug_frist_belege
  for select using (public.ist_mitglied(firma_id));

-- Erinnerung und Werkstatt-Mail je Prüfart
create table public.frist_regeln (
  firma_id uuid not null references public.firmen (id) on delete cascade,
  art text not null check (art in ('hu', 'sp', 'tacho', 'feuerloescher', 'uvv_ladebordwand', 'uvv_ameise')),
  vorwarnung_tage int not null default 30 check (vorwarnung_tage between 0 and 365),
  mail_aktiv boolean not null default false,
  mail_an text,
  mail_betreff text,
  mail_text text,
  mail_tage int not null default 42 check (mail_tage between 0 and 365),
  primary key (firma_id, art),
  check (not mail_aktiv or (nullif(btrim(mail_an), '') is not null and nullif(btrim(mail_text), '') is not null))
);

alter table public.frist_regeln enable row level security;
create policy "Mitglieder sehen Fristregeln" on public.frist_regeln
  for select using (public.ist_mitglied(firma_id));
create policy "Verkehrsleiter legen Fristregeln an" on public.frist_regeln
  for insert with check (public.ist_verkehrsleiter(firma_id));
create policy "Verkehrsleiter ändern Fristregeln" on public.frist_regeln
  for update using (public.ist_verkehrsleiter(firma_id)) with check (public.ist_verkehrsleiter(firma_id));

-- Versendete Werkstatt-Mails: je Fahrzeug, Prüfart und Fälligkeit höchstens einmal automatisch.
create table public.frist_mails (
  id uuid primary key default gen_random_uuid(),
  firma_id uuid not null references public.firmen (id) on delete cascade,
  fahrzeug_id uuid not null references public.fahrzeuge (id) on delete cascade,
  art text not null,
  faellig_am date not null,
  an text not null,
  automatisch boolean not null default true,
  gesendet_am timestamptz not null default now(),
  fehler text
);

create unique index frist_mails_einmal on public.frist_mails (fahrzeug_id, art, faellig_am) where automatisch;
create index on public.frist_mails (firma_id, gesendet_am desc);

alter table public.frist_mails enable row level security;
create policy "Verwalter sehen Fristmails" on public.frist_mails
  for select using (public.ist_verwalter(firma_id));
create policy "Verwalter vermerken Fristmails" on public.frist_mails
  for insert with check (public.ist_verwalter(firma_id) and not automatisch);

-- Fahrer und Verwalter tragen eine Frist ein (mit oder ohne Foto).
create function public.fahrzeug_frist_erfassen(fz uuid, art text, datum date, foto text)
returns void language plpgsql security definer set search_path = '' as $$
declare
  f uuid;
begin
  select firma_id into f from public.fahrzeuge where id = fz and aktiv;
  if f is null or not public.ist_mitglied(f) then
    raise exception 'Dieses Fahrzeug gehört nicht zu deiner Firma.';
  end if;
  if datum is null or datum < date '2000-01-01' or datum > date '2100-01-01' then
    raise exception 'Bitte gib ein gültiges Datum ein.';
  end if;
  if foto is not null and (public.ordner_uuid(foto, 1) is distinct from f or public.ordner_uuid(foto, 2) is distinct from fz) then
    raise exception 'Das Foto gehört nicht zu diesem Fahrzeug.';
  end if;
  case art
    when 'hu' then update public.fahrzeuge set hu_faellig = datum where id = fz;
    when 'sp' then update public.fahrzeuge set sp_faellig = datum where id = fz;
    when 'tacho' then update public.fahrzeuge set tacho_faellig = datum where id = fz;
    when 'feuerloescher' then update public.fahrzeuge set feuerloescher_bis = datum where id = fz;
    when 'uvv_ladebordwand' then update public.fahrzeuge set ladebordwand_uvv_bis = datum where id = fz;
    when 'uvv_ameise' then update public.fahrzeuge set ameise_uvv_bis = datum where id = fz;
    else raise exception 'Unbekannte Prüfart.';
  end case;
  insert into public.fahrzeug_frist_belege (firma_id, fahrzeug_id, art, datum, foto_pfad, erfasst_von)
  values (f, fz, art, datum, foto, auth.uid());
end $$;

revoke execute on function public.fahrzeug_frist_erfassen(uuid, text, date, text) from public, anon;
grant execute on function public.fahrzeug_frist_erfassen(uuid, text, date, text) to authenticated;

-- Fotos: {firma_id}/{fahrzeug_id}/{art}-….jpg
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('fahrzeugfristen', 'fahrzeugfristen', false, 5242880, array['image/jpeg'])
on conflict (id) do nothing;

create policy "Mitglieder laden Fristfotos hoch" on storage.objects
  for insert to authenticated with check (
    bucket_id = 'fahrzeugfristen'
    and public.ist_mitglied(public.ordner_uuid(name, 1))
    and exists (select 1 from public.fahrzeuge z where z.id = public.ordner_uuid(name, 2) and z.firma_id = public.ordner_uuid(name, 1))
  );

create policy "Mitglieder sehen Fristfotos" on storage.objects
  for select to authenticated using (
    bucket_id = 'fahrzeugfristen' and public.ist_mitglied(public.ordner_uuid(name, 1))
  );
