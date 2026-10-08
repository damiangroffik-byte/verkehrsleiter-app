# Implementation Plan: Abfahrtskontrolle mit Mängelmeldung

**Branch**: `001-abfahrtskontrolle` | **Date**: 2026-10-08 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/001-abfahrtskontrolle/spec.md`

## Summary

Fahrer führen die tägliche Abfahrtskontrolle auf dem Handy durch (Prüfpunkte je
Fahrzeugart, Ja/Nein, bei Mangel Pflicht-Foto und Beschreibung, Finger-Unterschrift).
Eingereichte Kontrollen werden über eine Datenbankfunktion unveränderbar
gespeichert, Mängel erzeugen sofort eine Mail an die Verkehrsleiter und eine offene
Aufgabe. Der Verkehrsleiter pflegt Checklisten und stellt ein, bis wann täglich
kontrolliert sein muss; fehlt eine Kontrolle, meldet pg_cron das. Fotos und
Unterschriften liegen in Supabase Storage. Export als Druckansicht.

## Technical Context

**Language/Version**: TypeScript 5, React 19.2, Node 20 (Vercel)

**Primary Dependencies**: Next.js 16.3 (App Router, Server Actions), `@supabase/ssr`, `@supabase/supabase-js`, Tailwind CSS 4. Neu: `nodemailer` (SMTP, siehe research R3), `vitest` (Dev, R10)

**Storage**: Supabase Postgres (Frankfurt) mit RLS; Supabase Storage (privater Bucket `kontrollen`); `pg_cron` + `pg_net` für zeitgesteuerte Prüfungen

**Testing**: `vitest` für Geschäftsregeln in `src/lib/kontrolle/`; SQL-Testskripte in `supabase/tests/` (Transaktion + Rollback); manuelle Szenarien in [quickstart.md](./quickstart.md)

**Target Platform**: PWA im mobilen Browser (iOS Safari, Android Chrome) für Fahrer; Desktop-Browser für Verwalter

**Project Type**: Web-Anwendung (ein Next.js-Projekt)

**Performance Goals**: Kontrolle ohne Mangel < 3 Min., mit Mangel < 5 Min. (SC-001); Mail < 2 Min. nach Einreichen (SC-002)

**Constraints**: Handy zuerst (390 px, Touch ≥ 44 px); Fotos vor Upload ≤ ~400 KB; funktioniert bei schlechtem Netz (Entwurf lokal); Daten nur in der EU; Vercel Hobby (Cron nur täglich, daher pg_cron)

**Scale/Scope**: Start: 1 Firma, 7 Fahrer, 6 Fahrzeuge, ~150 Kontrollen/Monat; ausgelegt für mehrere Firmen pro Verkehrsleiter

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Grundsatz | Prüfung | Ergebnis |
|---|---|---|
| I. Nachweisbarkeit | Kontrollen/Antworten ohne Update/Delete-Policy, Einreichen nur über Datenbankfunktion, Kopie der Fragen, Zeitpunkt + Unterschrift, Mangel-Schließen mit Name/Datum/Vermerk, PDF über Druckansicht | ✅ |
| II. Mandantenfähig | Jede neue Tabelle mit `firma_id` und RLS; Storage-Pfade beginnen mit `firma_id`; Standard-Checkliste aus globaler Vorlage, keine Firma fest eingebaut | ✅ |
| III. Handy zuerst | Fahrer-Ablauf in 3 Schritten, große Ja/Nein-Knöpfe, Kamera nur beim Antippen, Entwurf lokal | ✅ |
| IV. DSGVO | Supabase Frankfurt, IONOS-SMTP Deutschland, Kamera nur aktiv, Fotos privat mit signierten Links, Löschung nach 1 Jahr | ✅ |
| V. Einfach halten | Zwei neue Abhängigkeiten (`nodemailer`, `vitest`), begründet in research R3/R10; PDF ohne Bibliothek; kein Service Worker | ✅ |
| Technik: Migration + RLS, Lint/TS/Build grün, Tests für Geschäftsregeln | eingeplant | ✅ |

Re-Check nach Phase 1: unverändert ✅. Keine Abweichungen, daher keine Complexity Tracking-Einträge.

## Project Structure

### Documentation (this feature)

```text
specs/001-abfahrtskontrolle/
├── plan.md              # dieser Plan
├── research.md          # Entscheidungen R1–R10
├── data-model.md        # Tabellen, Policies, Funktionen
├── quickstart.md        # Prüfszenarien
├── contracts/
│   └── oberflaeche-und-schnittstellen.md
└── tasks.md             # folgt mit /speckit-tasks
```

### Source Code (repository root)

```text
supabase/
├── migrations/
│   ├── 0003_abfahrtskontrolle.sql        # Tabellen, RLS, Vorlage, Trigger, Funktionen
│   ├── 0004_kontrollen_storage.sql       # Bucket + Storage-Policies
│   └── 0005_zeitplaene.sql               # pg_cron/pg_net-Jobs
└── tests/
    └── abfahrtskontrolle.sql             # RLS- und Funktionstests (Rollback)

