# Spezifikation: Führerscheinkontrolle

**Feature-Ordner**: `specs/002-fuehrerschein`
**Erstellt**: 2026-10-09
**Status**: Sprint 1 gebaut, Abnahme durch Damian (Product Owner) beim Test

## Ziel

Der Halter muss regelmäßig prüfen, ob seine Fahrer eine gültige Fahrerlaubnis
haben (§ 21 StVG). Die App ersetzt die Papierliste: Der Fahrer fotografiert
seinen Führerschein, der Verkehrsleiter prüft die Fotos und bestätigt mit Name
und Zeitpunkt. Der Nachweis bleibt gespeichert.

## User Stories

### US1 – Fahrer reicht seinen Führerschein ein (P1)

Als Fahrer öffne ich „Führerschein“, fotografiere Vorder- und Rückseite, wähle
meine Klassen und trage ein, bis wann Klasse C/CE gilt (und Code 95, falls
vorhanden). Danach sehe ich „Wartet auf Prüfung“.

**Abnahme**
1. Ohne beide Fotos, ohne Klasse oder ohne Ablaufdatum lässt sich nichts absenden; die App sagt, was fehlt.
2. Nach dem Absenden sieht der Fahrer den Status auf seiner Startseite.
3. Reicht der Fahrer erneut ein, während eine Prüfung offen ist, ersetzt die neue Einreichung die alte.

### US2 – Verkehrsleiter prüft und bestätigt (P1)

Als Verkehrsleiter sehe ich in meiner Firma, welche Führerscheine auf Prüfung
warten, öffne die Fotos und tippe „Bestätigen“ oder „Ablehnen“ (mit Grund).

**Abnahme**
1. Bestätigung speichert, wer wann geprüft hat; das lässt sich nicht mehr ändern.
2. Bei Ablehnung ist ein Grund Pflicht; der Fahrer sieht ihn und muss neu einreichen.
3. Bei Einreichung bekommt der Verkehrsleiter eine Mail (wenn SMTP eingerichtet ist).

### US3 – Übersicht der Fristen (P1)

Als Verkehrsleiter sehe ich je Fahrer: letzte Prüfung, nächste Prüfung,
Ablauf Klasse C/CE und Code 95. Fällige oder bald fällige Einträge sind farbig.

**Abnahme**
1. Nächste Prüfung = letzte Bestätigung + Prüfabstand der Firma (Standard 6 Monate).
2. Fällig (rot): keine Bestätigung, Prüfung überfällig oder Fahrerlaubnis abgelaufen.
3. Bald (orange): innerhalb von 30 Tagen fällig oder ablaufend.

### Später (nicht in diesem Sprint)

- Erinnerungs-Mails (Prüfung fällig, Ablauf in 1 Monat) per pg_cron.
- Prüfabstand in den Firmen-Einstellungen ändern (Spalte ist vorhanden).
- Löschfristen nach Austritt des Fahrers.

### US4 – Klassen und Fristen automatisch lesen (P2, gebaut 2026-10-09)

Sobald beide Fotos da sind, liest Claude (Anthropic) Klassen, „gültig bis“ und
Code 95 von den Bildern und füllt leere Felder vor. Der Fahrer prüft und kann
korrigieren. Ohne `ANTHROPIC_API_KEY` in Vercel bleibt alles manuell.
Datenschutz: Die Fotos gehen dafür an Anthropic; das gehört in die
Datenschutzinfo für Fahrer.

### US5 – Texterkennung auf dem Handy ohne KI (P1, gebaut 2026-10-09)

Damian möchte nur fotografieren. Ohne KI-Schlüssel liest tesseract.js die
Fotos direkt im Browser; die Fotos verlassen das Handy dafür nicht, Programm und
Sprachdaten kommen von der eigenen Vercel-Adresse. Erkannte Werte werden
übernommen, der Fahrer vergleicht sie kurz. Echte Karten (Hologramm,
Spiegelungen) sind schwerer zu lesen als die Testbilder.

## Regeln

- Fotos liegen im privaten Bucket `fuehrerscheine`, nur Verwalter der Firma und der Fahrer selbst sehen sie.
- Eine Prüfung ist nach dem Einreichen unveränderbar; nur der Status wechselt einmal von „eingereicht“ zu „bestätigt“, „abgelehnt“ oder „ersetzt“.
- Bestätigen oder ablehnen dürfen Verkehrsleiter und Unternehmer der Firma.
- Ein abgelaufener Führerschein kann eingereicht werden, wird aber rot markiert.
