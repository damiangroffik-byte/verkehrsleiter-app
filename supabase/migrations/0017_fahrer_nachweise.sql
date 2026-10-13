-- Weitere Nachweise des Fahrers per Foto: Fahrerqualifizierungsnachweis (Code 95 / FQN-Karte),
-- Fahrerkarte und ADR-Schein. Das erkannte Datum landet direkt beim Fahrer.
-- Fotos: Bucket fahrernachweise, Pfad {firma_id}/{fahrer_id}/{art}-….jpg

create table public.fahrer_nachweis_belege (
  id uuid primary key default gen_random_uuid(),
  firma_id uuid not null references public.firmen (id) on delete cascade,
  fahrer_id uuid not null references public.fahrer (id) on delete cascade,
  art text not null check (art in ('fqn', 'fahrerkarte', 'adr')),
  datum date not null,
  foto_pfad text,
  erfasst_am timestamptz not null default now()
);

create index on public.fahrer_nachweis_belege (firma_id, fahrer_id, art, erfasst_am desc);

alter table public.fahrer_nachweis_belege enable row level security;
-- Schreiben nur über fahrer_nachweis_erfassen.
create policy "Verwalter und eigener Fahrer sehen Nachweise" on public.fahrer_nachweis_belege
  for select using (public.ist_verwalter(firma_id) or fahrer_id = public.eigener_fahrer(firma_id));

create function public.fahrer_nachweis_erfassen(f uuid, art text, datum date, foto text)
returns void language plpgsql security definer set search_path = '' as $$
declare
  ich uuid := public.eigener_fahrer(f);
begin
  if ich is null then
    raise exception 'Du bist in dieser Firma nicht als aktiver Fahrer eingetragen.';
  end if;
  if datum is null or datum < date '2000-01-01' or datum > date '2100-01-01' then
    raise exception 'Bitte gib ein gültiges Datum ein.';
  end if;
  if foto is not null and (public.ordner_uuid(foto, 1) is distinct from f or public.ordner_uuid(foto, 2) is distinct from ich) then
    raise exception 'Das Foto gehört nicht zu dir.';
  end if;
  case art
    when 'fqn' then update public.fahrer set fqn_gueltig_bis = datum where id = ich;
    when 'fahrerkarte' then update public.fahrer set fahrerkarte_gueltig_bis = datum where id = ich;
    when 'adr' then update public.fahrer set adr_gueltig_bis = datum where id = ich;
    else raise exception 'Unbekannter Nachweis.';
  end case;
  insert into public.fahrer_nachweis_belege (firma_id, fahrer_id, art, datum, foto_pfad)
  values (f, ich, art, datum, foto);
end $$;

revoke execute on function public.fahrer_nachweis_erfassen(uuid, text, date, text) from public, anon;
grant execute on function public.fahrer_nachweis_erfassen(uuid, text, date, text) to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('fahrernachweise', 'fahrernachweise', false, 5242880, array['image/jpeg'])
on conflict (id) do nothing;

create policy "Fahrer laden Nachweisfotos hoch" on storage.objects
  for insert to authenticated with check (
    bucket_id = 'fahrernachweise'
    and public.ordner_uuid(name, 2) is not null
    and public.eigener_fahrer(public.ordner_uuid(name, 1)) = public.ordner_uuid(name, 2)
  );

create policy "Verwalter und eigener Fahrer sehen Nachweisfotos" on storage.objects
  for select to authenticated using (
    bucket_id = 'fahrernachweise'
    and (
      public.ist_verwalter(public.ordner_uuid(name, 1))
      or public.eigener_fahrer(public.ordner_uuid(name, 1)) = public.ordner_uuid(name, 2)
    )
  );
