-- Jährliche Unterweisungen für das Fahrpersonal: Blöcke mit Inhalt, Test (Lernzielkontrolle,
-- mindestens 80 %) und Unterschrift. Inhalte und Fragen sind global (wie die Prüfpunkt-Vorlage),
-- Teilnahmen gehören zur Firma. Die richtigen Antworten sieht niemand direkt, ausgewertet wird
-- ausschließlich in der Datenbank.
-- Unterschriften: Bucket unterweisungen, Pfad {firma_id}/{teilnahme_id}/unterschrift.png

create table public.unterweisungen (
  schluessel text primary key,
  titel text not null,
  kurz text not null,
  symbol text not null,
  reihenfolge int not null,
  dauer_min int not null,
  inhalt jsonb not null,
  version int not null default 1
);

alter table public.unterweisungen enable row level security;
create policy "Angemeldete sehen die Unterweisungen" on public.unterweisungen
  for select to authenticated using (true);

-- Ohne Lese-Policy: Fragen kommen über unterweisung_fragen_lesen (ohne Lösung).
create table public.unterweisung_fragen (
  id uuid primary key default gen_random_uuid(),
  unterweisung text not null references public.unterweisungen (schluessel) on delete cascade,
  nr int not null,
  frage text not null,
  antworten text[] not null check (cardinality(antworten) between 2 and 5),
  richtig smallint not null, -- 1 = erste Antwort
  check (richtig between 1 and cardinality(antworten)),
  unique (unterweisung, nr)
);

alter table public.unterweisung_fragen enable row level security;

-- Welche Blöcke eine Firma nutzt. Kein Eintrag heißt: aktiv.
create table public.firma_unterweisungen (
  firma_id uuid not null references public.firmen (id) on delete cascade,
  unterweisung text not null references public.unterweisungen (schluessel) on delete cascade,
  aktiv boolean not null,
  primary key (firma_id, unterweisung)
);

alter table public.firma_unterweisungen enable row level security;
create policy "Mitglieder sehen die Auswahl der Unterweisungen" on public.firma_unterweisungen
  for select using (public.ist_mitglied(firma_id));
create policy "Verkehrsleiter wählen Unterweisungen" on public.firma_unterweisungen
  for insert with check (public.ist_verkehrsleiter(firma_id));
create policy "Verkehrsleiter ändern die Auswahl" on public.firma_unterweisungen
  for update using (public.ist_verkehrsleiter(firma_id)) with check (public.ist_verkehrsleiter(firma_id));

-- Jeder Testversuch ist eine Zeile. Gültig ist eine Unterweisung, wenn der Test bestanden
-- und unterschrieben ist; gültig bis ein Jahr nach der Unterschrift.
create table public.unterweisung_teilnahmen (
  id uuid primary key,
  firma_id uuid not null references public.firmen (id) on delete cascade,
  fahrer_id uuid not null references public.fahrer (id) on delete cascade,
  unterweisung text not null references public.unterweisungen (schluessel),
  version int not null,
  titel text not null,
  durchgefuehrt_am timestamptz not null default now(),
  richtig int not null,
  gesamt int not null check (gesamt > 0),
  prozent int not null check (prozent between 0 and 100),
  bestanden boolean not null,
  antworten jsonb not null,
  unterschrift_pfad text,
  unterschrieben_am timestamptz,
  gueltig_bis date,
  check ((unterschrift_pfad is null) = (unterschrieben_am is null)),
  check ((unterschrieben_am is null) = (gueltig_bis is null)),
  check (unterschrift_pfad is null or bestanden)
);

create index on public.unterweisung_teilnahmen (firma_id, fahrer_id, unterweisung, durchgefuehrt_am desc);

alter table public.unterweisung_teilnahmen enable row level security;

-- Nur lesen; Schreiben ausschließlich über die Funktionen unten.
create policy "Verwalter und eigener Fahrer sehen Teilnahmen" on public.unterweisung_teilnahmen
  for select using (public.ist_verwalter(firma_id) or fahrer_id = public.eigener_fahrer(firma_id));

