-- Unterweisungen pro Fahrer zuordnen. Ein Eintrag hier geht vor der Auswahl der Firma
-- (firma_unterweisungen); ohne Eintrag gilt weiter die Einstellung der Firma.

create table public.fahrer_unterweisungen (
  firma_id uuid not null references public.firmen (id) on delete cascade,
  fahrer_id uuid not null references public.fahrer (id) on delete cascade,
  unterweisung text not null references public.unterweisungen (schluessel) on delete cascade,
  aktiv boolean not null,
  primary key (fahrer_id, unterweisung)
);

create index on public.fahrer_unterweisungen (firma_id);

alter table public.fahrer_unterweisungen enable row level security;

create policy "Verwalter und eigener Fahrer sehen die Zuordnung" on public.fahrer_unterweisungen
  for select using (public.ist_verwalter(firma_id) or fahrer_id = public.eigener_fahrer(firma_id));
create policy "Verwalter ordnen Unterweisungen zu" on public.fahrer_unterweisungen
  for insert with check (
    public.ist_verwalter(firma_id)
    and exists (select 1 from public.fahrer x where x.id = fahrer_id and x.firma_id = fahrer_unterweisungen.firma_id)
  );
create policy "Verwalter ändern die Zuordnung" on public.fahrer_unterweisungen
  for update using (public.ist_verwalter(firma_id)) with check (
    public.ist_verwalter(firma_id)
    and exists (select 1 from public.fahrer x where x.id = fahrer_id and x.firma_id = fahrer_unterweisungen.firma_id)
  );
create policy "Verwalter setzen die Zuordnung zurück" on public.fahrer_unterweisungen
  for delete using (public.ist_verwalter(firma_id));

-- Block für den aufrufenden Fahrer aktiv? Eigene Zuordnung vor Firmen-Auswahl, ohne beides aktiv.
create or replace function public.unterweisung_aktiv(f uuid, u text)
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce(
    (select aktiv from public.fahrer_unterweisungen where fahrer_id = public.eigener_fahrer(f) and unterweisung = u),
    (select aktiv from public.firma_unterweisungen where firma_id = f and unterweisung = u),
    true
  );
$$;