src/
├── lib/
│   ├── supabase/browser.ts               # neuer Browser-Client für Uploads
│   ├── kontrolle/
│   │   ├── regeln.ts                     # Sichtbarkeit, Mangel, Fälligkeit (rein)
│   │   ├── regeln.test.ts
│   │   ├── bild.ts                       # Foto verkleinern (Canvas)
│   │   └── entwurf.ts                    # localStorage/IndexedDB
│   └── mail.ts                           # nodemailer + Vorlagen
├── components/
│   ├── JaNein.tsx
│   ├── FotoAufnahme.tsx
│   └── Unterschrift.tsx
└── app/
    ├── fahrer/
    │   ├── page.tsx                      # erweitert
    │   └── kontrolle/{page.tsx, KontrollAblauf.tsx, actions.ts}
    ├── verwaltung/
    │   ├── page.tsx                      # Startseite: Mängel + fehlende Kontrollen
    │   └── [firmaId]/
    │       ├── maengel/[id]/{page.tsx, actions.ts}
    │       ├── kontrollen/{page.tsx, [id]/page.tsx, druck/page.tsx}
    │       ├── fahrzeugarten/{page.tsx, actions.ts}
    │       └── einstellungen/{page.tsx, actions.ts}
    └── api/
        ├── benachrichtigungen/route.ts
        └── aufraeumen/route.ts
```

**Structure Decision**: Ein Next.js-Projekt wie im Grundgerüst. Geschäftsregeln als reine Funktionen in `src/lib/kontrolle/` (testbar), Datenbankregeln in Migrationen, Seiten unter den bestehenden Bereichen `fahrer/` und `verwaltung/`.

## Umsetzungsreihenfolge (für /speckit-tasks)

1. Datenbank: Migration 0003 + 0004, SQL-Tests, Standard-Checkliste für bestehende Firmen.
2. US1 Fahrer-Ablauf ohne Mangel (Fahrzeugwahl, Prüfpunkte, Unterschrift, Einreichen).
3. US2 Mangel mit Foto + Mail (SMTP-Variablen müssen vorher in Vercel stehen).
4. US3 Startseite + Mangel schließen.
5. FR-018 Einstellungen + pg_cron „Kontrolle fehlt“ + Benachrichtigungs-Route.
6. US4 Fahrzeugarten und Prüfpunkte bearbeiten.
7. US5 Kontrollen-Liste + Druckansicht.
8. Kein-Netz-Entwurf; Aufräumen nach 1 Jahr (darf in späteren Sprint).

## Voraussetzungen von Damian

- Postfach `noreply@kraftverkehr-groffik.de` bei IONOS anlegen; Zugangsdaten in Vercel (SMTP-Variablen) und in Supabase Auth (Custom SMTP) eintragen.
- `SUPABASE_SECRET_KEY` erst für das Aufräumen (Schritt 8) in Vercel eintragen.

## Complexity Tracking

Keine Verstöße gegen die Grundsätze.
