# Schnittstellen: Abfahrtskontrolle

Die App hat keine öffentliche API. Verträge gibt es zwischen Oberfläche,
Server Actions, Datenbankfunktionen und zwei internen Routen.

## Seiten

| Pfad | Wer | Inhalt |
|---|---|---|
| `/fahrer` | Fahrer | Knopf „Abfahrtskontrolle starten“, eigene letzte Kontrollen, Status „noch nicht übertragen“ |
| `/fahrer/kontrolle` | Fahrer | Schritt 1 Fahrzeug + Anhänger wählen, Schritt 2 Prüfpunkte je Abschnitt, Schritt 3 Unterschrift + Einreichen, Bestätigung |
| `/verwaltung` | Verwalter | Startseite: offene Mängel und „Kontrolle fehlt“ aller Firmen, mit Firmenname |
| `/verwaltung/[firmaId]/maengel/[id]` | Verwalter | Mangel mit Foto, Beschreibung, Fahrzeug, Fahrer, Zeit; „Behoben“ mit Vermerk |
| `/verwaltung/[firmaId]/kontrollen` | Verwalter | Liste mit Filter Fahrzeug, Fahrer, Zeitraum; Detailansicht |
| `/verwaltung/[firmaId]/kontrollen/druck` | Verwalter | Druckansicht für PDF (gleiche Filter als Query) |
| `/verwaltung/[firmaId]/fahrzeugarten` | Verkehrsleiter | Fahrzeugarten und Prüfpunkte bearbeiten |
| `/verwaltung/[firmaId]/einstellungen` | Verkehrsleiter | Wochentage und Uhrzeit der fälligen Kontrolle |

Touch-Ziele ≥ 44 px, Ja/Nein als zwei große Knöpfe, Mangel-Antwort rot umrandet.

## Server Actions

- `kontrolleEinreichen(entwurf: KontrollEntwurf) → { ok: true, kontrolleId } | { ok: false, fehler, feld? }`
  ruft `kontrolle_einreichen`, verschickt danach bei Mängeln die Mail (Fehler beim Mailen bricht das Einreichen nicht ab; `gemailt_am` bleibt leer und die Benachrichtigungs-Route versucht es erneut).
- `mangelSchliessen(mangelId, vermerk)`
- `pruefpunktSpeichern(...)`, `pruefpunktAusblenden(id)`, `pruefpunkteSortieren(fahrzeugartId, ids[])`, `fahrzeugartAnlegen(firmaId, name)`, `fahrzeugartZuweisen(fahrzeugId, fahrzeugartId)`
- `einstellungenSpeichern(firmaId, wochentage[], bis)`

```ts
type KontrollEntwurf = {
  kontrolleId: string;          // crypto.randomUUID() im Browser
  firmaId: string;
  fahrzeugId: string;
  anhaengerId: string | null;
  durchgefuehrtAm: string;      // ISO, Zeitpunkt der Unterschrift
  unterschriftPfad: string;
  antworten: {
    pruefpunktId: string;
    antwortJa: boolean;
    bemerkung: string | null;
    fotoPfade: string[];
  }[];
};
```

## Interne Routen (nur mit Geheimnis)

- `POST /api/benachrichtigungen` — Header `Authorization: Bearer ${BENACHRICHTIGUNG_GEHEIMNIS}`. Verschickt offene Mails für `maengel` und `kontrolle_fehlt` mit `gemailt_am is null`, setzt `gemailt_am`. Antwort `{ gesendet: n }`.
- `POST /api/aufraeumen` — gleicher Schutz. Löscht Kontrollen > 1 Jahr ohne offenen Mangel inkl. Storage-Dateien. Antwort `{ geloescht: n }`.

Beide werden von pg_cron über pg_net aufgerufen; das Geheimnis liegt in Supabase Vault und als Vercel-Umgebungsvariable.

## E-Mails (Deutsch)

- **Mangel**: Betreff `Mangel: {Kennzeichen} – {Prüfpunkt}`; Inhalt Fahrer, Zeitpunkt, Prüfpunkt, Beschreibung, Link zum Foto (signiert, 7 Tage), Link „Mangel öffnen“.
- **Kontrolle fehlt**: Betreff `Abfahrtskontrolle fehlt: {Anzahl} Fahrer ({Firma})`; Liste der Fahrer, Link zur Startseite.

## Umgebungsvariablen (neu)

`SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORT`, `MAIL_ABSENDER`, `BENACHRICHTIGUNG_GEHEIMNIS`, `SUPABASE_SECRET_KEY` (nur Aufräumen), `NEXT_PUBLIC_APP_URL`. Werte trägt Damian selbst in Vercel ein.
