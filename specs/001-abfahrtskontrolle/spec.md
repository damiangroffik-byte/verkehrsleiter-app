# Feature Specification: Abfahrtskontrolle mit Mängelmeldung

**Feature Branch**: `001-abfahrtskontrolle`

**Created**: 2026-10-06

**Status**: Draft (wartet auf Freigabe durch den Product Owner)

**Input**: Damians Konzept und seine bisherige Vorlage (Connecteam-PDF, Arbeitsanweisung KG-BKF 01): Fahrer führen vor jeder Fahrt eine Abfahrtskontrolle auf dem Handy durch. Meldet ein Fahrer einen Mangel, muss er ein Foto und eine Beschreibung abgeben; der Verkehrsleiter bekommt sofort eine E-Mail und eine Aufgabe auf seiner Startseite. Am Ende unterschreibt der Fahrer digital. Die Prüfpunkte sind je Fahrzeugart einstellbar (z. B. zusätzliche Punkte für Tankzüge).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Fahrer führt die tägliche Abfahrtskontrolle durch (Priority: P1)

Max ist Fahrer. Vor Fahrtantritt öffnet er die App auf seinem privaten Handy,
wählt sein Fahrzeug (und ggf. den Anhänger), beantwortet die Prüfpunkte mit
Ja oder Nein, unterschreibt mit dem Finger und reicht die Kontrolle ein.

**Why this priority**: Die tägliche Kontrolle ist Pflicht (§ 23 StVO,
§ 31 StVZO) und der häufigste Vorgang. Sie ersetzt Connecteam als Erstes.

**Independent Test**: Ein Fahrer reicht eine Kontrolle ohne Mängel ein; der
Verkehrsleiter sieht sie danach mit Datum, Uhrzeit, Fahrzeug, allen Antworten
und Unterschrift.

**Acceptance Scenarios**:

1. **Given** Max ist angemeldet und seiner Firma ist das Fahrzeug KN-XY 123 zugeordnet, **When** er eine Abfahrtskontrolle startet und das Fahrzeug wählt, **Then** sieht er die Prüfpunkte der Fahrzeugart dieses Fahrzeugs.
2. **Given** Max hat alle Pflichtpunkte beantwortet, **When** er unterschreibt und auf „Einreichen“ tippt, **Then** wird die Kontrolle gespeichert und er sieht eine Bestätigung.
3. **Given** ein Pflichtpunkt ist unbeantwortet oder die Unterschrift fehlt, **When** Max auf „Einreichen“ tippt, **Then** wird nicht eingereicht und der fehlende Punkt wird markiert.
4. **Given** das Fahrzeug hat HU, SP und Tacho-Prüfung hinterlegt, **When** Max die Kontrolle öffnet, **Then** sieht er diese Fristen nur zur Information (nicht zum Eintippen), abgelaufene rot markiert.

---

### User Story 2 - Fahrer meldet einen Mangel (Priority: P1)

Bei der Kontrolle stellt Max fest, dass die Beleuchtung beschädigt ist. Er
tippt die Antwort an, die einen Mangel bedeutet, macht ein Foto und schreibt
eine kurze Beschreibung.

**Why this priority**: Die Mängelmeldung ist der eigentliche Zweck für den
Verkehrsleiter: Er muss sofort wissen, wenn ein Fahrzeug nicht verkehrssicher
ist, und nachweisen können, dass er reagiert hat.

**Independent Test**: Ein Fahrer meldet einen Mangel mit Foto; innerhalb von
2 Minuten liegt beim Verkehrsleiter eine E-Mail mit Foto vor und auf seiner
Startseite steht eine offene Aufgabe.

**Acceptance Scenarios**:

1. **Given** bei einem Prüfpunkt ist „Ja“ als Mangel festgelegt (z. B. „Beleuchtung beschädigt?“), **When** Max „Ja“ antippt, **Then** erscheinen ein Pflicht-Foto und ein Pflicht-Beschreibungsfeld.
2. **Given** bei einem Prüfpunkt ist „Nein“ als Mangel festgelegt (z. B. „Bremsen in Ordnung?“ oder „EU-Lizenz an Bord?“), **When** Max „Nein“ antippt, **Then** erscheinen ebenfalls Pflicht-Foto und Beschreibung.
3. **Given** Max hat einen Mangel ohne Foto oder Beschreibung angegeben, **When** er einreichen will, **Then** wird die Einreichung verhindert und das Feld markiert.
4. **Given** Max reicht eine Kontrolle mit mindestens einem Mangel ein, **Then** erhalten alle Verkehrsleiter der Firma eine E-Mail mit Fahrzeug, Fahrer, Zeitpunkt, Prüfpunkt, Beschreibung und Foto, und auf ihrer Startseite entsteht je Mangel eine offene Aufgabe.
5. **Given** der Mangel betrifft die Verkehrssicherheit, **When** Max einreicht, **Then** sieht er den Hinweis, dass er die Fahrt erst nach Rücksprache mit Disposition oder Verkehrsleiter antreten darf (gemäß KG-BKF 01).

