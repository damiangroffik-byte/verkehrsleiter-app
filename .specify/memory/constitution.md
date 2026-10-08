# Verkehrsleiter-App Constitution

## Core Principles

### I. Nachweisbarkeit zuerst
Die App dient der Haftungsentlastung des Verkehrsleiters. Jede Kontrolle,
Unterweisung, Mängelmeldung und Unterschrift wird mit Zeitpunkt, Person und
Inhalt unveränderbar gespeichert. Abgeschlossene Nachweise werden nicht
überschrieben; Korrekturen entstehen als neuer, verknüpfter Eintrag. Jeder
Nachweis ist als PDF exportierbar, damit er bei Prüfungen (BALM,
Gewerbeaufsicht, BG) vorgelegt werden kann.

### II. Mandantenfähig von Anfang an
Jede Firma ist ein abgetrennter Bereich. Jede fachliche Tabelle trägt eine
`firma_id`, und der Zugriff wird ausschließlich über Row-Level-Security-
Policies in der Datenbank geregelt, nie nur in der Oberfläche. Ein
Verkehrsleiter kann mehrere Firmen betreuen. Keine Funktion darf eine
einzelne Firma, deren Fahrzeuge oder Inhalte fest einbauen.

### III. Handy zuerst, einfach für Fahrer
Fahrer nutzen die App auf privaten Handys, oft draußen und unter Zeitdruck.
Oberflächen werden zuerst für 390 px Breite entworfen, Touch-Ziele sind
mindestens 44 px groß, Texte kurz und auf Deutsch. Eine Abfahrtskontrolle muss
in unter 3 Minuten erledigt sein. Fahrer sehen nur, was sie betrifft.

### IV. Datenschutz (DSGVO)
Daten werden in der EU gespeichert (Supabase Frankfurt). Kein Standort-
Tracking, kein Zugriff auf Kamera oder Fotos außer beim aktiven Aufnehmen.
Führerschein- und Personaldaten sehen nur Verwalter der eigenen Firma. Es
werden nur Daten erhoben, die für eine Pflicht des Verkehrsleiters nötig sind.

### V. Einfach halten
Nur bauen, was eine Spec verlangt. Bestehende Plattformfunktionen (Supabase
Auth, Storage, RLS; Next.js Server Actions) vor eigenen Lösungen. Neue
Abhängigkeiten brauchen eine Begründung im Plan.

## Technik und Qualität

- Stack: Next.js (App Router, Server Actions) als PWA, Supabase (Postgres,
  Auth per E-Mail-Code, Storage), Hosting auf Vercel.
- Jede Datenbankänderung ist eine Migration in `supabase/migrations/`, jede
  neue Tabelle mit RLS und Policies.
- Vor jedem Merge: `npm run lint`, `npx tsc --noEmit` und `npm run build`
  sind grün. Geschäftsregeln (z. B. Fristen, Mängel-Erkennung) bekommen
  automatisierte Tests.
- Markenfarben Blau #0F227B und Gelb #FFC947; Texte müssen den Kontrast
  4,5:1 erfüllen.

## Arbeitsweise (Scrum mit Spec Kit)

- Damian ist Product Owner: er priorisiert das Product Backlog (GitHub Issues
  und Projektboard) und nimmt Ergebnisse ab.
- Sprints dauern 1 Woche und enden mit einer Vorführung auf dem Handy.
- Jede Funktion durchläuft: Spec (`/speckit-specify`) → Freigabe durch den
  Product Owner → Plan → Aufgaben → Umsetzung als Pull Request → Prüfung durch
  einen Entwickler → Abnahme.
- Eine Spec beschreibt Verhalten und Abnahmekriterien in der Sprache des
  Verkehrsleiters, nicht die Technik.

## Governance

Diese Grundsätze gehen allen anderen Vorgaben vor. Änderungen werden in dieser
Datei mit neuer Version und Datum festgehalten und vom Product Owner
freigegeben. Pläne prüfen ausdrücklich, ob sie die Grundsätze einhalten;
Abweichungen müssen im Plan begründet werden.

**Version**: 1.0.0 | **Ratified**: 2026-10-06 | **Last Amended**: 2026-10-06
