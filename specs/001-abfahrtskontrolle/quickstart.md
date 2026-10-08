# Quickstart: Abfahrtskontrolle prüfen

So zeigt man, dass das Feature funktioniert. Details: [data-model.md](./data-model.md), [contracts](./contracts/oberflaeche-und-schnittstellen.md).

## Voraussetzungen

- Migrationen bis einschließlich Abfahrtskontrolle in Supabase angewendet, Bucket `kontrollen` vorhanden.
- Vercel-Variablen aus den contracts gesetzt; Custom SMTP (IONOS) in Supabase Auth eingetragen.
- Testfirma mit: 1 Verkehrsleiter, 1 Unternehmer, 2 Fahrern mit E-Mail, 1 LKW (ADR), 1 LKW (kein ADR), 1 Anhänger.

## Automatische Prüfungen

```bash
npm run lint && npx tsc --noEmit && npm test && npm run build
```

SQL-Tests (`supabase/tests/*.sql`) laufen in einer Transaktion und rollen zurück; erwartet: keine Fehlermeldung.

## Szenarien auf dem Handy (390 px)

1. **Kontrolle ohne Mangel (US1)**: Fahrer A meldet sich an, startet die Kontrolle, wählt den Nicht-ADR-LKW ohne Anhänger. Erwartet: kein Abschnitt „Gefahrgut“, kein Punkt „Zulassung Anhänger“, HU/SP/Tacho nur angezeigt. Alles ohne Mangel beantworten, unterschreiben, einreichen → Bestätigung. Stoppuhr: unter 3 Minuten.
2. **Pflichtfelder (US1-3)**: Einen Punkt offen lassen → Einreichen verhindert, Punkt markiert. Ohne Unterschrift → verhindert.
3. **Mangel (US2)**: ADR-LKW mit Anhänger wählen, „Beleuchtung beschädigt? Ja“ → Foto und Beschreibung werden Pflicht. Einreichen → Hinweis auf Rücksprache vor Fahrtantritt. Innerhalb von 2 Minuten Mail beim Verkehrsleiter, Mangel auf seiner Startseite.
4. **Mangel schließen (US3)**: Verkehrsleiter öffnet den Mangel, „Behoben“ ohne Vermerk → verhindert; mit Vermerk → verschwindet aus offenen Aufgaben, im Verlauf mit Datum und Name.
5. **Checkliste ändern (US4)**: Verkehrsleiter legt Fahrzeugart „Tankzug“ mit Punkt „Erdungskabel vorhanden?“ an und weist sie dem ADR-LKW zu. Fahrer sieht den Punkt nur bei diesem LKW. Alte Kontrolle zeigt weiter die alten Fragen. Unternehmer sieht die Seite Fahrzeugarten nur lesend.
6. **Kontrolle fehlt (FR-018)**: Einstellung auf „heute, aktuelle Uhrzeit + 15 Min.“ setzen. Fahrer B reicht nichts ein → nach spätestens 30 Min. Eintrag auf der Startseite und eine Mail. Fahrer B reicht danach ein → Eintrag erledigt.
7. **Mandantentrennung**: Zweite Firma mit eigenem Fahrer; dieser sieht keine Fahrzeuge, Kontrollen oder Fotos der ersten Firma (auch nicht über direkte Foto-URL).
8. **Export (US5)**: Kontrollen eines Monats für ein Fahrzeug filtern → Druckansicht → „Als PDF sichern“ enthält alle Kontrollen mit Fotos und Unterschrift.
9. **Kein Netz**: Flugmodus während Schritt 2, weiter ausfüllen, einreichen → „Noch nicht übertragen“; Netz an → wird übertragen.
