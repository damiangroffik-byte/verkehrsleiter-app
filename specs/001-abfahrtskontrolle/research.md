# Research: Abfahrtskontrolle mit Mängelmeldung

Stand 2026-10-08. Jede Entscheidung mit Begründung und verworfenen Alternativen.

## R1. Unveränderbare Speicherung (FR-011, Grundsatz I)

- **Decision**: Einreichen läuft über eine Datenbankfunktion `kontrolle_einreichen(...)` (security definer), die Kontrolle, Antworten und Mängel in einer Transaktion anlegt. Für `kontrollen` und `antworten` gibt es keine Update- oder Delete-Policy, auch nicht für Verwalter. Die Antwort speichert eine Kopie von Abschnitt, Fragetext und Mangel-Antwort.
- **Rationale**: Atomar (keine halben Kontrollen), Prüfung der Pflichtregeln in der Datenbank, Nachweis bleibt gleich, auch wenn die Checkliste später geändert wird (US4 Szenario 3).
- **Alternatives**: Mehrere Inserts aus der App (nicht atomar, Regeln nur im Client); Versionierung der Checklisten statt Kopie (mehr Tabellen, kein Mehrwert bei ~30 Fragen).

## R2. Fotos und Unterschrift

- **Decision**: Supabase Storage, privater Bucket `kontrollen`, Pfad `{firma_id}/{kontrolle_id}/{datei}`. Der Browser verkleinert Fotos vor dem Hochladen per Canvas auf max. 1600 px lange Kante, JPEG 0,8 (≈ 200–400 KB). Unterschrift als PNG aus einem Canvas. Hochladen direkt aus dem Browser mit der Sitzung des Fahrers; die Storage-Policy erlaubt Insert nur in Ordner der eigenen Firma, Lesen nur für Mitglieder (Fahrer nur eigene Kontrollen über die Kontroll-ID im Pfad, siehe data-model).
- **Rationale**: Server Actions haben ein Body-Limit (1 MB Standard); direkter Upload ist schneller auf dem Handy. Canvas-Verkleinerung braucht keine Abhängigkeit (Grundsatz V).
- **Alternatives**: Upload über Server Action mit erhöhtem `bodySizeLimit` (langsamer, Vercel-Limit 4,5 MB); Bibliothek für Bildkompression (unnötig).
- **Folge**: Neuer Browser-Client `src/lib/supabase/browser.ts` (`createBrowserClient` aus `@supabase/ssr`, bereits installiert).

## R3. E-Mails an den Verkehrsleiter (FR-012, FR-018a)

- **Decision**: Versand aus der App (Server) per SMTP über IONOS, Postfach `noreply@kraftverkehr-groffik.de`, mit `nodemailer`. Zugangsdaten als Vercel-Umgebungsvariablen (`SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORT`, `MAIL_ABSENDER`), von Damian selbst eingetragen. Dasselbe Postfach wird als Custom SMTP in Supabase Auth eingetragen (deutscher Anmeldecode, mehr als 2 Mails/Stunde).
- **Rationale**: Damians Mails liegen bereits bei IONOS (MX geprüft), Server in Deutschland, kein weiteres Konto. Ein Postfach für beide Zwecke.
- **Alternatives**: Resend/Brevo (zusätzliches Konto und DNS-Einträge); Supabase-Mailversand (nur für Auth-Mails nutzbar).
- **Neue Abhängigkeit**: `nodemailer` (+ `@types/nodemailer`). Begründung: SMTP selbst zu implementieren ist nicht sinnvoll.
- **Foto in der Mail**: als Link auf eine signierte URL (7 Tage gültig) statt Anhang, damit Mails klein bleiben; zusätzlich Link zur Mängelansicht in der App.

## R4. „Kontrolle fehlt“ zur eingestellten Uhrzeit (FR-018, FR-018a)

- **Decision**: `pg_cron` in Supabase ruft alle 15 Minuten die Funktion `fehlende_kontrollen_pruefen()` auf. Sie legt für jede Firma, deren Fälligkeit (Wochentag + Uhrzeit, Zeitzone Europe/Berlin) erreicht ist, je aktivem Fahrer ohne Kontrolle an diesem Tag einen Eintrag in `kontrolle_fehlt` an (eindeutig je Fahrer und Tag). Danach ruft `pg_net` die App-Route `POST /api/benachrichtigungen` mit geheimem Schlüssel auf; die Route verschickt alle noch nicht gemailten Einträge gesammelt je Firma (eine Mail pro Firma und Tag).
- **Rationale**: Vercel Hobby erlaubt Cron nur täglich und ungenau; die einstellbare Uhrzeit braucht feinere Abstände. pg_cron und pg_net sind im kostenlosen Supabase-Tarif enthalten.
- **Alternatives**: Vercel Cron (Hobby nur 1×/Tag); externer Cron-Dienst (weiteres Konto); Prüfung beim Öffnen der Startseite (keine Mail, wenn niemand schaut).
- **Erledigung**: `kontrolle_einreichen` setzt einen offenen Eintrag desselben Fahrers und Tages auf erledigt.