---

### User Story 3 - Verkehrsleiter erledigt gemeldete Mängel (Priority: P2)

Der Verkehrsleiter sieht auf seiner Startseite alle offenen Mängel aller
betreuten Firmen, öffnet einen Mangel mit Foto und hakt ihn nach Behebung mit
Datum und Vermerk ab.

**Why this priority**: Schließt den Nachweis: gemeldet, reagiert, behoben.

**Independent Test**: Ein gemeldeter Mangel erscheint als offene Aufgabe; nach
dem Abhaken verschwindet er aus den offenen Aufgaben und ist mit Vermerk,
Datum und Name im Verlauf des Fahrzeugs sichtbar.

**Acceptance Scenarios**:

1. **Given** es gibt einen offenen Mangel, **When** der Verkehrsleiter ihn öffnet, **Then** sieht er Foto, Beschreibung, Fahrzeug, Fahrer und Zeitpunkt.
2. **Given** ein offener Mangel, **When** der Verkehrsleiter „Behoben“ wählt und einen Vermerk einträgt, **Then** wird der Mangel mit Datum, Name und Vermerk geschlossen.
3. **Given** ein Verkehrsleiter betreut zwei Firmen, **When** er die Startseite öffnet, **Then** sieht er offene Mängel beider Firmen, jeweils mit Firmennamen.

---

### User Story 4 - Unternehmer passt Prüfpunkte je Fahrzeugart an (Priority: P2)

Der Unternehmer (oder Verkehrsleiter) legt Fahrzeugarten an, z. B.
„Planensattel“ und „Tankzug“, und bestimmt deren Prüfpunkte. Für den Tankzug
ergänzt er Domdeckel, Ventile, Schläuche und Erdungskabel.

**Why this priority**: Nötig für Fahrzeuge mit Sonderausrüstung und für den
späteren Verkauf an andere Firmen. Für den Start reicht eine Standardvorlage.

**Independent Test**: Für eine neue Fahrzeugart wird ein zusätzlicher
Prüfpunkt angelegt; ein Fahrer mit einem Fahrzeug dieser Art sieht ihn in der
nächsten Kontrolle, ein Fahrer mit anderem Fahrzeug nicht.

**Acceptance Scenarios**:

1. **Given** eine neue Firma, **When** sie angelegt wird, **Then** bekommt sie eine Standard-Checkliste nach Damians Vorlage (siehe Anhang A).
2. **Given** der Verwalter bearbeitet eine Fahrzeugart, **When** er einen Prüfpunkt hinzufügt, festlegt welche Antwort ein Mangel ist und speichert, **Then** gilt der Punkt für alle künftigen Kontrollen von Fahrzeugen dieser Art.
3. **Given** eine Checkliste wird geändert, **Then** bleiben bereits eingereichte Kontrollen unverändert und zeigen weiterhin die Fragen, die damals gestellt wurden.

---

### User Story 5 - Nachweis für Prüfungen exportieren (Priority: P3)

Der Verkehrsleiter wählt Firma, Fahrzeug oder Fahrer und einen Zeitraum und
lädt die Abfahrtskontrollen als PDF herunter.

**Why this priority**: Wichtig für BALM- oder BG-Prüfungen, aber nicht täglich
nötig.

**Independent Test**: Export eines Monats für ein Fahrzeug ergibt ein PDF mit
allen Kontrollen inklusive Antworten, Mängeln, Fotos und Unterschriften.

**Acceptance Scenarios**:

1. **Given** im Oktober wurden 20 Kontrollen für KN-XY 123 eingereicht, **When** der Verkehrsleiter Oktober und dieses Fahrzeug exportiert, **Then** enthält das PDF alle 20 Kontrollen in zeitlicher Reihenfolge.

---

### Edge Cases

- Fahrer hat kein Netz: Die Kontrolle bleibt auf dem Handy erhalten und wird gesendet, sobald wieder Verbindung besteht; der Fahrer sieht, dass sie noch nicht übertragen ist.
- Fahrer startet eine zweite Kontrolle für dasselbe Fahrzeug am selben Tag (z. B. Fahrzeugwechsel zurück): erlaubt, beide werden gespeichert.
- Fahrzeug ist abgelaufen (HU/SP/Tacho): Der Fahrer sieht eine rote Warnung; der Verkehrsleiter bekommt eine Aufgabe, falls noch keine offen ist.
- Foto ist sehr groß: Es wird vor dem Hochladen verkleinert, ohne dass Details eines Mangels unlesbar werden.
- Fahrer gehört zu keiner Firma oder hat kein Fahrzeug: Er sieht einen Hinweis, sich an den Verkehrsleiter zu wenden.
- Fahrer hat an einem Arbeitstag keine Kontrolle eingereicht: siehe FR-018.

