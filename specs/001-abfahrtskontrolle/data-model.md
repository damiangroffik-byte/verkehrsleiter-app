# Datenmodell: Abfahrtskontrolle

Alle Tabellen in `public`, alle mit `firma_id` und RLS (Grundsatz II). Bestehende
Tabellen aus `0001_grundgeruest.sql`: `firmen`, `mitgliedschaften`, `fahrer`,
`fahrzeugarten`, `fahrzeuge`.

## Neue Hilfsfunktion

- `ist_verkehrsleiter(f uuid) → boolean` (security definer, nur `authenticated`): Mitgliedschaft mit Rolle `verkehrsleiter`.
- `eigener_fahrer(f uuid) → uuid`: `fahrer.id` des angemeldeten Nutzers in Firma `f` oder `null`.

## vorlage_pruefpunkte (global, nur lesen)

| Feld | Typ | Hinweis |
|---|---|---|
| id | uuid PK | |
| abschnitt | text | „Vor der Abfahrt“, „Allgemein“, „LKW“, „Sonstiges“, „Gefahrgut (ADR)“ |
| reihenfolge | int | |
| frage | text | |
| mangel_bei_ja | boolean | `true`: „Ja“ ist Mangel; `false`: „Nein“ ist Mangel |
| bedingung | text check in (`immer`, `adr`, `anhaenger`) | |
| monatliche_fotos | boolean | Reifen: einmal pro Monat Fotos aller Reifen |

Inhalt: Anhang A der Spec. Kein `firma_id`, da firmenübergreifend; RLS: `select` für `authenticated`, kein Schreiben.

## pruefpunkte

Gleiche Felder wie die Vorlage plus `firma_id uuid not null`, `fahrzeugart_id uuid not null → fahrzeugarten`, `aktiv boolean default true` (Ausblenden statt Löschen, FR-017).

- RLS: `select` für Mitglieder der Firma; `insert/update` nur `ist_verkehrsleiter(firma_id)`; kein `delete`.
- Index `(fahrzeugart_id, abschnitt, reihenfolge)`.

## fahrzeugarten (bestehend, geändert)

- Policy „Verwalter verwalten Fahrzeugarten“ wird ersetzt durch „Verkehrsleiter verwalten Fahrzeugarten“ (`ist_verkehrsleiter`).
- Trigger auf `firmen` (after insert): Fahrzeugart „Standard“ anlegen und `vorlage_pruefpunkte` als `pruefpunkte` kopieren. Migration legt das auch für bestehende Firmen an.
- Fahrzeuge ohne `fahrzeugart_id` verwenden „Standard“.

## firma_einstellungen

| Feld | Typ | Standard |
|---|---|---|
| firma_id | uuid PK → firmen | |
| kontrolle_wochentage | smallint[] | `{1,2,3,4,5}` (ISO: 1 = Montag) |
| kontrolle_bis | time | `09:00` |
| zeitzone | text | `Europe/Berlin` |

- Zeile wird mit der Firma angelegt (Trigger).
- RLS: `select` für Verwalter; `update` nur `ist_verkehrsleiter`.

## kontrollen (unveränderbar)

| Feld | Typ | Hinweis |
|---|---|---|
| id | uuid PK | vom Client erzeugt (Fotopfade vor dem Einreichen) |
| firma_id | uuid → firmen | |
| fahrer_id | uuid → fahrer | muss `eigener_fahrer(firma_id)` sein |
| fahrzeug_id | uuid → fahrzeuge | Zugmaschine, `ist_anhaenger = false`, gleiche Firma |
| anhaenger_id | uuid → fahrzeuge, null | `ist_anhaenger = true`, gleiche Firma |
| durchgefuehrt_am | timestamptz | Zeitpunkt der Unterschrift (Handy) |
| eingegangen_am | timestamptz default now() | Server |
| unterschrift_pfad | text not null | Storage-Pfad PNG |
| fristen | jsonb | Kopie von HU/SP/Tacho zum Zeitpunkt der Kontrolle |
| hat_mangel | boolean | |

- RLS: `select` wenn `ist_verwalter(firma_id)` oder `fahrer_id = eigener_fahrer(firma_id)`. Kein `insert/update/delete` direkt; Einfügen nur über `kontrolle_einreichen`.
- Index `(firma_id, durchgefuehrt_am desc)`, `(fahrzeug_id, durchgefuehrt_am desc)`, `(fahrer_id, durchgefuehrt_am desc)`.

## antworten (unveränderbar)

