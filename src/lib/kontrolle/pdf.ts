import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFImage, type PDFPage } from "pdf-lib";

// PDF-Bericht einer eingereichten Abfahrtskontrolle (A4, Standardschrift).

export type BerichtAntwort = {
  abschnitt: string;
  frage: string;
  antwortJa: boolean;
  istMangel: boolean;
  bemerkung: string | null;
  fotos: Uint8Array[];
};

export type BerichtDaten = {
  firma: string;
  kennzeichen: string;
  anhaenger: string | null;
  fahrer: string;
  durchgefuehrtAm: string;
  eingegangenAm: string;
  fristen: { hu_faellig?: string | null; sp_faellig?: string | null; tacho_faellig?: string | null };
  antworten: BerichtAntwort[];
  unterschrift: Uint8Array | null;
};

const BLAU = rgb(15 / 255, 34 / 255, 123 / 255);
const ROT = rgb(180 / 255, 35 / 255, 24 / 255);
const GRUEN = rgb(46 / 255, 107 / 255, 63 / 255);
const GRAU = rgb(0.4, 0.4, 0.4);
const RAND = 48;
const BREITE = 595.28;
const HOEHE = 841.89;

function zeit(t: string) {
  return new Date(t).toLocaleString("de-DE", { timeZone: "Europe/Berlin", dateStyle: "medium", timeStyle: "short" }) + " Uhr";
}

function datum(d: string | null | undefined) {
  if (!d) return "–";
  const [j, m, t] = d.split("-");
  return `${t}.${m}.${j}`;
}

