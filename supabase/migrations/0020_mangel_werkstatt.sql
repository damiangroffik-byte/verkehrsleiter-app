-- Mängel weitergeben: Werkstätten der Firma, Mail an die Werkstatt und Termin-Nachricht an den Fahrer.

create table public.werkstaetten (
  id uuid primary key default gen_random_uuid(),
  firma_id uuid not null references public.firmen (id) on delete cascade,
  name text not null check (btrim(name) <> '' and length(name) <= 120),
  email text check (email is null or email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  adresse text check (length(adresse) <= 300),
  telefon text check (length(telefon) <= 60),
  erstellt_am timestamptz not null default now()
);

create index on public.werkstaetten (firma_id);
alter table public.werkstaetten enable row level security;

create policy "Verwalter sehen Werkstätten" on public.werkstaetten
  for select using (public.ist_verwalter(firma_id));
create policy "Verwalter legen Werkstätten an" on public.werkstaetten
  for insert with check (public.ist_verwalter(firma_id));
create policy "Verwalter ändern Werkstätten" on public.werkstaetten
  for update using (public.ist_verwalter(firma_id)) with check (public.ist_verwalter(firma_id));
create policy "Verwalter löschen Werkstätten" on public.werkstaetten
  for delete using (public.ist_verwalter(firma_id));

-- Jede versendete Nachricht zu einem Mangel. Nachrichten an den Fahrer sieht er auch in seiner App.
create table public.mangel_nachrichten (
  id uuid primary key default gen_random_uuid(),
  firma_id uuid not null references public.firmen (id) on delete cascade,
  mangel_id uuid not null references public.maengel (id) on delete cascade,
  art text not null check (art in ('werkstatt', 'fahrer')),
  werkstatt_id uuid references public.werkstaetten (id) on delete set null,
  werkstatt_name text,
  fahrer_id uuid references public.fahrer (id) on delete cascade,
  an text,
  termin timestamptz,
  betreff text not null,
  text text not null check (length(text) <= 5000),
  gesendet_von uuid default auth.uid(),
  gesendet_am timestamptz not null default now(),
  fehler text,
  gelesen_am timestamptz,
  check (art <> 'fahrer' or fahrer_id is not null)
);

create index on public.mangel_nachrichten (firma_id);
create index on public.mangel_nachrichten (mangel_id);
create index on public.mangel_nachrichten (fahrer_id) where art = 'fahrer';
alter table public.mangel_nachrichten enable row level security;

create policy "Verwalter und betroffener Fahrer sehen Nachrichten" on public.mangel_nachrichten
  for select using (
    public.ist_verwalter(firma_id)
    or (art = 'fahrer' and fahrer_id = public.eigener_fahrer(firma_id))
  );
create policy "Verwalter versenden Nachrichten" on public.mangel_nachrichten
  for insert with check (
    public.ist_verwalter(firma_id)
    and exists (select 1 from public.maengel m where m.id = mangel_id and m.firma_id = mangel_nachrichten.firma_id)
    and (fahrer_id is null or exists (select 1 from public.fahrer x where x.id = fahrer_id and x.firma_id = mangel_nachrichten.firma_id))
    and (werkstatt_id is null or exists (select 1 from public.werkstaetten w where w.id = werkstatt_id and w.firma_id = mangel_nachrichten.firma_id))
  );
create policy "Verwalter vermerken Versandfehler" on public.mangel_nachrichten
  for update using (public.ist_verwalter(firma_id)) with check (public.ist_verwalter(firma_id));

-- Der Fahrer bestätigt, dass er die Nachricht gelesen hat (nur dieses Feld).
create function public.nachricht_gelesen(nachricht_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  update public.mangel_nachrichten n
     set gelesen_am = coalesce(n.gelesen_am, now())
   where n.id = nachricht_id and n.art = 'fahrer' and n.fahrer_id = public.eigener_fahrer(n.firma_id);
end;
$$;

revoke execute on function public.nachricht_gelesen(uuid) from public, anon;
grant execute on function public.nachricht_gelesen(uuid) to authenticated;