## Requirements *(mandatory)*

### Functional Requirements

**Durchführung (Fahrer)**

- **FR-001**: Fahrer MÜSSEN eine Abfahrtskontrolle für ein Fahrzeug ihrer Firma starten können; optional wählen sie einen gekoppelten Anhänger.
- **FR-002**: Das System MUSS die Prüfpunkte aus der Checkliste der Fahrzeugart des gewählten Fahrzeugs anzeigen, gruppiert in Abschnitte (Anhang A).
- **FR-003**: Jeder Prüfpunkt MUSS mit „Ja“ oder „Nein“ beantwortet werden; je Prüfpunkt ist festgelegt, welche Antwort ein Mangel ist.
- **FR-004**: Bei einer Mangel-Antwort MÜSSEN ein Foto (Kamera des Handys) und eine Beschreibung Pflicht sein.
- **FR-005**: Fahrer MÜSSEN bei jedem Prüfpunkt freiwillig ein Foto und eine Bemerkung ergänzen können.
- **FR-006**: Der Abschnitt „Gefahrgut (ADR)“ MUSS nur bei Fahrzeugen erscheinen, die als ADR-Fahrzeug hinterlegt sind.
- **FR-007**: Der Prüfpunkt „Dokumente Anhänger“ (Zulassungsbescheinigung Teil I des Anhängers) MUSS nur erscheinen, wenn ein Anhänger gewählt wurde.
- **FR-008**: Reifenfotos (alle Reifen) MÜSSEN nur einmal pro Kalendermonat und Fahrzeug verlangt werden.
- **FR-009**: HU, SP und Tacho-Prüfung MÜSSEN aus den Fahrzeugdaten angezeigt werden und dürfen vom Fahrer nicht eingegeben werden müssen; abgelaufene Fristen sind rot.
- **FR-010**: Vor dem Einreichen MUSS der Fahrer digital unterschreiben (Finger-Unterschrift); ohne Unterschrift ist kein Einreichen möglich.
- **FR-011**: Eine eingereichte Kontrolle MUSS unveränderbar gespeichert werden: Fahrer, Fahrzeug, Anhänger, Zeitpunkt, die damals gestellten Fragen, Antworten, Fotos, Bemerkungen und Unterschrift.

**Mängel (Verkehrsleiter)**

- **FR-012**: Bei jeder eingereichten Kontrolle mit Mangel MUSS das System sofort eine E-Mail an alle Verkehrsleiter der Firma senden, mit Fahrzeug, Fahrer, Zeitpunkt, Prüfpunkt, Beschreibung und Foto.
- **FR-013**: Je Mangel MUSS eine offene Aufgabe auf der Startseite der Verwalter der Firma entstehen.
- **FR-014**: Verwalter MÜSSEN einen Mangel als behoben schließen können, mit Pflicht-Vermerk; das System speichert Datum und Namen.
- **FR-015**: Geschlossene Mängel MÜSSEN im Verlauf des Fahrzeugs sichtbar bleiben.

**Checklisten (Verwalter)**

- **FR-016**: Verwalter MÜSSEN Fahrzeugarten anlegen und jedem Fahrzeug eine Art zuweisen können.
- **FR-017**: Verwalter MÜSSEN je Fahrzeugart Prüfpunkte hinzufügen, umbenennen, ausblenden und sortieren sowie die Mangel-Antwort festlegen können. Neue Firmen erhalten die Standardvorlage aus Anhang A.

**Übersicht und Nachweis**

- **FR-018**: Die Startseite des Verwalters MUSS zeigen, für welche aktiven Fahrzeuge am Vortag keine Abfahrtskontrolle eingereicht wurde. [NEEDS CLARIFICATION: Gilt das an jedem Werktag (Mo–Fr), Mo–Sa, oder nur an Tagen, an denen das Fahrzeug tatsächlich gefahren ist (später über Tacho-Daten)?]
- **FR-019**: Verwalter MÜSSEN alle Kontrollen nach Firma, Fahrzeug, Fahrer und Zeitraum filtern und als PDF exportieren können.
- **FR-020**: Fahrer MÜSSEN nur ihre eigenen Kontrollen sehen; Verwalter nur die ihrer Firmen.
- **FR-021**: Kontrollen und Fotos MÜSSEN aufbewahrt werden für [NEEDS CLARIFICATION: Wie lange? Vorschlag: 2 Jahre, danach automatisch löschen. Oder länger wegen möglicher Haftungsfälle?]

