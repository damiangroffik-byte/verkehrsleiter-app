-- Angaben zum Fahrer für den Fuhrparkleiter: Geburtstag und Ablaufdaten der Nachweise.
-- Später sollen diese Daten aus Fotos (Fahrerqualifikationskarte, ADR-Schein, Fahrerkarte) übernommen werden.
alter table public.fahrer
  add column geburtsdatum date,
  add column fqn_gueltig_bis date,
  add column adr_gueltig_bis date,
  add column fahrerkarte_gueltig_bis date;
