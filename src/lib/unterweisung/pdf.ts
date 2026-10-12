import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import type { Abschnitt } from "./regeln";

// Nachweis einer Unterweisung (A4): Inhalte, Testergebnis und Unterschrift des Fahrers.

export type NachweisDaten = {
  firma: string;
  fahrer: string;
  titel: string;
  durchgefuehrtAm: string;
  unterschriebenAm: string;
  gueltigBis: string;
  richtig: number;
  gesamt: number;
  prozent: number;
  abschnitte: Abschnitt[];
  antworten: { frage: string; antwort: string; richtig: boolean }[];
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

function datum(d: string) {
  const [j, m, t] = d.split("-");
  return `${t}.${m}.${j}`;
}

export async function nachweisPdf(d: NachweisDaten): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.setTitle(`Unterweisung ${d.titel} – ${d.fahrer}`);
  const normal = await doc.embedFont(StandardFonts.Helvetica);
  const fett = await doc.embedFont(StandardFonts.HelveticaBold);

  // Die Standardschrift kann nur WinAnsi; alles andere wird ersetzt.
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
  const platz = (bedarf: number) => {
    if (y - bedarf < RAND + 20) {
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
  const absatz = (t: string, x: number, schrift = normal, groesse = 10, farbe = rgb(0, 0, 0)) => {
    const zeilen = umbrechen(t, schrift, groesse, BREITE - RAND - x);
    platz(zeilen.length * (groesse + 3));
    for (const z of zeilen) {
      text(z, x, schrift, groesse, farbe);
      y -= groesse + 3;
    }
  };
  const ueberschrift = (t: string) => {
    platz(40);
    y -= 8;
    text(t, RAND, fett, 12, BLAU);
    y -= 6;
    seite.drawLine({ start: { x: RAND, y }, end: { x: BREITE - RAND, y }, thickness: 0.5, color: GRAU });
    y -= 14;
  };

  // Kopf
  seite.drawRectangle({ x: 0, y: HOEHE - 84, width: BREITE, height: 84, color: BLAU });
  seite.drawRectangle({ x: 0, y: HOEHE - 90, width: BREITE, height: 6, color: rgb(1, 201 / 255, 71 / 255) });
  y = HOEHE - 44;
  text("Nachweis Unterweisung", RAND, fett, 20, rgb(1, 1, 1));
  y -= 22;
  text(d.firma, RAND, normal, 11, rgb(1, 1, 1));
  y = HOEHE - 120;

  const zeilen: [string, string][] = [
    ["Unterweisung", d.titel],
    ["Fahrer", d.fahrer],
    ["Durchgeführt", zeit(d.durchgefuehrtAm)],
    ["Unterschrieben", zeit(d.unterschriebenAm)],
    ["Gültig bis", datum(d.gueltigBis)],
    ["Art", "Unterweisung in der App mit Lernzielkontrolle (mind. 80 %)"],
  ];
  for (const [k, v] of zeilen) {
    text(k, RAND, normal, 10, GRAU);
    text(v, RAND + 100, fett, 10);
    y -= 16;
  }
  y -= 4;
  text(`Lernzielkontrolle: ${d.richtig} von ${d.gesamt} richtig (${d.prozent} %) – bestanden`, RAND, fett, 12, GRUEN);
  y -= 16;

  ueberschrift("Inhalte der Unterweisung");
  for (const a of d.abschnitte) {
    platz(30);
    absatz(a.titel, RAND, fett, 10);
    if (a.text) absatz(a.text, RAND, normal, 9);
    for (const p of a.punkte ?? []) {
      const zeilen = umbrechen(p, normal, 9, BREITE - 2 * RAND - 12);
      platz(zeilen.length * 12);
      seite.drawCircle({ x: RAND + 4, y: y + 3, size: 1.5, color: BLAU });
      for (const z of zeilen) {
        text(z, RAND + 12, normal, 9);
        y -= 12;
      }
    }
    y -= 4;
  }

  ueberschrift("Lernzielkontrolle");
  d.antworten.forEach((a, i) => {
    const frage = umbrechen(`${i + 1}. ${a.frage}`, normal, 9, BREITE - 2 * RAND - 60);
    const antwort = umbrechen(`Antwort: ${a.antwort}`, normal, 9, BREITE - 2 * RAND - 70);
    platz((frage.length + antwort.length) * 12 + 4);
    text(a.richtig ? "richtig" : "falsch", BREITE - RAND - 40, fett, 9, a.richtig ? GRUEN : ROT);
    for (const z of frage) {
      text(z, RAND, normal, 9);
      y -= 12;
    }
    for (const z of antwort) {
      text(z, RAND + 10, normal, 9, GRAU);
      y -= 12;
    }
    y -= 4;
  });

  // Erklärung und Unterschrift
  platz(130);
  ueberschrift("Bestätigung");
  absatz(`Ich wurde zu „${d.titel}“ unterwiesen, habe die Inhalte verstanden und werde sie einhalten.`, RAND);
  y -= 6;
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
  text(`${d.fahrer}, ${zeit(d.unterschriebenAm)}`, RAND, normal, 9, GRAU);

  const seiten = doc.getPages();
  seiten.forEach((s, i) =>
    s.drawText(sauber(`Unterweisung ${d.titel} · ${d.fahrer} · Seite ${i + 1} von ${seiten.length}`), {
      x: RAND,
      y: 24,
      size: 8,
      font: normal,
      color: GRAU,
    }),
  );

  return doc.save();
}
