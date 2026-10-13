// Allgemeine Informationen, die der Verkehrsleiter für seine Fahrer einträgt (ohne Test).
export type InfoFeld = { schluessel: string; titel: string; anzahl: number; beispiel: string };

export const INFO_FELDER: InfoFeld[] = [
  { schluessel: "ersthelfer", titel: "Ersthelfer im Unternehmen", anzahl: 5, beispiel: "Name, Telefon" },
  { schluessel: "fachkraft_arbeitssicherheit", titel: "Fachkraft für Arbeitssicherheit", anzahl: 1, beispiel: "Name, Telefon" },
  { schluessel: "betriebsarzt", titel: "Betriebsarzt / Betriebsärztin", anzahl: 1, beispiel: "Name, Adresse, Telefon" },
  { schluessel: "sicherheitsbeauftragter", titel: "Sicherheitsbeauftragte/-r", anzahl: 3, beispiel: "Name, Telefon" },
  { schluessel: "gefahrgutbeauftragter", titel: "Gefahrgutbeauftragte/-r", anzahl: 1, beispiel: "Name, Telefon" },
  { schluessel: "verbandkaesten", titel: "Wo befindet sich ein Verbandkasten?", anzahl: 10, beispiel: "z. B. Werkstatt, neben der Tür" },
  { schluessel: "brandschutzhelfer", titel: "Brandschutzhelfer", anzahl: 5, beispiel: "Name, Telefon" },
  { schluessel: "sammelpunkt", titel: "Sammelpunkt", anzahl: 3, beispiel: "z. B. Parkplatz an der Einfahrt" },
  { schluessel: "feuerloescher", titel: "Wo befindet sich ein Feuerlöscher?", anzahl: 10, beispiel: "z. B. Halle 1, links am Tor" },
];

export const INFO_MAX_ZEICHEN = 200;

export type InfoAngaben = Record<string, string[]>;

// Aus beliebigen Daten (Formular oder Datenbank) nur bekannte, gefüllte Einträge übernehmen.
export function infosBereinigen(roh: Record<string, unknown>): InfoAngaben {
  const ergebnis: InfoAngaben = {};
  for (const f of INFO_FELDER) {
    const werte = roh[f.schluessel];
    const liste = (Array.isArray(werte) ? werte : [])
      .filter((w): w is string => typeof w === "string")
      .map((w) => w.trim().slice(0, INFO_MAX_ZEICHEN))
      .filter(Boolean)
      .slice(0, f.anzahl);
    if (liste.length) ergebnis[f.schluessel] = liste;
  }
  return ergebnis;
}

// Text in Teile zerlegen, Telefonnummern werden zum Antippen markiert.
export function telefonTeile(text: string): { text: string; tel?: string }[] {
  const teile: { text: string; tel?: string }[] = [];
  let rest = 0;
  for (const m of text.matchAll(/\+?\d[\d ()/-]{5,}\d/g)) {
    const ziffern = m[0].replace(/[^\d+]/g, "");
    if (ziffern.replace("+", "").length < 6) continue;
    if (m.index > rest) teile.push({ text: text.slice(rest, m.index) });
    teile.push({ text: m[0], tel: ziffern });
    rest = m.index + m[0].length;
  }
  if (rest < text.length) teile.push({ text: text.slice(rest) });
  return teile;
}