insert into public.unterweisungen (schluessel, titel, kurz, symbol, reihenfolge, dauer_min, inhalt) values
  ('arbeitsschutz', 'Arbeitssicherheit & Erste Hilfe', 'Pflichten, Erste Hilfe, Brandschutz, Heben', '✚', 1, 15,
   '[{"titel":"Deine Pflichten im Arbeitsschutz","punkte":["Du achtest auf deine eigene Sicherheit und Gesundheit und auf die deiner Kollegen.","Fahrzeuge, Geräte und Werkzeuge benutzt du nur so, wie sie gedacht sind, und nur, wenn du eingewiesen bist.","Schutzausrüstung (Sicherheitsschuhe, Warnweste, Handschuhe) trägst du dort, wo sie vorgeschrieben ist.","Mängel, Schäden und gefährliche Situationen meldest du sofort der Disposition oder deinem Vorgesetzten.","Kannst du eine Gefahr selbst sicher beseitigen, tust du das. Sonst sicherst du die Stelle ab und meldest sie.","Fragen zur Arbeitssicherheit klärst du mit dem Unternehmer bzw. Verkehrsleiter."]},{"titel":"Alkohol, Drogen, Medikamente","punkte":["Wer unter Alkohol, Drogen oder berauschenden Medikamenten steht, darf weder fahren noch Geräte bedienen.","Restalkohol baut sich nur langsam ab (etwa 0,1 Promille pro Stunde). Kaffee, Schlaf oder Duschen helfen nicht.","Bei Medikamenten den Beipackzettel lesen. Steht dort, dass sie die Reaktion beeinträchtigen: nicht fahren und Bescheid geben.","Merkst du, dass ein Kollege nicht fahrtüchtig ist, sprichst du ihn an und informierst den Vorgesetzten."]},{"titel":"Erste Hilfe und Notruf","punkte":["Notruf: 112 (Rettungsdienst und Feuerwehr), Polizei: 110. Das gilt in ganz Europa (112).","Beim Notruf sagst du: Wo ist es passiert? Was ist passiert? Wie viele Verletzte? Welche Verletzungen? Dann warten, ob die Leitstelle Fragen hat.","Erst Eigenschutz: Warnweste an, Unfallstelle absichern, dann helfen.","Der Verbandkasten liegt im Fahrzeug. Verbrauchtes oder abgelaufenes Material meldest du, damit es ersetzt wird.","Jeder Unfall und jede Verletzung, auch eine kleine, wird gemeldet und ins Verbandbuch eingetragen."]},{"titel":"Brandschutz","punkte":["Feuerlöscher müssen frei zugänglich und geprüft sein (Prüfplakette).","Brand melden, Menschen warnen, dann nur löschen, wenn es ohne Gefahr für dich möglich ist.","Mit dem Wind im Rücken löschen, Flächenbrände von vorn nach hinten, tropfende oder fließende Brände von oben nach unten. Brennendes Fett oder Öl nie mit Wasser löschen.","Beim Tanken und beim Umgang mit Gefahrgut gilt: Rauchen und offenes Feuer verboten."]},{"titel":"Heben, Tragen und Haut","punkte":["Lasten nah am Körper, aus den Knien heben, Rücken gerade halten. Nicht mit Last in der Hand den Oberkörper verdrehen.","Schwere oder sperrige Lasten nur mit Hilfsmitteln (Hubwagen, Elektro-Ameise) oder zu zweit bewegen.","Beim Ein- und Aussteigen die Haltegriffe nutzen (drei Punkte Kontakt) und nicht aus dem Fahrerhaus springen.","Bei Arbeiten mit Diesel, AdBlue, Öl oder Reinigern Schutzhandschuhe tragen. Einmalhandschuhe nur einmal benutzen.","Nach der Arbeit die Hände reinigen und eincremen, damit die Haut gesund bleibt."]}]'::jsonb),
  ('abfahrtskontrolle', 'Abfahrtskontrolle & Fahrzeug', 'Tägliche Kontrolle, Mängel, Bedienung nach Hersteller', '◎', 2, 10,
   '[{"titel":"Warum die Abfahrtskontrolle?","punkte":["Die Abfahrtskontrolle sorgt dafür, dass das Fahrzeug verkehrssicher ist. Mängel werden früh erkannt und Unfälle vermieden.","Als Fahrer bist du nach § 23 StVO dafür verantwortlich, dass Fahrzeug und Ladung vorschriftsmäßig sind."]},{"titel":"So läuft sie ab","punkte":["Täglich vor Fahrtantritt, bei jedem Fahrzeugwechsel neu.","Geprüft werden alle sicherheitsrelevanten Teile: Reifen, Beleuchtung, Bremsen, Ladungssicherung, Ausrüstung und Papiere.","Die Kontrolle machst du vollständig in dieser App: Fahrzeug wählen, alle Punkte abarbeiten, unterschreiben und abschicken.","Die Zeit für die Kontrolle ist Arbeitszeit. Im Tachographen trägst du sie als „Arbeit“ (Hammer) ein, nicht als Pause."]},{"titel":"Wenn du einen Mangel findest","punkte":["Jeden Mangel trägst du in der App ein, mit kurzer Beschreibung und Foto. Der Verkehrsleiter wird sofort benachrichtigt.","Ist die Verkehrssicherheit beeinträchtigt (z. B. Bremse, Lenkung, Reifen, Licht), fährst du nicht los.","In diesem Fall informierst du sofort die Disposition oder den Verkehrsleiter, damit das Problem gelöst wird.","Das Büro sieht die eingereichten Kontrollen täglich durch und meldet sich bei Unklarheiten."]},{"titel":"Bedienung des LKW","punkte":["Die Betriebsanleitung des Herstellers muss im Fahrzeug sein. Bei Fragen schaust du dort nach.","Vor der ersten Fahrt mit einem neuen Fahrzeug machst du dich mit allen Bedienelementen und Assistenzsystemen vertraut.","Assistenzsysteme (ABS, ESP, Abstandsregler, Notbremsassistent) bedienst du nur nach Anleitung und schaltest sie nicht ab oder manipulierst sie.","Achslasten, zulässiges Gesamtgewicht und Anhängelast werden immer eingehalten.","Warnmeldungen im Display und Störungen meldest du sofort. Umbauten und Manipulationen sind verboten."]}]'::jsonb),
  ('ladungssicherung', 'Ladungssicherung', 'Material, Kräfte, Zurrgurte, Verantwortung', '▣', 3, 15,
   '[{"titel":"Ziel","punkte":["Die Ladung darf auch bei einer Vollbremsung oder einem plötzlichen Ausweichen nicht verrutschen, umkippen, herabfallen oder rollen (§ 22 StVO).","Gesichert wird nach den Regeln der VDI 2700 ff. Zusätzlich zur Unterweisung in der App gibt es eine praktische Einweisung."]},{"titel":"Kräfte auf die Ladung","punkte":["Beim Bremsen drückt die Ladung mit bis zu 80 % ihres Gewichts nach vorn.","In Kurven und beim Anfahren wirken nach der Seite und nach hinten bis zu 50 % des Gewichts.","Reibung allein hält die Ladung nicht. Antirutschmatten erhöhen die Reibung deutlich und sparen Zurrgurte.","Am besten ist formschlüssiges Laden: Ladung lückenlos an die Stirnwand und aneinander stellen, Lücken mit Klemmstangen oder Polstern schließen."]},{"titel":"Sicherungsmaterial","punkte":["Vor Fahrtantritt prüfst du, ob die vorgeschriebene Ausstattung an Bord und in Ordnung ist. Standard bei uns: 8 Zurrgurte, 3 Klemmstangen, Antirutschmatten, 10 Kantenschützer, 1 Zwischenwandverschluss, 1 Bordwandhalter mit Ratsche.","Fehlt Material oder ist es kaputt, meldest du das sofort und trägst es in der Abfahrtskontrolle ein.","Zurrgurte mit Schnitten, Rissen, beschädigten Nähten, verformten Ratschen oder ohne lesbares Etikett werden nicht mehr benutzt.","Auf dem Etikett stehen LC (zulässige Zurrkraft im geraden Zug) und STF (Vorspannkraft beim Niederzurren).","Gurte nicht knoten und nicht über scharfe Kanten führen. Kantenschutz schützt den Gurt und die Ladung."]},{"titel":"Verantwortung","punkte":["Der Verlader ist für die beförderungssichere Verladung verantwortlich (§ 412 HGB).","Du als Fahrer bist für die betriebs- und verkehrssichere Ladung verantwortlich (§ 23 StVO). Ist die Ladung nicht sicher, fährst du nicht los.","Nach Zwischenstopps, Teilentladungen und nach den ersten Kilometern prüfst du die Sicherung erneut und spannst Gurte nach.","Die Ladungssicherung bestätigst du in der Abfahrtskontrolle in der App."]}]'::jsonb),
  ('tacho', 'Tachograph, Lenk- und Ruhezeiten', 'Fahrerkarte, Nachträge, Lenkzeiten, Arbeitszeit', '◷', 4, 15,
   '[{"titel":"Fahrerkarte und Bedienung","punkte":["Die Fahrerkarte steckst du vor Fahrtbeginn und benutzt nur deine eigene Karte.","Vor Fahrtantritt prüfst du Uhrzeit, Land und den eingestellten Modus.","Du nutzt die richtigen Modi: Lenken, Arbeit (Hammer), Bereitschaft, Ruhezeit/Pause (Bett).","Tätigkeiten außerhalb des Fahrzeugs (z. B. Büro, Werkstatt, Urlaub) trägst du als manuellen Nachtrag ein.","Bei einer Kontrolle zeigst du Ausdrucke oder digitale Nachweise vor."]},{"titel":"Auslesen und Störungen","punkte":["Die Fahrerkarte wird spätestens alle 28 Tage ausgelesen, der Massenspeicher des Fahrzeugs spätestens alle 90 Tage.","Ist die Karte defekt, verloren oder gestohlen: sofort melden. Bis zur Ersatzkarte machst du zu Beginn und Ende jeder Fahrt einen Ausdruck und schreibst Name und Kartennummer darauf und unterschreibst ihn.","Manipulation am Tachographen oder an den Daten ist eine Straftat und strikt verboten."]},{"titel":"Lenk- und Ruhezeiten (VO (EG) 561/2006)","punkte":["Tägliche Lenkzeit höchstens 9 Stunden, zweimal pro Woche 10 Stunden.","Wöchentliche Lenkzeit höchstens 56 Stunden, in zwei aufeinanderfolgenden Wochen zusammen höchstens 90 Stunden.","Nach 4,5 Stunden Lenkzeit mindestens 45 Minuten Pause. Teilen geht nur so: erst mindestens 15, dann mindestens 30 Minuten.","Tägliche Ruhezeit mindestens 11 Stunden, höchstens dreimal zwischen zwei wöchentlichen Ruhezeiten auf 9 Stunden verkürzt.","Die regelmäßige wöchentliche Ruhezeit beträgt mindestens 45 Stunden."]},{"titel":"Arbeitszeit erfassen","punkte":["Deine Arbeitszeiten (Beginn, Pausen, Ende) erfasst du täglich.","Die Zeiten müssen mit dem Tachographen übereinstimmen. Abweichungen meldest du sofort im Büro.","Auch Be- und Entladen, Warten, Abfahrtskontrolle und Büroarbeit sind Arbeitszeit und werden erfasst.","Zusätzlich gilt das Arbeitszeitgesetz: Lenkzeit ist nur ein Teil deiner Arbeitszeit."]}]'::jsonb),
  ('gefahrgut', 'Gefahrgut (ADR, 1000 Punkte, LQ)', 'Was du ohne ADR-Schein fahren darfst', '⚠', 5, 15,
   '[{"titel":"Wofür diese Unterweisung gilt","punkte":["Sie ist Pflicht für alle, die Gefahrgut befördern, und wird mindestens einmal im Jahr wiederholt.","Ohne ADR-Bescheinigung darfst du Gefahrgut nur nach der 1000-Punkte-Regel (ADR 1.1.3.6) oder als begrenzte Menge (Limited Quantity, LQ) fahren.","Transporte über 1000 Punkte sind ohne gültige ADR-Bescheinigung verboten.","Du fährst nur Transporte, für die du zugelassen bist. Bist du unsicher, fragst du vor der Abfahrt nach."]},{"titel":"1000-Punkte-Regel","punkte":["Jeder Stoff gehört zu einer Beförderungskategorie. Die Menge wird mit einem Faktor multipliziert (Kategorie 1: × 50, Kategorie 2: × 3, Kategorie 3: × 1). Die Summe darf 1000 nicht überschreiten.","Auch unter 1000 Punkten gilt: Ladung richtig sichern, nur unbeschädigte und richtig gekennzeichnete Versandstücke mitnehmen.","Das Beförderungspapier muss mitgeführt werden. Bei uns liegen zusätzlich die schriftlichen Weisungen im Fahrzeug.","Mindestens ein Feuerlöscher (2 kg, für Brandklassen A, B, C) muss an Bord sein.","Beim Be- und Entladen und in der Nähe der Ladung gilt Rauch- und Feuerverbot."]},{"titel":"Limited Quantity (LQ)","punkte":["LQ sind kleine Innenverpackungen (z. B. Flaschen, Dosen) in festen Mengengrenzen. Ein Versandstück darf höchstens 30 kg brutto wiegen.","Erkennbar am LQ-Kennzeichen: eine auf die Spitze gestellte Raute, oben und unten schwarz, in der Mitte weiß, mindestens 100 × 100 mm.","Für LQ brauchst du kein Beförderungspapier, aber die Gesamtmenge muss bekannt sein.","Auch bei LQ gelten alle Sicherheits- und Sorgfaltspflichten. Du musst wissen, was du geladen hast."]},{"titel":"Ausrüstung und Verhalten im Notfall","punkte":["Die Gefahrgutausrüstung ist am LKW. Vor jedem Gefahrguttransport prüfst du sie auf Vollständigkeit und Funktion.","Beschädigte oder undichte Versandstücke nimmst du nicht an.","Bei Unfall, Leck oder Brand: eigene Sicherheit zuerst, Motor aus, Unfallstelle sichern, Feuerwehr (112) und Polizei rufen.","Keine riskanten Eigenmaßnahmen. Wenn möglich handelst du nach den schriftlichen Weisungen."]}]'::jsonb),
  ('ladebordwand_ameise', 'Ladebordwand & Elektro-Ameise', 'Hubladebühne und Niederhubwagen sicher nutzen', '▥', 6, 10,
   '[{"titel":"Ladebordwand (Hubladebühne)","punkte":["Nur unterwiesene und beauftragte Personen dürfen die Ladebordwand bedienen.","Vor der Benutzung: Sicht- und Funktionsprüfung (Hydraulik, Bedienelemente, Prüfplakette noch gültig).","Die zulässige Traglast wird nie überschritten.","Nicht von der Bühne springen. Auf- und Absteigen nur kontrolliert über die Absenkfunktion.","Abstand zu den Kanten halten, kein Hüpfen und keine ruckartigen Bewegungen. Bei Nässe, Eis und Schmutz besonders vorsichtig sein.","Niemand darf sich unter oder neben der Bühne im Gefahrenbereich aufhalten.","Mängel meldest du sofort. Eine mangelhafte Ladebordwand wird nicht benutzt."]},{"titel":"Elektro-Ameise (Niederhubwagen): wer darf","punkte":["Nur unterwiesene Personen ab 18 Jahren, körperlich und geistig geeignet.","Nie unter Alkohol, Drogen oder beeinträchtigenden Medikamenten."]},{"titel":"Elektro-Ameise: tägliche Prüfung","punkte":["Vor Arbeitsbeginn: Sichtprüfung auf Schäden, Funktion von Heben/Senken, Fahrantrieb, Deichsel und Not-Aus, Ladezustand der Batterie.","Bei einem Mangel: Gerät nicht benutzen und den Vorgesetzten informieren."]},{"titel":"Elektro-Ameise: sicheres Arbeiten","punkte":["Nur auf ebenem, festem Boden fahren. Tragfähigkeit beachten (bei uns 1200 kg).","Last gleichmäßig aufnehmen, langsam fahren, besonders auf Ladeflächen, Rampen und in engen Bereichen.","Hände und Füße aus dem Gefahrenbereich halten. Nicht an Kanten oder Bordwänden rangieren.","Verboten: Mitfahren, ruckartiges Fahren, Personen heben, Benutzen mit Mängeln, Ziehen oder Abschleppen."]}]'::jsonb),
  ('strassenverkehr', 'Sicher im Straßenverkehr & bei Unfällen', 'Ablenkung, Müdigkeit, Abbiegen, Unfallstelle', '▲', 7, 10,
   '[{"titel":"Aufmerksam fahren","punkte":["Das Handy ist während der Fahrt tabu. Telefonieren nur über die Freisprecheinrichtung, ohne das Gerät in die Hand zu nehmen.","Navigation und Telematik vor der Abfahrt einstellen, nicht während der Fahrt tippen.","Assistenzsysteme helfen, ersetzen aber nicht deine Aufmerksamkeit.","Bei Müdigkeit (Gähnen, schwere Augenlider, Spur halten fällt schwer) sofort an einem sicheren Ort anhalten und Pause machen. Sekundenschlaf kann tödlich sein."]},{"titel":"Abstand, Abbiegen, Rettungsgasse","punkte":["Auf der Autobahn halten LKW über 3,5 t bei mehr als 50 km/h mindestens 50 m Abstand zum Vordermann.","Innerorts biegst du mit einem LKW über 3,5 t nur mit Schrittgeschwindigkeit rechts ab, wenn mit Radfahrern oder Fußgängern zu rechnen ist.","Toter Winkel: Spiegel richtig einstellen, im Zweifel anhalten und warten. Abbiegeassistent nie als einzige Absicherung nutzen.","Bei Stau auf Autobahnen und mehrspurigen Straßen sofort eine Rettungsgasse bilden: zwischen ganz linker Spur und den anderen."]},{"titel":"Verhalten bei einem Unfall","punkte":["Warnblinker an, Warnweste anziehen, sicher aussteigen.","Warndreieck aufstellen: innerorts etwa 50 m, auf Landstraßen etwa 100 m, auf der Autobahn etwa 200 m vor der Unfallstelle.","Notruf 112 absetzen, Erste Hilfe leisten, dann Disposition oder Verkehrsleiter informieren.","Daten der Beteiligten und Zeugen aufnehmen, Fotos machen. Kein Schuldanerkenntnis unterschreiben."]},{"titel":"Belastende Ereignisse","punkte":["Ein schwerer Unfall, ein Überfall oder eine Bedrohung kann seelisch stark belasten, auch wenn man unverletzt ist.","Reden hilft: Sprich mit dem Vorgesetzten, Kollegen oder deinem Arzt. Die BG Verkehr bietet nach solchen Ereignissen schnelle psychologische Hilfe an.","Nach einem schweren Ereignis fährst du nicht einfach weiter, sondern meldest dich und bekommst Unterstützung."]}]'::jsonb);

