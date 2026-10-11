-- Einstellbar, wie viele Tage vor der nächsten Führerscheinkontrolle der Fahrer in der App erinnert wird.
alter table public.firma_einstellungen
  add column fuehrerschein_vorwarnung_tage smallint not null default 30
  check (fuehrerschein_vorwarnung_tage between 0 and 90);
