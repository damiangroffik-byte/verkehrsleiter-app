-- Mangel-Status in beide Richtungen: „erledigt“ (behoben) mit freiwilligem Vermerk und zurück auf „offen“.

alter table public.maengel drop constraint maengel_check;
alter table public.maengel add constraint maengel_check check (status = 'offen' or behoben_am is not null);

create or replace function public.mangel_schliessen(mangel_id uuid, vermerk text)
returns void language plpgsql security definer set search_path = '' as $$
declare
  m public.maengel;
begin
  select * into m from public.maengel where id = mangel_id;
  if m.id is null or not public.ist_verwalter(m.firma_id) then
    raise exception 'Mangel nicht gefunden.' using hint = 'mangel';
  end if;
  if m.status <> 'offen' then
    return;
  end if;
  update public.maengel
     set status = 'behoben', behoben_am = now(), behoben_von = auth.uid(), vermerk = nullif(btrim(mangel_schliessen.vermerk), '')
   where id = mangel_id;
end;
$$;

create function public.mangel_oeffnen(mangel_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare
  m public.maengel;
begin
  select * into m from public.maengel where id = mangel_id;
  if m.id is null or not public.ist_verwalter(m.firma_id) then
    raise exception 'Mangel nicht gefunden.' using hint = 'mangel';
  end if;
  update public.maengel set status = 'offen', behoben_am = null, behoben_von = null, vermerk = null where id = mangel_id;
end;
$$;

revoke execute on function public.mangel_oeffnen(uuid) from public, anon;
grant execute on function public.mangel_oeffnen(uuid) to authenticated;