insert into public.unterweisung_fragen (unterweisung, nr, frage, antworten, richtig) values
  ('arbeitsschutz', 1, 'Du bemerkst eine Gefahr, die du nicht selbst sicher beseitigen kannst. Was tust du?', array['Ich ignoriere sie, das ist nicht meine Aufgabe.', 'Ich sichere die Stelle ab und melde die Gefahr sofort.', 'Ich warte, bis jemand anderes es bemerkt.'], 2),
  ('arbeitsschutz', 2, 'Welche Notrufnummer erreicht in ganz Europa Rettungsdienst und Feuerwehr?', array['112', '110', '115'], 1),
  ('arbeitsschutz', 3, 'Was ist beim Notruf als Letztes wichtig?', array['Sofort auflegen, damit die Leitung frei ist.', 'Den eigenen Arbeitgeber nennen.', 'Warten, ob die Leitstelle noch Fragen hat.'], 3),
  ('arbeitsschutz', 4, 'Was kommt an einer Unfallstelle zuerst?', array['Eigenschutz: Warnweste an und Unfallstelle absichern.', 'Fotos für die Versicherung machen.', 'Den Verletzten sofort ins eigene Fahrzeug tragen.'], 1),
  ('arbeitsschutz', 5, 'Du hast dir beim Abladen leicht die Hand verletzt. Was tust du?', array['Nichts, ist ja nur klein.', 'Die Verletzung versorgen, melden und ins Verbandbuch eintragen lassen.', 'Erst am Monatsende Bescheid sagen.'], 2),
  ('arbeitsschutz', 6, 'Wie schnell baut der Körper Alkohol etwa ab?', array['Etwa 1 Promille pro Stunde', 'Etwa 0,5 Promille pro Stunde', 'Etwa 0,1 Promille pro Stunde'], 3),
  ('arbeitsschutz', 7, 'Hilft starker Kaffee gegen Restalkohol am Morgen?', array['Ja, danach darf ich fahren.', 'Nein, nur die Zeit baut Alkohol ab.', 'Ja, wenn ich zusätzlich dusche.'], 2),
  ('arbeitsschutz', 8, 'Wie hebst du eine schwere Last richtig?', array['Aus dem Rücken mit gestreckten Beinen.', 'Aus den Knien, Rücken gerade, Last nah am Körper.', 'Mit ausgestreckten Armen, damit die Last weit weg ist.'], 2),
  ('arbeitsschutz', 9, 'Wie steigst du sicher aus dem Fahrerhaus aus?', array['Rückwärts mit drei Punkten Kontakt über die Haltegriffe.', 'Mit einem Sprung nach vorn, das geht schneller.', 'Vorwärts mit den Händen in der Jackentasche.'], 1),
  ('arbeitsschutz', 10, 'Ein Feuerlöscher im Fahrzeug ist abgelaufen. Was machst du?', array['Nichts, er funktioniert bestimmt noch.', 'Ich melde es, damit er geprüft oder ersetzt wird.', 'Ich nehme ihn heraus, damit er nicht stört.'], 2),
  ('abfahrtskontrolle', 1, 'Wann machst du die Abfahrtskontrolle?', array['Einmal pro Woche am Montag.', 'Täglich vor Fahrtantritt und bei jedem Fahrzeugwechsel.', 'Nur wenn mir etwas komisch vorkommt.'], 2),
  ('abfahrtskontrolle', 2, 'Wie erfasst du die Zeit der Abfahrtskontrolle im Tachographen?', array['Als Pause.', 'Als Ruhezeit.', 'Als Arbeitszeit (Hammer).'], 3),
  ('abfahrtskontrolle', 3, 'Wer ist nach § 23 StVO für den vorschriftsmäßigen Zustand von Fahrzeug und Ladung verantwortlich?', array['Der Fahrer.', 'Nur die Werkstatt.', 'Der Kunde.'], 1),
  ('abfahrtskontrolle', 4, 'Bei der Kontrolle stellst du fest, dass die Bremse nicht richtig zieht. Was tust du?', array['Langsam losfahren und später melden.', 'Nicht losfahren, Mangel in der App eintragen und sofort Disposition bzw. Verkehrsleiter informieren.', 'Nur am Abend im Büro erwähnen.'], 2),
  ('abfahrtskontrolle', 5, 'Wie dokumentierst du die Abfahrtskontrolle?', array['Gar nicht, sie ist nur für mich.', 'Mündlich am Telefon.', 'Vollständig in der App mit Unterschrift.'], 3),
  ('abfahrtskontrolle', 6, 'Was gehört zu einer Mangelmeldung in der App?', array['Kurze Beschreibung und Foto des Mangels.', 'Nur ein Haken ohne Text.', 'Nichts, ein Anruf reicht.'], 1),
  ('abfahrtskontrolle', 7, 'Wo findest du verbindliche Angaben zu Reifendruck und Füllständen?', array['Im Internet-Forum.', 'In der Betriebsanleitung des Herstellers.', 'Ich schätze sie nach Gefühl.'], 2),
  ('abfahrtskontrolle', 8, 'Im Display erscheint eine rote Warnmeldung. Was tust du?', array['Ignorieren, sie geht von alleine weg.', 'Anhalten, wenn es sicher geht, Anleitung prüfen und sofort melden.', 'Die Sicherung ziehen, damit sie verschwindet.'], 2),
  ('abfahrtskontrolle', 9, 'Darfst du Assistenzsysteme wie den Notbremsassistenten manipulieren?', array['Ja, wenn sie mich stören.', 'Nein, Manipulationen sind verboten.', 'Ja, aber nur auf der Autobahn.'], 2),
  ('abfahrtskontrolle', 10, 'Was muss immer im Fahrzeug mitgeführt werden?', array['Die Betriebsanleitung des Herstellers.', 'Die Steuererklärung des Betriebs.', 'Der Wartungsvertrag der Werkstatt.'], 1),
  ('ladungssicherung', 1, 'Mit wie viel Prozent ihres Gewichts drückt die Ladung bei einer Vollbremsung etwa nach vorn?', array['20 %', '50 %', '80 %'], 3),
  ('ladungssicherung', 2, 'Welche Kraft wirkt etwa zur Seite, zum Beispiel in Kurven?', array['Bis zu 50 % des Ladungsgewichts.', 'Gar keine.', 'Das Doppelte des Ladungsgewichts.'], 1),
  ('ladungssicherung', 3, 'Was bewirken Antirutschmatten?', array['Sie schützen nur den Boden vor Kratzern.', 'Sie erhöhen die Reibung, dadurch braucht man weniger Zurrkraft.', 'Sie ersetzen jede andere Sicherung.'], 2),
  ('ladungssicherung', 4, 'Was bedeutet formschlüssiges Laden?', array['Die Ladung steht lückenlos an der Stirnwand und aneinander, Lücken sind ausgefüllt.', 'Die Ladung wird möglichst locker verteilt.', 'Die Ladung wird nur mit Folie umwickelt.'], 1),
  ('ladungssicherung', 5, 'Ein Zurrgurt hat einen Schnitt und das Etikett ist nicht mehr lesbar. Was tust du?', array['Ich benutze ihn trotzdem, doppelt hält besser.', 'Ich knote ihn an der Stelle.', 'Ich sortiere ihn aus und melde ihn.'], 3),
  ('ladungssicherung', 6, 'Was gibt die Angabe STF auf dem Gurt-Etikett an?', array['Die Vorspannkraft beim Niederzurren.', 'Das Herstellungsdatum.', 'Die Länge des Gurtes.'], 1),
  ('ladungssicherung', 7, 'Wozu dient der Kantenschutz?', array['Nur zur Dekoration.', 'Er schützt Gurt und Ladung an scharfen Kanten.', 'Er ersetzt die Antirutschmatte.'], 2),
  ('ladungssicherung', 8, 'Wer ist für die verkehrssichere Ladung während der Fahrt verantwortlich?', array['Nur der Kunde.', 'Der Fahrer.', 'Niemand.'], 2),
  ('ladungssicherung', 9, 'Was tust du, wenn Sicherungsmaterial fehlt?', array['Losfahren und hoffen.', 'Melden und in der Abfahrtskontrolle eintragen.', 'Material vom Kunden mitnehmen, ohne zu fragen.'], 2),
  ('ladungssicherung', 10, 'Wann prüfst du die Ladungssicherung erneut?', array['Nur einmal beim Beladen.', 'Nach Zwischenstopps, Teilentladungen und nach den ersten Kilometern.', 'Nur, wenn die Polizei kontrolliert.'], 2),
  ('tacho', 1, 'Wie lange darfst du täglich höchstens lenken (Regelfall)?', array['8 Stunden', '9 Stunden', '11 Stunden'], 2),
  ('tacho', 2, 'Wie oft pro Woche darfst du die tägliche Lenkzeit auf 10 Stunden verlängern?', array['Zweimal', 'Dreimal', 'Jeden Tag'], 1),
  ('tacho', 3, 'Wie viel darfst du in zwei aufeinanderfolgenden Wochen höchstens lenken?', array['56 Stunden', '112 Stunden', '90 Stunden'], 3),
  ('tacho', 4, 'Wann musst du spätestens eine Pause von 45 Minuten machen?', array['Nach 4,5 Stunden Lenkzeit.', 'Nach 6 Stunden Lenkzeit.', 'Erst am Ende des Tages.'], 1),
  ('tacho', 5, 'Wie darfst du die 45-Minuten-Pause aufteilen?', array['30 Minuten, danach 15 Minuten.', 'Erst mindestens 15 Minuten, dann mindestens 30 Minuten.', 'Dreimal 15 Minuten.'], 2),
  ('tacho', 6, 'Wie lang ist die regelmäßige tägliche Ruhezeit mindestens?', array['9 Stunden', '11 Stunden', '8 Stunden'], 2),
  ('tacho', 7, 'Wie oft muss die Fahrerkarte spätestens ausgelesen werden?', array['Alle 28 Tage', 'Alle 90 Tage', 'Einmal im Jahr'], 1),
  ('tacho', 8, 'Wie erfasst du eine Werkstattfahrt mit Wartezeit außerhalb des LKW ohne gesteckte Karte?', array['Gar nicht.', 'Als manuellen Nachtrag mit der richtigen Tätigkeit.', 'Als Ruhezeit, das ist einfacher.'], 2),
  ('tacho', 9, 'Deine Fahrerkarte ist defekt. Was gilt?', array['Ich fahre ohne Aufzeichnung weiter.', 'Ich benutze die Karte eines Kollegen.', 'Sofort melden und zu Beginn und Ende jeder Fahrt einen Ausdruck machen, beschriften und unterschreiben.'], 3),
  ('tacho', 10, 'Deine erfasste Arbeitszeit weicht vom Tachographen ab. Was tust du?', array['Nichts, das gleicht sich aus.', 'Ich melde die Abweichung sofort dem Büro.', 'Ich ändere die Tachodaten passend.'], 2),
  ('gefahrgut', 1, 'Was darfst du ohne ADR-Bescheinigung befördern?', array['Jede Menge Gefahrgut, wenn ich vorsichtig fahre.', 'Gefahrgut bis 1000 Punkte oder als begrenzte Menge (LQ).', 'Gar kein Gefahrgut, auch kein LQ.'], 2),
  ('gefahrgut', 2, 'Du sollst Gefahrgut mit 1200 Punkten laden und hast keinen ADR-Schein. Was tust du?', array['Ich fahre trotzdem, 200 Punkte fallen nicht auf.', 'Ich lade nicht und kläre es mit Disposition oder Verkehrsleiter.', 'Ich teile die Papiere auf zwei Tage auf.'], 2),
  ('gefahrgut', 3, 'Mit welchem Faktor zählen Stoffe der Beförderungskategorie 2?', array['× 3', '× 50', '× 1'], 1),
  ('gefahrgut', 4, 'Ein Versandstück mit Gefahrgut ist undicht. Was tust du?', array['Ich nehme es mit und stelle es nach hinten.', 'Ich klebe es zu und lade es.', 'Ich nehme es nicht an und melde es.'], 3),
  ('gefahrgut', 5, 'Welches Papier muss bei einem Transport nach der 1000-Punkte-Regel mit?', array['Das Beförderungspapier.', 'Kein Papier.', 'Nur die Rechnung.'], 1),
  ('gefahrgut', 6, 'Welcher Feuerlöscher muss mindestens an Bord sein?', array['Keiner, unter 1000 Punkten nicht nötig.', 'Ein 2-kg-Feuerlöscher für die Brandklassen A, B und C.', 'Ein Wassereimer.'], 2),
  ('gefahrgut', 7, 'Wie sieht das LQ-Kennzeichen aus?', array['Orangefarbene Tafel mit Nummern.', 'Ein rotes Dreieck.', 'Auf der Spitze stehende Raute, oben und unten schwarz, in der Mitte weiß.'], 3),
  ('gefahrgut', 8, 'Wie schwer darf ein LQ-Versandstück höchstens sein?', array['30 kg brutto', '100 kg brutto', 'Es gibt keine Grenze.'], 1),
  ('gefahrgut', 9, 'Was gilt beim Be- und Entladen von Gefahrgut?', array['Rauchen ist erlaubt, wenn ich Abstand halte.', 'Rauch- und Feuerverbot.', 'Nur E-Zigaretten sind verboten.'], 2),
  ('gefahrgut', 10, 'Was tust du bei einem Unfall mit Gefahrgut zuerst?', array['Eigene Sicherheit: Motor aus, Unfallstelle sichern, 112 rufen.', 'Den ausgelaufenen Stoff mit Wasser wegspülen.', 'Die Ladung schnell selbst umladen.'], 1),
  ('ladebordwand_ameise', 1, 'Wer darf die Ladebordwand bedienen?', array['Jeder, der gerade da ist.', 'Nur unterwiesene und beauftragte Personen.', 'Auch Kunden, wenn sie es eilig haben.'], 2),
  ('ladebordwand_ameise', 2, 'Was prüfst du vor der Benutzung der Ladebordwand?', array['Sicht- und Funktionsprüfung inklusive gültiger Prüfplakette.', 'Nichts, sie wurde ja schon einmal geprüft.', 'Nur die Farbe.'], 1),
  ('ladebordwand_ameise', 3, 'Wie verlässt du die Ladebordwand?', array['Ich springe herunter, das geht schneller.', 'Über die Absenkfunktion, kontrolliert absteigen.', 'Ich rutsche über die Kante.'], 2),
  ('ladebordwand_ameise', 4, 'Wo darf sich während der Bewegung der Ladebordwand niemand aufhalten?', array['Im Fahrerhaus.', 'Unter oder neben der Bühne im Gefahrenbereich.', 'Auf dem Gehweg gegenüber.'], 2),
  ('ladebordwand_ameise', 5, 'Die Ladebordwand verliert Hydrauliköl. Was tust du?', array['Weiter benutzen und später melden.', 'Nicht benutzen und sofort melden.', 'Öl mit einem Lappen abwischen und weitermachen.'], 2),
  ('ladebordwand_ameise', 6, 'Ab welchem Alter darf man die Elektro-Ameise bedienen?', array['Ab 16 Jahren', 'Ab 18 Jahren', 'Ab 21 Jahren'], 2),
  ('ladebordwand_ameise', 7, 'Was gehört zur täglichen Prüfung der Elektro-Ameise?', array['Nur der Ladezustand.', 'Sichtprüfung, Heben/Senken, Fahrantrieb, Deichsel, Not-Aus und Batterie.', 'Gar nichts, sie ist ja elektrisch.'], 2),
  ('ladebordwand_ameise', 8, 'Wie viel darf die Elektro-Ameise bei uns höchstens heben?', array['1200 kg', '2500 kg', 'So viel, wie sie schafft.'], 1),
  ('ladebordwand_ameise', 9, 'Was ist mit der Elektro-Ameise verboten?', array['Langsam auf der Ladefläche fahren.', 'Last gleichmäßig aufnehmen.', 'Einen Kollegen mitfahren lassen.'], 3),
  ('ladebordwand_ameise', 10, 'Darfst du mit der Elektro-Ameise einen Anhänger ziehen?', array['Ja, wenn er leicht ist.', 'Nein, sie ist kein Zug- oder Abschleppgerät.', 'Ja, aber nur auf dem Hof.'], 2),
  ('strassenverkehr', 1, 'Darfst du während der Fahrt das Handy in die Hand nehmen, um eine Nachricht zu lesen?', array['Ja, wenn ich langsam fahre.', 'Nein, das ist verboten.', 'Ja, an einer roten Ampel mit laufendem Motor.'], 2),
  ('strassenverkehr', 2, 'Du merkst, dass dir die Augen zufallen. Was tust du?', array['Fenster auf und weiterfahren bis zum Ziel.', 'Lauter Musik hören.', 'Sofort an einem sicheren Ort anhalten und Pause machen.'], 3),
  ('strassenverkehr', 3, 'Welchen Mindestabstand hältst du mit dem LKW auf der Autobahn bei mehr als 50 km/h?', array['50 m', '20 m', 'So viel wie ein PKW.'], 1),
  ('strassenverkehr', 4, 'Wie schnell biegst du innerorts mit einem LKW über 3,5 t rechts ab, wenn Radfahrer zu erwarten sind?', array['Mit 30 km/h', 'Mit Schrittgeschwindigkeit', 'So schnell wie erlaubt'], 2),
  ('strassenverkehr', 5, 'Wo bildest du auf einer dreispurigen Autobahn die Rettungsgasse?', array['Zwischen der mittleren und der rechten Spur.', 'Auf dem Standstreifen.', 'Zwischen der linken und der mittleren Spur.'], 3),
  ('strassenverkehr', 6, 'Was gilt für den Abbiegeassistenten?', array['Er ersetzt den Blick in die Spiegel.', 'Er hilft, ersetzt aber nicht meine Aufmerksamkeit.', 'Er darf abgeschaltet werden, wenn er piept.'], 2),
  ('strassenverkehr', 7, 'Wie weit vor der Unfallstelle stellst du das Warndreieck auf der Autobahn auf?', array['Etwa 200 m', 'Etwa 10 m', 'Direkt neben das Fahrzeug'], 1),
  ('strassenverkehr', 8, 'Was ziehst du an, bevor du nach einem Unfall auf die Fahrbahn gehst?', array['Nichts Besonderes.', 'Die Warnweste.', 'Die Arbeitshandschuhe.'], 2),
  ('strassenverkehr', 9, 'Was unterschreibst du an der Unfallstelle nicht?', array['Ein Schuldanerkenntnis.', 'Den Empfang des Warndreiecks.', 'Die Zeugenliste.'], 1),
  ('strassenverkehr', 10, 'Nach einem schweren Unfall fühlst du dich stark belastet. Was ist richtig?', array['Nichts sagen und weiterarbeiten.', 'Mit dem Vorgesetzten reden und Hilfe annehmen, z. B. über die BG Verkehr.', 'Allein damit fertigwerden, das gehört dazu.'], 2);