| Feld | Typ | Hinweis |
|---|---|---|
| id | uuid PK | |
| firma_id | uuid | |
| kontrolle_id | uuid → kontrollen on delete cascade | |
| pruefpunkt_id | uuid → pruefpunkte, null | Verweis, kann später ausgeblendet sein |
| abschnitt, frage | text | Kopie |
| mangel_bei_ja | boolean | Kopie |
| monatliche_fotos | boolean | Kopie; zählt für „Reifenfotos diesen Monat erledigt“ |
| antwort_ja | boolean | |
| ist_mangel | boolean | `antwort_ja = mangel_bei_ja` |
| bemerkung | text null | Pflicht bei Mangel |
| foto_pfade | text[] | mind. 1 bei Mangel; bei `monatliche_fotos` ggf. mehrere |
| reihenfolge | int | |

- RLS wie `kontrollen` (über `kontrolle_id`).

## maengel

| Feld | Typ | Hinweis |
|---|---|---|
| id | uuid PK | |
| firma_id | uuid | |
| antwort_id | uuid → antworten unique | ein Mangel je Mangel-Antwort |
| kontrolle_id, fahrzeug_id | uuid | für Listen ohne Join |
| status | text check in (`offen`, `behoben`) default `offen` | |
| behoben_am | timestamptz null | |
| behoben_von | uuid → auth.users null | |
| vermerk | text null | Pflicht beim Schließen |
| gemailt_am | timestamptz null | Versand-Nachweis |

- Zustandsübergang: `offen → behoben`, nicht zurück. Nur über Funktion `mangel_schliessen(id, vermerk)` (prüft `ist_verwalter`, Vermerk nicht leer, setzt Datum und Bearbeiter).
- RLS: `select` für Verwalter und den meldenden Fahrer; kein direktes `update/delete`.

## kontrolle_fehlt

| Feld | Typ | Hinweis |
|---|---|---|
| id | uuid PK | |
| firma_id | uuid | |
| fahrer_id | uuid → fahrer | |
| datum | date | Tag in der Zeitzone der Firma |
| erledigt_durch | uuid → kontrollen null | spätere Kontrolle desselben Tages |
| gemailt_am | timestamptz null | |
| unique (fahrer_id, datum) | | |

- Angelegt nur von `fehlende_kontrollen_pruefen()` (pg_cron, alle 15 Min.). RLS: `select` für Verwalter.

## Storage: Bucket `kontrollen` (privat)

- Pfad `{firma_id}/{kontrolle_id}/{unterschrift.png | antwort-<n>-<m>.jpg}`.
- `insert`: angemeldet, erster Ordner ist eine Firma mit eigenem Fahrer-Datensatz.
- `select`: Verwalter der Firma (erster Ordner) oder Fahrer, dem die Kontrolle (zweiter Ordner) gehört.
- Kein `update/delete` (Löschen nur durch die Aufräum-Route mit Secret Key).

## Funktionen

- `kontrolle_einreichen(p jsonb) → jsonb` (security definer): prüft Fahrer, Fahrzeug, Anhänger, dass alle sichtbaren aktiven Prüfpunkte beantwortet sind, Mangel ⇒ Bemerkung + Foto, monatliche Reifenfotos falls in diesem Monat für das Fahrzeug noch keine vorliegen, Unterschrift vorhanden. Legt `kontrollen`, `antworten`, `maengel` an, erledigt `kontrolle_fehlt` des Tages. Rückgabe: `{kontrolle_id, maengel: [...], verkehrsleiter_emails: [...]}`.
- `mangel_schliessen(id uuid, vermerk text)`.
- `maengel_gemailt(ids uuid[])`: setzt `gemailt_am` (meldender Fahrer oder Verwalter).
- `reifenfotos_zuletzt(f uuid)`: letzte Reifenfotos je Fahrzeug der Firma, auch aus Kontrollen anderer Fahrer.
- `ordner_uuid(name, stufe)` und `kontrolle_offen(k)`: Hilfen für die Storage-Policies (Upload nur, solange die Kontrolle nicht eingereicht ist).
- `fehlende_kontrollen_pruefen()` (nur `postgres`, von pg_cron).

## Sichtbarkeit von Prüfpunkten (reine Logik, `src/lib/kontrolle/`)

- `adr`: nur wenn `fahrzeug.adr` oder `anhaenger.adr`.
- `anhaenger`: nur wenn ein Anhänger gewählt ist.
- `monatliche_fotos`: Fotos aller Reifen verlangt, wenn für dieses Fahrzeug im laufenden Kalendermonat noch keine Kontrolle mit diesen Fotos existiert.
