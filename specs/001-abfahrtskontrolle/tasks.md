---
description: "Aufgabenliste für die Umsetzung der Abfahrtskontrolle"
---

# Tasks: Abfahrtskontrolle mit Mängelmeldung

**Input**: Design-Dokumente aus `/specs/001-abfahrtskontrolle/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md), [data-model.md](./data-model.md), [contracts/](./contracts/oberflaeche-und-schnittstellen.md), [quickstart.md](./quickstart.md)

**Tests**: Die Verfassung verlangt automatisierte Tests für Geschäftsregeln. Deshalb gibt es Tests für `src/lib/kontrolle/regeln.ts` (vitest) und SQL-Tests für RLS und Datenbankfunktionen. Oberflächen werden über [quickstart.md](./quickstart.md) geprüft.

**Organization**: Nach User Stories gruppiert; jede Story ist einzeln testbar.

## Format: `[ID] [P?] [Story] Beschreibung`

- **[P]**: parallel möglich (andere Dateien, keine offenen Abhängigkeiten)
- **[Story]**: zugehörige User Story (US1–US5)
- Pfade relativ zum Repository (ein Next.js-Projekt, siehe plan.md)

---

## Phase 1: Setup

**Purpose**: Abhängigkeiten und Grundgerüst für Tests

- [ ] T001 `vitest` als Dev-Abhängigkeit und `nodemailer` + `@types/nodemailer` installieren; in `package.json` Skript `"test": "vitest run"` ergänzen
- [ ] T002 [P] `vitest.config.ts` im Repository-Root anlegen (Umgebung `node`, Alias `@` → `src`)
- [ ] T003 [P] Neue Umgebungsvariablen in `.env.example` ergänzen: `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORT`, `MAIL_ABSENDER`, `BENACHRICHTIGUNG_GEHEIMNIS`, `NEXT_PUBLIC_APP_URL`, `SUPABASE_SECRET_KEY` (mit Kommentar „nur für Aufräumen“)
- [ ] T004 [P] Browser-Client `src/lib/supabase/browser.ts` mit `createBrowserClient` aus `@supabase/ssr` anlegen (für Foto- und Unterschrift-Uploads, research R2)

---

## Phase 2: Foundational (Datenbank und Regeln)

**Purpose**: Tabellen, Policies und reine Regeln, die alle Stories brauchen

**⚠️ CRITICAL**: Keine Story-Arbeit vor Abschluss dieser Phase

- [ ] T005 Migration `supabase/migrations/0003_abfahrtskontrolle.sql`, Teil 1: Funktionen `ist_verkehrsleiter(f uuid)` und `eigener_fahrer(f uuid)` (security definer, `set search_path = ''`, Execute nur für `authenticated`); Tabelle `vorlage_pruefpunkte` mit Feldern laut data-model (`bedingung text check in ('immer','adr','anhaenger')`, `mangel_bei_ja boolean`, `monatliche_fotos boolean`) und Inhalt von Anhang A der Spec; RLS nur `select` für `authenticated`
- [ ] T006 Migration 0003, Teil 2: Tabelle `pruefpunkte` (Felder der Vorlage + `firma_id uuid not null`, `fahrzeugart_id uuid not null`, `aktiv boolean default true`); Policy „Verwalter verwalten Fahrzeugarten“ auf `fahrzeugarten` durch Verkehrsleiter-Policy ersetzen; RLS `pruefpunkte`: `select` Mitglieder, `insert/update` nur `ist_verkehrsleiter(firma_id)`, kein `delete`
- [ ] T007 Migration 0003, Teil 3: Tabelle `firma_einstellungen` (`kontrolle_wochentage smallint[] default '{1,2,3,4,5}'`, `kontrolle_bis time default '09:00'`, `zeitzone text default 'Europe/Berlin'`); RLS `select` Verwalter, `update` nur Verkehrsleiter; Trigger nach Insert auf `firmen`: Einstellungen anlegen, Fahrzeugart „Standard“ anlegen, Vorlage in `pruefpunkte` kopieren; dasselbe einmalig für alle bestehenden Firmen
- [ ] T008 Migration 0003, Teil 4: Tabellen `kontrollen`, `antworten`, `maengel` (`status text check in ('offen','behoben') default 'offen'`), `kontrolle_fehlt` (`unique (fahrer_id, datum)`) mit Feldern, Indizes und RLS laut data-model; keine Update/Delete-Policies auf `kontrollen` und `antworten`
- [ ] T009 Migration 0003, Teil 5: Funktion `kontrolle_einreichen(p jsonb) returns jsonb` (security definer) mit allen Prüfungen aus data-model (eigener Fahrer, Fahrzeug/Anhänger der Firma, alle sichtbaren aktiven Prüfpunkte beantwortet, Mangel ⇒ Bemerkung und mind. 1 Foto, monatliche Reifenfotos, Unterschrift); legt Kontrolle, Antworten mit Kopie von Abschnitt/Frage/Mangel-Antwort und Mängel an; erledigt `kontrolle_fehlt` desselben Tages; liefert `{kontrolle_id, maengel, verkehrsleiter_emails}`
- [ ] T010 Migration 0003, Teil 6: Funktion `mangel_schliessen(id uuid, vermerk text)` (nur Verwalter, Vermerk nicht leer, nur `offen → behoben`, setzt `behoben_am`, `behoben_von`)
- [ ] T011 Migration `supabase/migrations/0004_kontrollen_storage.sql`: privater Bucket `kontrollen`; Storage-Policies laut data-model (Insert in eigenen Firmenordner, Select für Verwalter oder Fahrer der Kontrolle, kein Update/Delete)
- [ ] T012 SQL-Tests `supabase/tests/abfahrtskontrolle.sql` (Transaktion + Rollback): Standard-Checkliste für neue Firma, Fahrer reicht ein, unvollständige Kontrolle wird abgelehnt, Mangel ohne Foto abgelehnt, Kontrolle nicht änderbar, Unternehmer darf Prüfpunkte nicht ändern, Fahrer fremder Firma sieht nichts
- [ ] T013 Migrationen 0003 und 0004 über den Supabase-Konnektor anwenden, T012 ausführen, Sicherheitsberater (`get_advisors`) prüfen und Befunde beheben
- [ ] T014 [P] Reine Regeln in `src/lib/kontrolle/regeln.ts`: `istSichtbar(pruefpunkt, {adr, mitAnhaenger})`, `istMangel(pruefpunkt, antwortJa)`, `reifenfotosFaellig(letzteReifenfotos, jetzt)`, `pruefeEntwurf(entwurf, pruefpunkte)` (liefert erstes fehlendes Feld)
- [ ] T015 [P] Tests `src/lib/kontrolle/regeln.test.ts` für alle Funktionen aus T014 (ADR, Anhänger, Ja/Nein als Mangel, Monatswechsel, fehlende Unterschrift)
- [ ] T016 Typen für Tabellen über `generate_typescript_types` erzeugen und in `src/lib/datenbank.types.ts` ablegen

**Checkpoint**: Datenbank steht, Regeln getestet

---

## Phase 3: User Story 1 - Fahrer führt die tägliche Abfahrtskontrolle durch (Priority: P1) 🎯 MVP

**Goal**: Fahrer reicht eine Kontrolle ohne Mängel mit Unterschrift ein

**Independent Test**: quickstart Szenario 1 und 2

- [ ] T017 [P] [US1] Komponente `src/components/JaNein.tsx`: zwei Knöpfe ≥ 44 px, Mangel-Antwort rot umrandet, Tastatur-bedienbar
- [ ] T018 [P] [US1] Komponente `src/components/Unterschrift.tsx`: Canvas für Finger und Maus, „Löschen“, liefert PNG-Blob
- [ ] T019 [US1] Seite `src/app/fahrer/kontrolle/page.tsx` (Server): eigene Firma(en) und Fahrer-Datensatz laden, Fahrzeuge (`ist_anhaenger = false`) und Anhänger, Prüfpunkte der Fahrzeugart (Fallback „Standard“), Datum der letzten Reifenfotos je Fahrzeug; Hinweis ohne Firma oder Fahrzeug (Edge Case)
- [ ] T020 [US1] Client-Ablauf `src/app/fahrer/kontrolle/KontrollAblauf.tsx`: Schritt 1 Fahrzeug/Anhänger, Schritt 2 Prüfpunkte je Abschnitt mit `istSichtbar`, HU/SP/Tacho nur anzeigen (abgelaufen rot, `Frist` aus `src/components/ui.tsx`), Schritt 3 Unterschrift; Prüfung mit `pruefeEntwurf` markiert fehlende Punkte
- [ ] T021 [US1] Upload der Unterschrift nach `{firma_id}/{kontrolle_id}/unterschrift.png` mit dem Browser-Client in `KontrollAblauf.tsx`
- [ ] T022 [US1] Server Action `kontrolleEinreichen` in `src/app/fahrer/kontrolle/actions.ts`: ruft `kontrolle_einreichen`, gibt `{ok, kontrolleId}` oder `{ok:false, fehler, feld}` zurück (Vertrag in contracts)
- [ ] T023 [US1] Bestätigungsansicht nach dem Einreichen und Liste der eigenen letzten Kontrollen in `src/app/fahrer/page.tsx`

**Checkpoint**: MVP – Fahrer können kontrollieren, Verkehrsleiter sieht Kontrollen in der Datenbank

---

## Phase 4: User Story 2 - Fahrer meldet einen Mangel (Priority: P1)

**Goal**: Mangel mit Pflicht-Foto und Beschreibung, sofortige Mail an die Verkehrsleiter

**Independent Test**: quickstart Szenario 3

- [ ] T024 [P] [US2] Foto verkleinern in `src/lib/kontrolle/bild.ts` (Canvas, lange Kante max. 1600 px, JPEG 0,8)
- [ ] T025 [P] [US2] Komponente `src/components/FotoAufnahme.tsx`: `<input type="file" accept="image/*" capture="environment">`, Vorschau, mehrere Fotos für monatliche Reifenfotos, Upload nach `{firma_id}/{kontrolle_id}/antwort-<n>-<m>.jpg`
- [ ] T026 [US2] In `KontrollAblauf.tsx`: bei Mangel-Antwort Pflicht-Foto und Pflicht-Beschreibung einblenden; freiwilliges Foto/Bemerkung bei jedem Punkt (FR-005); Hinweis „Fahrt erst nach Rücksprache mit Disposition oder Verkehrsleiter antreten“ nach Einreichen mit Mangel
- [ ] T027 [P] [US2] Mailversand `src/lib/mail.ts` mit `nodemailer` (SMTP-Variablen aus T003) und Vorlage „Mangel“ laut contracts (Betreff `Mangel: {Kennzeichen} – {Prüfpunkt}`, signierter Foto-Link 7 Tage, Link „Mangel öffnen“)
- [ ] T028 [US2] In `src/app/fahrer/kontrolle/actions.ts` nach erfolgreichem Einreichen Mails an `verkehrsleiter_emails` senden und `maengel.gemailt_am` setzen; Mailfehler brechen das Einreichen nicht ab

**Checkpoint**: Mängel kommen beim Verkehrsleiter per Mail an

---

## Phase 5: User Story 3 - Verkehrsleiter erledigt gemeldete Mängel (Priority: P2)

**Goal**: Startseite mit offenen Mängeln und fehlenden Kontrollen aller Firmen; Mangel schließen; Fälligkeit einstellen (FR-018/018a)

**Independent Test**: quickstart Szenario 4 und 6

- [ ] T029 [US3] Startseite `src/app/verwaltung/page.tsx` erweitern: offene Mängel und offene „Kontrolle fehlt“-Einträge aller Firmen mit Firmenname, Fahrzeug, Fahrer, Zeit
- [ ] T030 [US3] Mangel-Detail `src/app/verwaltung/[firmaId]/maengel/[id]/page.tsx` mit Foto (signierte URL), Beschreibung, Fahrzeug, Fahrer, Zeit; Formular „Behoben“ mit Pflicht-Vermerk
- [ ] T031 [US3] Server Action `mangelSchliessen` in `src/app/verwaltung/[firmaId]/maengel/[id]/actions.ts` ruft `mangel_schliessen`
- [ ] T032 [US3] Verlauf geschlossener Mängel je Fahrzeug in `src/app/verwaltung/[firmaId]/page.tsx` (FR-015)
- [ ] T033 [P] [US3] Fälligkeit in `src/lib/kontrolle/regeln.ts` ergänzen: `istFaellig(einstellungen, jetzt)` mit Zeitzone Europe/Berlin, plus Tests in `regeln.test.ts`
- [ ] T034 [US3] Einstellungsseite `src/app/verwaltung/[firmaId]/einstellungen/page.tsx` und `actions.ts`: Wochentage (Mo–So Haken) und Uhrzeit; nur für Verkehrsleiter bearbeitbar, Unternehmer sieht sie lesend
- [ ] T035 [US3] SQL-Funktion `fehlende_kontrollen_pruefen()` und Migration `supabase/migrations/0005_zeitplaene.sql`: pg_cron alle 15 Min., danach pg_net-Aufruf von `POST {APP_URL}/api/benachrichtigungen` mit Geheimnis aus Supabase Vault
- [ ] T036 [US3] Route `src/app/api/benachrichtigungen/route.ts`: prüft `Authorization: Bearer ${BENACHRICHTIGUNG_GEHEIMNIS}`, verschickt ungemailte `kontrolle_fehlt` (eine Mail je Firma und Tag, Vorlage aus contracts) und noch ungemailte Mängel, setzt `gemailt_am`

**Checkpoint**: Verkehrsleiter hat den vollständigen Überblick

---

## Phase 6: User Story 4 - Verkehrsleiter passt Prüfpunkte je Fahrzeugart an (Priority: P2)

**Goal**: Fahrzeugarten und Prüfpunkte pflegen, nur durch den Verkehrsleiter

**Independent Test**: quickstart Szenario 5

- [ ] T037 [US4] Seite `src/app/verwaltung/[firmaId]/fahrzeugarten/page.tsx`: Fahrzeugarten mit Prüfpunkten je Abschnitt; Unternehmer sieht alles nur lesend
- [ ] T038 [US4] Server Actions in `src/app/verwaltung/[firmaId]/fahrzeugarten/actions.ts`: `fahrzeugartAnlegen`, `pruefpunktSpeichern` (Frage, Abschnitt, Mangel bei Ja/Nein, Bedingung), `pruefpunktAusblenden`, `pruefpunkteSortieren`
- [ ] T039 [US4] Fahrzeugart je Fahrzeug zuweisen (`fahrzeugartZuweisen`) im Fahrzeug-Bereich von `src/app/verwaltung/[firmaId]/page.tsx` und in `src/app/verwaltung/actions.ts`

**Checkpoint**: Tankzug-Prüfpunkte möglich

---

## Phase 7: User Story 5 - Nachweis für Prüfungen exportieren (Priority: P3)

**Goal**: Kontrollen filtern und als PDF sichern

**Independent Test**: quickstart Szenario 8

- [ ] T040 [US5] Liste `src/app/verwaltung/[firmaId]/kontrollen/page.tsx` mit Filtern Fahrzeug, Fahrer, Zeitraum (Query-Parameter) und Detailseite `src/app/verwaltung/[firmaId]/kontrollen/[id]/page.tsx` (alle Antworten, Fotos, Unterschrift, Fristen)
- [ ] T041 [US5] Druckansicht `src/app/verwaltung/[firmaId]/kontrollen/druck/page.tsx` mit Druck-CSS (eine Kontrolle pro Seitenbereich, Fotos verkleinert) und Knopf „Als PDF sichern“ (`window.print()`)

---

## Phase 8: Polish & Querschnitt

- [ ] T042 Entwurf ohne Netz in `src/lib/kontrolle/entwurf.ts` (localStorage für Antworten, IndexedDB für Fotos/Unterschrift) und Anzeige „Noch nicht übertragen“ mit erneutem Senden bei `online` in `KontrollAblauf.tsx` und `src/app/fahrer/page.tsx`
- [ ] T043 Route `src/app/api/aufraeumen/route.ts` und täglicher pg_cron-Job in `0005_zeitplaene.sql`: Kontrollen älter als 1 Jahr ohne offenen Mangel samt Storage-Dateien löschen (braucht `SUPABASE_SECRET_KEY`; darf in späteren Sprint)
- [ ] T044 [P] README-Abschnitt „Abfahrtskontrolle einrichten“ in `README.md` (Umgebungsvariablen, Custom SMTP, pg_cron)
- [ ] T045 Alle Szenarien aus `specs/001-abfahrtskontrolle/quickstart.md` auf dem Handy durchgehen; `npm run lint`, `npx tsc --noEmit`, `npm test`, `npm run build` grün

---

## Dependencies & Execution Order

- **Setup (T001–T004)** → **Foundational (T005–T016)** → Stories
- **US1** braucht nur Foundational. **US2** baut auf dem Ablauf aus US1 auf (T026 erweitert T020). **US3** braucht Kontrollen/Mängel (nach US2 sinnvoll, technisch nach Foundational möglich). **US4** und **US5** sind unabhängig von US2/US3.
- Reihenfolge der Lieferung: US1 → US2 → US3 → US4 → US5 → Polish

## Parallel Example

- Setup: T002, T003, T004 gleichzeitig nach T001
- Foundational: T014 + T015 parallel zur Migration (T005–T011)
- US1: T017 und T018 parallel, dann T019 → T020 → T021 → T022 → T023
- US2: T024, T025, T027 parallel, dann T026 → T028

## Implementation Strategy

1. **MVP (Sprint 1)**: Setup + Foundational + US1 + US2 → Fahrer kontrollieren, Mängel kommen per Mail. Demo auf dem Handy.
2. **Sprint 2**: US3 (Startseite, Mangel schließen, „Kontrolle fehlt“) + US4 (Tankzug).
3. **Sprint 3**: US5 (Export) + Polish (Offline, Aufräumen).

Vor Phase 4 müssen die SMTP-Zugangsdaten (Postfach noreply@kraftverkehr-groffik.de bei IONOS) von Damian in Vercel eingetragen sein.