-- Fragen eines Blocks ohne Lösung.
create function public.unterweisung_fragen_lesen(u text)
returns jsonb language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object('id', q.id, 'nr', q.nr, 'frage', q.frage, 'antworten', to_jsonb(q.antworten)) order by q.nr), '[]')
  from public.unterweisung_fragen q
  where q.unterweisung = u and auth.uid() is not null;
$$;

-- Block für die Firma aktiv? (kein Eintrag = aktiv)
create function public.unterweisung_aktiv(f uuid, u text)
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce((select aktiv from public.firma_unterweisungen where firma_id = f and unterweisung = u), true);
$$;

-- Test auswerten und als Versuch speichern.
-- p: { teilnahmeId, firmaId, unterweisung, antworten: { <frage_id>: <1-basierte Antwort> } }
create function public.unterweisung_auswerten(p jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  t_id uuid := (p ->> 'teilnahmeId')::uuid;
  f_id uuid := (p ->> 'firmaId')::uuid;
  u_key text := p ->> 'unterweisung';
  gegeben jsonb := coalesce(p -> 'antworten', '{}'::jsonb);
  u public.unterweisungen;
  t public.unterweisung_teilnahmen;
  ich uuid;
  q record;
  wahl int;
  n_richtig int := 0;
  n_gesamt int := 0;
  falsch jsonb := '[]';
  protokoll jsonb := '[]';
begin
  if t_id is null or f_id is null or u_key is null then
    raise exception 'Der Test ist unvollständig.' using hint = 'entwurf';
  end if;

  ich := public.eigener_fahrer(f_id);
  if ich is null then
    raise exception 'Du bist in dieser Firma nicht als aktiver Fahrer eingetragen.' using hint = 'fahrer';
  end if;

  -- Erneutes Senden (z. B. nach Netzabbruch) liefert das frühere Ergebnis.
  select * into t from public.unterweisung_teilnahmen where id = t_id;
  if t.id is not null then
    if t.fahrer_id <> ich then
      raise exception 'Diesen Test gibt es schon.' using hint = 'entwurf';
    end if;
    return jsonb_build_object('teilnahme_id', t.id, 'richtig', t.richtig, 'gesamt', t.gesamt, 'prozent', t.prozent,
      'bestanden', t.bestanden,
      'falsch', (select coalesce(jsonb_agg(x -> 'id'), '[]') from jsonb_array_elements(t.antworten) x where not (x ->> 'richtig')::boolean));
  end if;

  select * into u from public.unterweisungen where schluessel = u_key;
  if u.schluessel is null or not public.unterweisung_aktiv(f_id, u_key) then
    raise exception 'Diese Unterweisung gibt es in deiner Firma nicht.' using hint = 'unterweisung';
  end if;

  for q in select * from public.unterweisung_fragen where unterweisung = u_key order by nr loop
    wahl := case when jsonb_typeof(gegeben -> q.id::text) = 'number' then (gegeben ->> q.id::text)::int end;
    if wahl is null or wahl < 1 or wahl > cardinality(q.antworten) then
      raise exception 'Bitte beantworte alle Fragen.' using hint = 'antworten';
    end if;
    n_gesamt := n_gesamt + 1;
    if wahl = q.richtig then
      n_richtig := n_richtig + 1;
    else
      falsch := falsch || to_jsonb(q.id);
    end if;
    protokoll := protokoll || jsonb_build_object('id', q.id, 'frage', q.frage, 'antwort', q.antworten[wahl], 'richtig', wahl = q.richtig);
  end loop;

  if n_gesamt = 0 then
    raise exception 'Für diese Unterweisung gibt es noch keine Fragen.' using hint = 'unterweisung';
  end if;

  insert into public.unterweisung_teilnahmen (id, firma_id, fahrer_id, unterweisung, version, titel, richtig, gesamt, prozent, bestanden, antworten)
  values (t_id, f_id, ich, u_key, u.version, u.titel, n_richtig, n_gesamt, floor(n_richtig * 100.0 / n_gesamt),
          n_richtig * 100 >= n_gesamt * 80, protokoll);

  return jsonb_build_object('teilnahme_id', t_id, 'richtig', n_richtig, 'gesamt', n_gesamt,
    'prozent', floor(n_richtig * 100.0 / n_gesamt), 'bestanden', n_richtig * 100 >= n_gesamt * 80, 'falsch', falsch);
end;
$$;

-- Hochladen der Unterschrift nur für einen eigenen, bestandenen, noch nicht unterschriebenen Test.
create function public.unterweisung_offen(t uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.unterweisung_teilnahmen x
    where x.id = t and x.bestanden and x.unterschrift_pfad is null
      and x.fahrer_id = public.eigener_fahrer(x.firma_id)
  );
$$;

create function public.unterweisung_unterschreiben(teilnahme uuid, pfad text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  t public.unterweisung_teilnahmen;
  bis date;
begin
  select * into t from public.unterweisung_teilnahmen where id = teilnahme;
  if t.id is null or t.fahrer_id is distinct from public.eigener_fahrer(t.firma_id) then
    raise exception 'Test nicht gefunden.' using hint = 'entwurf';
  end if;
  if t.unterschrieben_am is not null then
    return jsonb_build_object('gueltig_bis', t.gueltig_bis);
  end if;
  if not t.bestanden then
    raise exception 'Der Test ist nicht bestanden. Bitte wiederhole ihn.' using hint = 'test';
  end if;
  if pfad is null or left(pfad, length(t.firma_id::text || '/' || t.id::text || '/')) <> t.firma_id::text || '/' || t.id::text || '/'
     or not exists (select 1 from storage.objects o where o.bucket_id = 'unterweisungen' and o.name = pfad) then
    raise exception 'Bitte unterschreibe.' using hint = 'unterschrift';
  end if;

  bis := ((now() at time zone 'Europe/Berlin')::date + interval '1 year')::date;
  update public.unterweisung_teilnahmen
     set unterschrift_pfad = pfad, unterschrieben_am = now(), gueltig_bis = bis
   where id = teilnahme;
  return jsonb_build_object('gueltig_bis', bis);
end;
$$;

revoke execute on function public.unterweisung_fragen_lesen(text) from public, anon;
revoke execute on function public.unterweisung_aktiv(uuid, text) from public, anon;
revoke execute on function public.unterweisung_auswerten(jsonb) from public, anon;
revoke execute on function public.unterweisung_offen(uuid) from public, anon;
revoke execute on function public.unterweisung_unterschreiben(uuid, text) from public, anon;
grant execute on function public.unterweisung_fragen_lesen(text) to authenticated;
grant execute on function public.unterweisung_aktiv(uuid, text) to authenticated;
grant execute on function public.unterweisung_auswerten(jsonb) to authenticated;
grant execute on function public.unterweisung_offen(uuid) to authenticated;
grant execute on function public.unterweisung_unterschreiben(uuid, text) to authenticated;

-- Speicher für Unterschriften.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('unterweisungen', 'unterweisungen', false, 1048576, array['image/png'])
on conflict (id) do nothing;

create policy "Fahrer laden Unterweisungs-Unterschriften hoch" on storage.objects
  for insert to authenticated with check (
    bucket_id = 'unterweisungen'
    and public.eigener_fahrer(public.ordner_uuid(name, 1)) is not null
    and public.unterweisung_offen(public.ordner_uuid(name, 2))
  );

create policy "Verwalter und eigener Fahrer sehen Unterweisungs-Unterschriften" on storage.objects
  for select to authenticated using (
    bucket_id = 'unterweisungen'
    and (
      public.ist_verwalter(public.ordner_uuid(name, 1))
      or owner_id = (select auth.uid())::text
    )
  );
