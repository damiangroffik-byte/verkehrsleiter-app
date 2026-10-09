// Wertet den erkannten Text (Texterkennung auf dem Handy) eines EU-Kartenführerscheins aus.
// Rückseite: je Klasse Zeile mit Spalte 10 (erteilt), 11 (gültig bis), 12 (Schlüsselzahlen, z. B. 95.TT.MM.JJ).
// Vorderseite: Feld 4b (Ablauf des Dokuments).

import type { Erkannt } from "./erkennung";

const KLASSE = /^(C1E|D1E|C1|D1|CE|BE|DE|A1|A2|AM|A|B|C|D|L|T)(?![A-Z0-9])/;
const DATUM = /(\d{2})[.,](\d{2})[.,](\d{4}|\d{2})/g;
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

// Typische Lesefehler in Zahlen: O statt 0, I/l statt 1.
function glaetten(text: string) {
  return text.replace(/(?<=\d)[Oo](?=[\d.,])|(?<=[.,])[Oo](?=\d)/g, "0").replace(/(?<=\d)[Il|](?=[\d.,])|(?<=[.,])[Il|](?=\d)/g, "1");
}

export function auswerten(textVorne: string, textHinten: string): Erkannt {
  const hinten = glaetten(textHinten);
  const klassen: string[] = [];
  const ablauf: string[] = [];

  const c95 = hinten.match(CODE95);
  const code95Bis = c95 ? iso(c95[1], c95[2], c95[3]) : null;

  for (const roh of hinten.split("\n")) {
    const zeile = roh.replace(/^[^A-Z0-9]+/, "").replace(CODE95, " ");
    const k = zeile.match(KLASSE);
    if (!k) continue;
    const daten = [...zeile.matchAll(DATUM)].map((d) => iso(d[1], d[2], d[3])).filter((d): d is string => d !== null);
    if (daten.length === 0) continue; // Klasse ohne Erteilungsdatum: nicht vorhanden
    if (!klassen.includes(k[1])) klassen.push(k[1]);
    if (daten[1] && C_KLASSEN.has(k[1])) ablauf.push(daten[1]);
  }

  const f4b = glaetten(textVorne).match(FELD_4B);
  const gueltigBis = ablauf.sort()[0] ?? (f4b ? iso(f4b[1], f4b[2], f4b[3]) : null);

  return { klassen, gueltigBis, code95Bis };
}
