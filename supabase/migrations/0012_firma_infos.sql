-- Allgemeine Informationen für das Fahrpersonal (Ersthelfer, Brandschutz, Verbandkästen …).
-- Der Verkehrsleiter pflegt sie in den Einstellungen, Fahrer lesen sie ohne Test.
-- angaben: { "<feld>": ["Eintrag 1", "Eintrag 2", …] }, Felder siehe src/lib/unterweisung/infos.ts

create table public.firma_infos (
  firma_id uuid primary key references public.firmen (id) on delete cascade,
  angaben jsonb not null default '{}'::jsonb check (jsonb_typeof(angaben) = 'object'),
  geaendert_am timestamptz not null default now()
);

alter table public.firma_infos enable row level security;
create policy "Mitglieder lesen die allgemeinen Informationen" on public.firma_infos
  for select using (public.ist_mitglied(firma_id));
create policy "Verkehrsleiter legen allgemeine Informationen an" on public.firma_infos
  for insert with check (public.ist_verkehrsleiter(firma_id));
create policy "Verkehrsleiter ändern allgemeine Informationen" on public.firma_infos
  for update using (public.ist_verkehrsleiter(firma_id)) with check (public.ist_verkehrsleiter(firma_id));