## R5. Wer darf was (Grundsatz II, Clarifications)

- **Decision**: Neue Hilfsfunktion `ist_verkehrsleiter(firma)`. Fahrzeugarten, Prüfpunkte und Firmen-Einstellungen: lesen alle Mitglieder (Fahrer brauchen die Prüfpunkte), schreiben nur Verkehrsleiter. Die bestehende Policy „Verwalter verwalten Fahrzeugarten“ wird auf Verkehrsleiter eingeschränkt. Mängel schließen: Verwalter (VL und Unternehmer). Kontrollen lesen: Verwalter der Firma und der Fahrer selbst.
- **Rationale**: Entspricht Damians Antwort „Unternehmer darf Checklisten nicht ändern“.

## R6. Standard-Checkliste für neue Firmen (US4 Szenario 1)

- **Decision**: Globale, nur lesbare Tabelle `vorlage_pruefpunkte` mit Anhang A. Ein Trigger nach dem Anlegen einer Firma legt die Fahrzeugart „Standard“ an und kopiert die Vorlage hinein. Die Migration macht dasselbe für bereits bestehende Firmen. Fahrzeuge ohne Fahrzeugart nutzen die Fahrzeugart „Standard“ ihrer Firma.
- **Alternatives**: Vorlage im Code (nicht änderbar ohne Deployment, schwer mandantenfähig).

## R7. Aufbewahrung 1 Jahr (FR-021)

- **Decision**: Tägliche Route `POST /api/aufraeumen` (ausgelöst von pg_cron über pg_net) löscht Kontrollen älter als 1 Jahr ohne offenen Mangel samt Storage-Dateien. Dafür braucht die Route den Supabase Secret Key als Umgebungsvariable (`SUPABASE_SECRET_KEY`), den Damian selbst in Vercel einträgt.
- **Rationale**: Storage-Dateien lassen sich nur über die Storage-API löschen, nicht per SQL.
- **Zeitpunkt**: Erste Löschung frühestens Oktober 2027. Umsetzung als letzte Aufgabe dieses Features (P3), darf in einen späteren Sprint rutschen.

## R8. Kein Netz (Edge Case)

- **Decision**: Entwurf (Antworten, Bemerkungen) wird laufend in `localStorage` gespeichert, Fotos und Unterschrift in IndexedDB (kleine eigene Hilfsfunktion, keine Abhängigkeit). Beim Einreichen ohne Netz zeigt die App „Noch nicht übertragen“ und versucht es beim nächsten Öffnen bzw. bei `online`-Ereignis erneut. Zeitpunkt der Kontrolle ist der Zeitpunkt des Unterschreibens (vom Handy), zusätzlich speichert der Server den Eingangszeitpunkt.
- **Alternatives**: Service Worker mit Background Sync (iOS-Unterstützung lückenhaft, mehr Komplexität).

## R9. PDF-Export (FR-019, US5)

- **Decision**: Druckansicht `/verwaltung/[firmaId]/kontrollen/druck?…` mit Druck-CSS; der Verwalter nutzt „Drucken → Als PDF sichern“ des Browsers. Fotos als verkleinerte Bilder, Unterschrift als Bild.
- **Rationale**: Keine Abhängigkeit, funktioniert am PC zuverlässig, Grundsatz V.
- **Alternatives**: `@react-pdf/renderer` oder Puppeteer (große Abhängigkeiten, Serverless-Limits). Bei Bedarf später.

## R10. Tests (Technik und Qualität)

- **Decision**: `vitest` für reine Geschäftsregeln in `src/lib/kontrolle/` (Mangel-Erkennung, Sichtbarkeit von Prüfpunkten nach ADR/Anhänger/Monat, Fälligkeit nach Wochentag und Uhrzeit). Datenbankregeln (RLS, `kontrolle_einreichen`) werden mit SQL-Testskripten in `supabase/tests/` geprüft, die in einer Transaktion laufen und zurückrollen (wie beim Grundgerüst).
- **Neue Abhängigkeit**: `vitest` (nur Entwicklung).
