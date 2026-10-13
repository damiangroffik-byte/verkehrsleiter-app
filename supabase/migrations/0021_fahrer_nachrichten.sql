-- Allgemeine Nachrichten an Fahrer (ohne Mangel), in derselben Tabelle wie Werkstatttermine.

alter table public.mangel_nachrichten alter column mangel_id drop not null;
alter table public.mangel_nachrichten drop constraint mangel_nachrichten_art_check;
alter table public.mangel_nachrichten add constraint mangel_nachrichten_art_check check (art in ('werkstatt', 'fahrer', 'allgemein'));
alter table public.mangel_nachrichten drop constraint mangel_nachrichten_check;
alter table public.mangel_nachrichten add constraint mangel_nachrichten_check check (
  (art = 'werkstatt' and mangel_id is not null)
  or (art = 'fahrer' and mangel_id is not null and fahrer_id is not null)
  or (art = 'allgemein' and fahrer_id is not null)
);

alter policy "Verwalter und betroffener Fahrer sehen Nachrichten" on public.mangel_nachrichten
  using (
    public.ist_verwalter(firma_id)
    or (art <> 'werkstatt' and fahrer_id = public.eigener_fahrer(firma_id))
  );

alter policy "Verwalter versenden Nachrichten" on public.mangel_nachrichten
  with check (
    public.ist_verwalter(firma_id)
    and (mangel_id is null or exists (select 1 from public.maengel m where m.id = mangel_id and m.firma_id = mangel_nachrichten.firma_id))
    and (fahrer_id is null or exists (select 1 from public.fahrer x where x.id = fahrer_id and x.firma_id = mangel_nachrichten.firma_id))
    and (werkstatt_id is null or exists (select 1 from public.werkstaetten w where w.id = werkstatt_id and w.firma_id = mangel_nachrichten.firma_id))
  );

create or replace function public.nachricht_gelesen(nachricht_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  update public.mangel_nachrichten n
     set gelesen_am = coalesce(n.gelesen_am, now())
   where n.id = nachricht_id and n.art <> 'werkstatt' and n.fahrer_id = public.eigener_fahrer(n.firma_id);
end;
$$;
