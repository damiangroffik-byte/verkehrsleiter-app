# Aufgaben: Führerscheinkontrolle (Sprint 1)

- [x] T001 Migration `supabase/migrations/0005_fuehrerschein.sql`: Tabelle `fuehrerschein_pruefungen`, Spalte `firma_einstellungen.fuehrerschein_intervall_monate`, Funktionen `fuehrerschein_einreichen`, `fuehrerschein_pruefen`
- [x] T002 Bucket `fuehrerscheine` mit Zugriffsregeln in derselben Migration
- [x] T003 SQL-Tests `supabase/tests/fuehrerschein.sql`
- [x] T004 [US3] Fristen-Regeln `src/lib/fuehrerschein/regeln.ts` mit Tests
- [x] T005 [US1] Fahrer-Seite `src/app/fahrer/fuehrerschein/`
- [x] T006 [US1] Status und Knopf auf `src/app/fahrer/page.tsx`
- [x] T007 [US2] Prüfen-Seite `src/app/verwaltung/[firmaId]/fuehrerschein/[pruefungId]/`
- [x] T008 [US3] Übersicht auf `src/app/verwaltung/[firmaId]/page.tsx`
- [x] T009 [US2] Mail an Verkehrsleiter bei Einreichung (`src/lib/mail.ts`)
- [ ] T010 Erinnerungs-Mails per pg_cron (nächster Sprint)
