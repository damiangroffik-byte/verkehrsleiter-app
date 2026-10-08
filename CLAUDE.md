@AGENTS.md

# Projekt

- Oberfläche komplett auf Deutsch, auch Bezeichner in Datenbank und Code, wo sie Fachbegriffe sind (Firma, Fahrer, Fahrzeug).
- Markenfarben: Blau #0F227B, Gelb #FFC947 (Tokens in `src/app/globals.css`). Gelbe Knöpfe mit blauer Schrift.
- Mandantenfähig: jede Tabelle hat `firma_id`, Zugriff nur über RLS-Policies in `supabase/migrations/`. Neue Tabellen immer mit RLS.
- Handy zuerst: Fahrer nutzen die App auf privaten Handys, Touch-Ziele mindestens 44 px.
