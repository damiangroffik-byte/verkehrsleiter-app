-- Lesebestätigung der allgemeinen Informationen durch den Fahrer.
-- stand = geaendert_am der Informationen beim Bestätigen; ändert der Verkehrsleiter
-- die Informationen, muss der Fahrer neu bestätigen.

create table public.firma_info_bestaetigungen (
  id uuid primary key default gen_random_uuid(),
  firma_id uuid not null references public.firmen (id) on delete cascade,
  fahrer_id uuid not null references public.fahrer (id) on delete cascade,
  stand timestamptz not null,
  bestaetigt_am timestamptz not null default now(),
  unique (fahrer_id, stand)
);

create index on public.firma_info_bestaetigungen (firma_id, fahrer_id, stand desc);

alter table public.firma_info_bestaetigungen enable row level security;

-- Nur lesen; Schreiben ausschließlich über firma_infos_bestaetigen.
create policy "Verwalter und eigener Fahrer sehen Lesebestätigungen" on public.firma_info_bestaetigungen
  for select using (public.ist_verwalter(firma_id) or fahrer_id = public.eigener_fahrer(firma_id));

create function public.firma_infos_bestaetigen(f uuid)
returns timestamptz language plpgsql security definer set search_path = '' as $$
declare
  ich uuid := public.eigener_fahrer(f);
  s timestamptz;
begin
  if ich is null then
    raise exception 'Du bist bei dieser Firma nicht als Fahrer eingetragen.';
  end if;
  select geaendert_am into s from public.firma_infos where firma_id = f;
  if s is null then
    raise exception 'Es gibt noch keine Informationen zum Bestätigen.';
  end if;
  insert into public.firma_info_bestaetigungen (firma_id, fahrer_id, stand)
  values (f, ich, s)
  on conflict (fahrer_id, stand) do nothing;
  return s;
end $$;

revoke execute on function public.firma_infos_bestaetigen(uuid) from public, anon;
grant execute on function public.firma_infos_bestaetigen(uuid) to authenticated;
