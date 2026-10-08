-- Grundgerüst: Firmen, Mitgliedschaften (Rollen), Fahrer, Fahrzeugarten, Fahrzeuge.
-- Jede Firma ist ein eigener, abgetrennter Bereich. Zugriff regelt Row Level Security.

create type public.rolle as enum ('verkehrsleiter', 'unternehmer', 'fahrer');

create table public.firmen (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  adresse text,
  erstellt_am timestamptz not null default now()
);

create table public.mitgliedschaften (
  user_id uuid not null references auth.users (id) on delete cascade,
  firma_id uuid not null references public.firmen (id) on delete cascade,
  rolle public.rolle not null,
  erstellt_am timestamptz not null default now(),
  primary key (user_id, firma_id)
);

create table public.fahrer (
  id uuid primary key default gen_random_uuid(),
  firma_id uuid not null references public.firmen (id) on delete cascade,
  user_id uuid references auth.users (id) on delete set null,
  vorname text not null,
  nachname text not null,
  email text,
  telefon text,
  qualifikationspflicht boolean not null default true,
  aktiv boolean not null default true,
  erstellt_am timestamptz not null default now()
);

create table public.fahrzeugarten (
  id uuid primary key default gen_random_uuid(),
  firma_id uuid not null references public.firmen (id) on delete cascade,
  name text not null,
  unique (firma_id, name)
);

create table public.fahrzeuge (
  id uuid primary key default gen_random_uuid(),
  firma_id uuid not null references public.firmen (id) on delete cascade,
  kennzeichen text not null,
  fahrzeugart_id uuid references public.fahrzeugarten (id) on delete set null,
  ist_anhaenger boolean not null default false,
  adr boolean not null default false,
  hu_faellig date,
  sp_faellig date,
  tacho_faellig date,
  aktiv boolean not null default true,
  erstellt_am timestamptz not null default now(),
  unique (firma_id, kennzeichen)
);

create index on public.mitgliedschaften (firma_id);
create index on public.fahrer (firma_id);
create index on public.fahrzeuge (firma_id);

-- Hilfsfunktionen für die Zugriffsregeln (security definer, damit sie
-- mitgliedschaften lesen können, ohne selbst an RLS zu scheitern).
create function public.ist_mitglied(f uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.mitgliedschaften m
    where m.firma_id = f and m.user_id = auth.uid()
  );
$$;

create function public.ist_verwalter(f uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.mitgliedschaften m
    where m.firma_id = f and m.user_id = auth.uid()
      and m.rolle in ('verkehrsleiter', 'unternehmer')
  );
$$;

-- Wer eine Firma anlegt, wird automatisch ihr Verkehrsleiter.
create function public.firma_ersteller_eintragen()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.mitgliedschaften (user_id, firma_id, rolle)
  values (auth.uid(), new.id, 'verkehrsleiter');
  return new;
end;
$$;

create trigger firma_angelegt
  after insert on public.firmen
  for each row execute function public.firma_ersteller_eintragen();

alter table public.firmen enable row level security;
alter table public.mitgliedschaften enable row level security;
alter table public.fahrer enable row level security;
alter table public.fahrzeugarten enable row level security;
alter table public.fahrzeuge enable row level security;

-- Firmen
create policy "Mitglieder sehen ihre Firma" on public.firmen
  for select using (public.ist_mitglied(id));
create policy "Angemeldete legen Firmen an" on public.firmen
  for insert to authenticated with check (true);
create policy "Verwalter ändern ihre Firma" on public.firmen
  for update using (public.ist_verwalter(id));

-- Mitgliedschaften
create policy "Eigene und verwaltete Mitgliedschaften sehen" on public.mitgliedschaften
  for select using (user_id = auth.uid() or public.ist_verwalter(firma_id));
create policy "Verwalter verwalten Mitgliedschaften" on public.mitgliedschaften
  for all using (public.ist_verwalter(firma_id)) with check (public.ist_verwalter(firma_id));

-- Fahrer: Verwalter alles, Fahrer nur den eigenen Datensatz lesen.
create policy "Fahrer sehen" on public.fahrer
  for select using (public.ist_verwalter(firma_id) or user_id = auth.uid());
create policy "Verwalter verwalten Fahrer" on public.fahrer
  for all using (public.ist_verwalter(firma_id)) with check (public.ist_verwalter(firma_id));

-- Fahrzeugarten und Fahrzeuge: alle Mitglieder lesen, Verwalter schreiben.
create policy "Mitglieder sehen Fahrzeugarten" on public.fahrzeugarten
  for select using (public.ist_mitglied(firma_id));
create policy "Verwalter verwalten Fahrzeugarten" on public.fahrzeugarten
  for all using (public.ist_verwalter(firma_id)) with check (public.ist_verwalter(firma_id));

create policy "Mitglieder sehen Fahrzeuge" on public.fahrzeuge
  for select using (public.ist_mitglied(firma_id));
create policy "Verwalter verwalten Fahrzeuge" on public.fahrzeuge
  for all using (public.ist_verwalter(firma_id)) with check (public.ist_verwalter(firma_id));

-- Fahrer melden sich mit der E-Mail an, die der Verwalter hinterlegt hat.
-- Beim ersten Login wird der Fahrer-Datensatz mit dem Konto verknüpft und
-- die Mitgliedschaft als Fahrer angelegt.
create function public.fahrer_verknuepfen()
returns void language plpgsql security definer set search_path = '' as $$
declare
  mail text := lower(auth.jwt() ->> 'email');
begin
  if auth.uid() is null or mail is null then
    return;
  end if;

  update public.fahrer
     set user_id = auth.uid()
   where user_id is null and lower(email) = mail and aktiv;

  insert into public.mitgliedschaften (user_id, firma_id, rolle)
  select auth.uid(), f.firma_id, 'fahrer'
    from public.fahrer f
   where f.user_id = auth.uid()
  on conflict (user_id, firma_id) do nothing;
end;
$$;

revoke execute on function public.fahrer_verknuepfen() from public, anon;
grant execute on function public.fahrer_verknuepfen() to authenticated;