### Key Entities

- **Fahrzeugart**: Gruppe von Fahrzeugen mit gleicher Checkliste (z. B. Tankzug); gehört zu einer Firma.
- **Prüfpunkt**: Frage einer Checkliste mit Abschnitt, Reihenfolge, Mangel-Antwort (Ja oder Nein), Bedingung (nur ADR, nur mit Anhänger, monatlich).
- **Abfahrtskontrolle**: Eingereichte Kontrolle eines Fahrers für ein Fahrzeug (und ggf. Anhänger) zu einem Zeitpunkt, mit Unterschrift.
- **Antwort**: Antwort auf einen Prüfpunkt innerhalb einer Kontrolle, mit Kopie des Fragetextes, optionalem Foto und Bemerkung.
- **Mangel**: Aus einer Mangel-Antwort entstehende Aufgabe mit Status offen oder behoben, Vermerk, Datum und Bearbeiter.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Ein Fahrer erledigt eine Kontrolle ohne Mängel in unter 3 Minuten, mit Mangel in unter 5 Minuten.
- **SC-002**: Die E-Mail zu einem Mangel liegt spätestens 2 Minuten nach dem Einreichen beim Verkehrsleiter vor.
- **SC-003**: Alle 7 Fahrer von Kraftverkehr Groffik führen in der ersten Testwoche ihre Kontrollen ohne Hilfe über die App durch.
- **SC-004**: Für jeden Tag und jedes Fahrzeug lässt sich innerhalb von 1 Minute nachweisen, ob kontrolliert wurde, und als PDF exportieren.
- **SC-005**: Connecteam wird für Abfahrtskontrollen nach der Testphase nicht mehr benötigt.

## Assumptions

- Fahrer und Fahrzeuge sind über das Grundgerüst (PR #1) angelegt.
- Fahrer nutzen aktuelle Android- oder iOS-Handys mit Kamera.
- E-Mails werden über einen Versanddienst mit Server in der EU verschickt.
- Push-Benachrichtigungen aufs Handy sind nicht Teil dieser Funktion (später möglich).
- Die Standardvorlage folgt Damians Connecteam-Vorlage, angepasst um die vereinbarten Dokumente.
- Verkehrsleiter und Unternehmer gelten beide als „Verwalter“ und dürfen Mängel schließen und Checklisten ändern. [NEEDS CLARIFICATION: Soll der Unternehmer auch Checklisten ändern dürfen, oder nur der Verkehrsleiter?]

## Anhang A: Standard-Checkliste

Mangel-Antwort in Klammern.

**1. Vor der Abfahrt**
- Führerschein gültig und dabei? (Nein)
- Fahrerqualifizierungsnachweis (FQN) dabei? (Nein)
- Fahrerkarte gesteckt? (Nein)
- ADR-Schein dabei? (Nein) – nur ADR
- Tachorolle vorhanden? (Nein)
- Zulassungsbescheinigung Teil I LKW dabei? (Nein)
- Zulassungsbescheinigung Teil I Anhänger dabei? (Nein) – nur mit Anhänger
- EU-Lizenz dabei? (Nein)
- Nachweis Güterschaden-Haftpflichtversicherung dabei? (Nein)

**2. Allgemein**
- Nachtrag durchgeführt? (Nein)
- Maut-Achsen eingestellt? (Nein)
- Diesel ausreichend? (Nein)
- AdBlue ausreichend? (Nein)
- Beförderungspapiere vollständig? (Nein)

**3. LKW**
- Reifen, Räder, Felgen beschädigt? (Ja) – monatlich zusätzlich Fotos aller Reifen
- Beleuchtung beschädigt? (Ja)
- Aufbau oder Führerhaus beschädigt? (Ja)
- Bremsen in Ordnung? (Nein)
- Ladungssicherung in Ordnung? (Nein)

**4. Sonstiges**
- Weitere Auffälligkeiten? (Ja)

**5. Gefahrgut (ADR)** – nur ADR-Fahrzeuge
- 2 Feuerlöscher à 6 kg vorhanden und Prüfdatum gültig? (Nein)
- Unterlegkeil vorhanden? (Nein)
- Zwei selbststehende Warnzeichen vorhanden? (Nein)
- Augenspülflüssigkeit vorhanden? (Nein)
- Warnweste je Besatzungsmitglied? (Nein)
- Leuchte vorhanden? (Nein)
- Schutzhandschuhe vorhanden? (Nein)
- Augenschutzbrille vorhanden? (Nein)
- Schaufel, Kanalabdeckung, Auffangbehälter vorhanden? (Nein)
