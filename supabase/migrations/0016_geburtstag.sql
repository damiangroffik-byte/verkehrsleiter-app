-- Geburtstage (freiwillig, je Firma): Hinweis an die Verwaltung einige Tage vorher und
-- Glückwunsch an den Fahrer am Geburtstag (in der App und per Mail).

alter table public.firma_einstellungen
  add column geburtstag_aktiv boolean not null default false,
  add column geburtstag_vorlauf_tage smallint not null default 14 check (geburtstag_vorlauf_tage between 1 and 60),
  add column geburtstag_text text check (char_length(geburtstag_text) <= 2000);

-- Versandvermerk, damit jede Mail pro Geburtstag nur einmal rausgeht.
create table public.geburtstag_mails (
  id uuid primary key default gen_random_uuid(),
  firma_id uuid not null references public.firmen (id) on delete cascade,
  fahrer_id uuid not null references public.fahrer (id) on delete cascade,
  geburtstag date not null,
  art text not null check (art in ('hinweis', 'gruss')),
  gesendet_am timestamptz not null default now(),
  fehler text,
  unique (fahrer_id, geburtstag, art)
);

create index on public.geburtstag_mails (firma_id);

alter table public.geburtstag_mails enable row level security;
-- Schreiben nur der tägliche Lauf (Secret Key, umgeht RLS).
create policy "Verwalter sehen Geburtstagsmails" on public.geburtstag_mails
  for select using (public.ist_verwalter(firma_id));

-- E-Mail-Adressen der Verwaltung einer Firma, nur für den täglichen Lauf.
create function public.verwalter_emails(f uuid)
returns text[] language sql stable security definer set search_path = '' as $$
  select coalesce(array_agg(distinct u.email), '{}')
  from public.mitgliedschaften m join auth.users u on u.id = m.user_id
  where m.firma_id = f and m.rolle in ('verkehrsleiter', 'unternehmer') and u.email is not null;
$$;

revoke execute on function public.verwalter_emails(uuid) from public, anon, authenticated;
grant execute on function public.verwalter_emails(uuid) to service_role;
