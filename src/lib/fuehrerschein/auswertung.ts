// Wertet den erkannten Text (Texterkennung auf dem Handy) eines EU-Kartenführerscheins aus.
// Rückseite: je Klasse Zeile mit Spalte 10 (erteilt), 11 (gültig bis), 12 (Schlüsselzahlen, z. B. 95.TT.MM.JJ).
// Vorderseite: Feld 4b (Ablauf des Dokuments).

import type { Erkannt } from "./erkennung";

const KLASSE = /(?<![A-Za-z0-9])(C1E|D1E|C1|D1|CE|BE|DE|A1|A2|AM|A|B|C|D|L|T)(?![A-Za-z0-9])/g;
const DATUM = /(\d{2})[.,](\d{2})[.,](\d{4}|\d{2})/g;
const DATUM_EINZELN = /\d{2}[.,]\d{2}[.,]\d{2}/;
const CODE95 = /\b95\s*[.(]?\s*(\d{2})[.,](\d{2})[.,](\d{4}|\d{2})/;
const FELD_4B = /4\s*b\s*[.:]?\s*(\d{2})[.,](\d{2})[.,](\d{4}|\d{2})/i;
const C_KLASSEN = new Set(["C1", "C1E", "C", "CE"]);

function iso(t: string, m: string, j: string) {
  const jahr = j.length === 2 ? 2000 + Number(j) : Number(j);
  const tag = Number(t);
  const monat = Number(m);
  if (monat < 1 || monat > 12 || tag < 1 || tag > 31) return null;
  return `${jahr}-${m}-${t}`;
}

// Typische Lesefehler in Zahlen: O statt 0, I/l statt 1 (auch in C1, C1E, D1, D1E, A1).
function glaetten(text: string) {
  return text
    .replace(/(?<![A-Za-z0-9])([ACD])[Il|](E?)(?![A-Za-z0-9])/g, "$11$2").replace(/(?<=\d)[Oo](?=[\d.,])|(?<=[.,])[Oo](?=\d)/g, "0").replace(/(?<=\d)[Il|](?=[\d.,])|(?<=[.,])[Il|](?=\d)/g, "1");
}

export function auswerten(textVorne: string, textHinten: string): Erkannt {
  const hinten = glaetten(textHinten);
  const klassen: string[] = [];
  const ablauf: string[] = [];

  const c95 = hinten.match(CODE95);
  const code95Bis = c95 ? iso(c95[1], c95[2], c95[3]) : null;

  for (const roh of hinten.split("\n")) {
    const zeile = roh.replace(CODE95, " ");
    const erstesDatum = zeile.search(DATUM_EINZELN);
    if (erstesDatum < 0) continue; // Klasse ohne Erteilungsdatum: nicht vorhanden
    // Vor der Klasse steht auf der Karte ein Bildsymbol, das als Zeichensalat gelesen wird:
    // maßgeblich ist die letzte Klassenbezeichnung vor dem ersten Datum.
    const k = [...zeile.slice(0, erstesDatum).matchAll(KLASSE)].at(-1)?.[1];
    if (!k) continue;
    const daten = [...zeile.matchAll(DATUM)].map((d) => iso(d[1], d[2], d[3])).filter((d): d is string => d !== null);
    if (daten.length === 0) continue;
    if (!klassen.includes(k)) klassen.push(k);
    if (daten[1] && C_KLASSEN.has(k)) ablauf.push(daten[1]);
  }

  const f4b = glaetten(textVorne).match(FELD_4B);
  const gueltigBis = ablauf.sort()[0] ?? (f4b ? iso(f4b[1], f4b[2], f4b[3]) : null);

  return { klassen, gueltigBis, code95Bis };
}
