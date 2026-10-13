-- Geburtstage pro Fahrer statt für die ganze Firma einschalten.
-- Vorlauf und Glückwunschtext bleiben Einstellungen der Firma.
-- firma_einstellungen.geburtstag_aktiv wird nicht mehr benutzt (bleibt, damit die laufende Version nicht bricht).

alter table public.fahrer
  add column geburtstag_gruss boolean not null default false;

-- Wer es schon für die Firma eingeschaltet hatte, behält es für alle Fahrer.
update public.fahrer f set geburtstag_gruss = true
  from public.firma_einstellungen e
 where e.firma_id = f.firma_id and e.geburtstag_aktiv;
