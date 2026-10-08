-- Fotos und Unterschriften der Abfahrtskontrollen.
-- Pfad: {firma_id}/{kontrolle_id}/{unterschrift.png | antwort-<n>-<m>.jpg}

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('kontrollen', 'kontrollen', false, 5242880, array['image/jpeg', 'image/png'])
on conflict (id) do nothing;

-- Ordnernamen sicher als uuid lesen (ungültige Namen ergeben null).
create function public.ordner_uuid(name text, stufe int)
returns uuid language plpgsql immutable set search_path = '' as $$
begin
  return (string_to_array(name, '/'))[stufe]::uuid;
exception when invalid_text_representation then
  return null;
end;
$$;

-- Hochladen nur, solange die Kontrolle noch nicht eingereicht ist.
create function public.kontrolle_offen(k uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select not exists (select 1 from public.kontrollen where id = k);
$$;

revoke execute on function public.kontrolle_offen(uuid) from public, anon;
grant execute on function public.kontrolle_offen(uuid) to authenticated;

create policy "Fahrer laden Kontroll-Dateien hoch" on storage.objects
  for insert to authenticated with check (
    bucket_id = 'kontrollen'
    and public.eigener_fahrer(public.ordner_uuid(name, 1)) is not null
    and public.ordner_uuid(name, 2) is not null
    and public.kontrolle_offen(public.ordner_uuid(name, 2))
  );

create policy "Verwalter und eigener Fahrer sehen Kontroll-Dateien" on storage.objects
  for select to authenticated using (
    bucket_id = 'kontrollen'
    and (
      public.ist_verwalter(public.ordner_uuid(name, 1))
      or owner_id = (select auth.uid())::text
      or exists (
        select 1 from public.kontrollen k
        where k.id = public.ordner_uuid(name, 2)
          and k.fahrer_id = public.eigener_fahrer(k.firma_id)
      )
    )
  );