export async function kontrollePdf(d: BerichtDaten): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.setTitle(`Abfahrtskontrolle ${d.kennzeichen}`);
  const normal = await doc.embedFont(StandardFonts.Helvetica);
  const fett = await doc.embedFont(StandardFonts.HelveticaBold);

  // Die Standardschrift kann nur WinAnsi; alles andere (z. B. Emojis) wird ersetzt.
  const sauber = (s: string) =>
    Array.from(s.replace(/\s+/g, " "))
      .map((z) => {
        try {
          normal.encodeText(z);
          return z;
        } catch {
          return "?";
        }
      })
      .join("");

  let seite: PDFPage = doc.addPage([BREITE, HOEHE]);
  let y = HOEHE - RAND;

  const neueSeiteWennNoetig = (bedarf: number) => {
    if (y - bedarf < RAND) {
      seite = doc.addPage([BREITE, HOEHE]);
      y = HOEHE - RAND;
    }
  };

  const umbrechen = (text: string, schrift: PDFFont, groesse: number, breite: number) => {
    const zeilen: string[] = [];
    let zeile = "";
    for (const wort of sauber(text).split(" ")) {
      const probe = zeile ? `${zeile} ${wort}` : wort;
      if (schrift.widthOfTextAtSize(probe, groesse) <= breite || !zeile) zeile = probe;
      else {
        zeilen.push(zeile);
        zeile = wort;
      }
    }
    if (zeile) zeilen.push(zeile);
    return zeilen;
  };

  const text = (t: string, x: number, schrift = normal, groesse = 10, farbe = rgb(0, 0, 0)) =>
    seite.drawText(sauber(t), { x, y, size: groesse, font: schrift, color: farbe });

  // Kopf
  seite.drawRectangle({ x: 0, y: HOEHE - 84, width: BREITE, height: 84, color: BLAU });
  seite.drawRectangle({ x: 0, y: HOEHE - 90, width: BREITE, height: 6, color: rgb(1, 201 / 255, 71 / 255) });
  y = HOEHE - 44;
  text("Abfahrtskontrolle", RAND, fett, 20, rgb(1, 1, 1));
  y -= 22;
  text(d.firma, RAND, normal, 11, rgb(1, 1, 1));
  y = HOEHE - 120;

  const mangelZahl = d.antworten.filter((a) => a.istMangel).length;
  const zeilen: [string, string][] = [
    ["Fahrzeug", d.kennzeichen + (d.anhaenger ? ` mit Anhänger ${d.anhaenger}` : "")],
    ["Fahrer", d.fahrer],
    ["Durchgeführt", zeit(d.durchgefuehrtAm)],
    ["Eingegangen", zeit(d.eingegangenAm)],
    ["Fristen", `HU ${datum(d.fristen.hu_faellig)} · SP ${datum(d.fristen.sp_faellig)} · Tacho ${datum(d.fristen.tacho_faellig)}`],
  ];
  for (const [k, v] of zeilen) {
    text(k, RAND, normal, 10, GRAU);
    text(v, RAND + 90, fett, 10);
    y -= 16;
  }
  y -= 4;
  text(
    mangelZahl === 0 ? "Ergebnis: ohne Mangel" : `Ergebnis: ${mangelZahl} ${mangelZahl === 1 ? "Mangel" : "Mängel"} gemeldet`,
    RAND,
    fett,
    12,
    mangelZahl === 0 ? GRUEN : ROT,
  );
  y -= 24;

  // Prüfpunkte nach Abschnitt
  const spalteAntwort = BREITE - RAND - 90;
  const frageBreite = spalteAntwort - RAND - 12;
  let abschnitt = "";
  for (const a of d.antworten) {
    if (a.abschnitt !== abschnitt) {
      abschnitt = a.abschnitt;
      neueSeiteWennNoetig(40);
      y -= 6;
      text(abschnitt, RAND, fett, 12, BLAU);
      y -= 6;
      seite.drawLine({ start: { x: RAND, y }, end: { x: BREITE - RAND, y }, thickness: 0.5, color: GRAU });
      y -= 14;
    }
    const frage = umbrechen(a.frage, normal, 10, frageBreite);
    const bemerkung = a.bemerkung ? umbrechen(`Bemerkung: ${a.bemerkung}`, normal, 9, frageBreite) : [];
    neueSeiteWennNoetig(frage.length * 13 + bemerkung.length * 12 + 4);
    text(a.antwortJa ? "Ja" : "Nein", spalteAntwort, fett, 10);
    text(a.istMangel ? "MANGEL" : "in Ordnung", spalteAntwort + 32, fett, 9, a.istMangel ? ROT : GRUEN);
    for (const z of frage) {
      text(z, RAND, a.istMangel ? fett : normal, 10);
      y -= 13;
    }
    for (const z of bemerkung) {
      text(z, RAND + 10, normal, 9, a.istMangel ? ROT : GRAU);
      y -= 12;
    }
    y -= 4;
  }

  // Fotos der Mängel
  const mitFotos = d.antworten.filter((a) => a.istMangel && a.fotos.length > 0);
  if (mitFotos.length > 0) {
    neueSeiteWennNoetig(60);
    y -= 10;
    text("Fotos der Mängel", RAND, fett, 12, BLAU);
    y -= 16;
    for (const a of mitFotos) {
      const bilder: PDFImage[] = [];
      for (const f of a.fotos) {
        try {
          bilder.push(await doc.embedJpg(f));
        } catch {
          // Unlesbares Foto überspringen, der Bericht entsteht trotzdem.
        }
      }
      if (bilder.length === 0) continue;
      const titel = umbrechen(a.frage, fett, 10, BREITE - 2 * RAND);
      neueSeiteWennNoetig(titel.length * 13 + 170);
      for (const z of titel) {
        text(z, RAND, fett, 10);
        y -= 13;
      }
      let x = RAND;
      const hoehe = 160;
      y -= hoehe;
      for (const b of bilder) {
        const masse = b.scaleToFit(240, hoehe);
        if (x + masse.width > BREITE - RAND) {
          x = RAND;
          y -= 10;
          neueSeiteWennNoetig(hoehe);
          y -= hoehe;
        }
        seite.drawImage(b, { x, y: y + hoehe - masse.height, width: masse.width, height: masse.height });
        x += masse.width + 10;
      }
      y -= 14;
    }
  }

  // Unterschrift
  neueSeiteWennNoetig(110);
  y -= 10;
  text("Unterschrift des Fahrers", RAND, fett, 12, BLAU);
  y -= 8;
  if (d.unterschrift) {
    try {
      const bild = await doc.embedPng(d.unterschrift);
      const masse = bild.scaleToFit(220, 70);
      y -= masse.height;
      seite.drawImage(bild, { x: RAND, y, width: masse.width, height: masse.height });
    } catch {
      y -= 14;
      text("Unterschrift nicht lesbar.", RAND, normal, 10, GRAU);
    }
  }
  y -= 4;
  seite.drawLine({ start: { x: RAND, y }, end: { x: RAND + 220, y }, thickness: 0.5, color: GRAU });
  y -= 12;
  text(`${d.fahrer}, ${zeit(d.durchgefuehrtAm)}`, RAND, normal, 9, GRAU);

  // Fußzeile mit Seitenzahl
  const seiten = doc.getPages();
  seiten.forEach((s, i) =>
    s.drawText(sauber(`Abfahrtskontrolle ${d.kennzeichen} · ${zeit(d.durchgefuehrtAm)} · Seite ${i + 1} von ${seiten.length}`), {
      x: RAND,
      y: 24,
      size: 8,
      font: normal,
      color: GRAU,
    }),
  );

  return doc.save();
}
