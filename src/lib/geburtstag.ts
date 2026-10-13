// Tage bis zum nächsten Geburtstag (0 = heute). Wer am 29. Februar geboren ist,
// feiert in Nicht-Schaltjahren am 28. Februar.

function geburtstagIm(jahr: number, monat: number, tag: number) {
  const letzter = new Date(Date.UTC(jahr, monat, 0)).getUTCDate();
  return Date.UTC(jahr, monat - 1, Math.min(tag, letzter));
}

// geburtsdatum und heute als JJJJ-MM-TT.
export function tageBisGeburtstag(geburtsdatum: string, heute: string) {
  const [, m, t] = geburtsdatum.split("-").map(Number);
  const [j] = heute.split("-").map(Number);
  const jetzt = Date.parse(heute);
  let naechster = geburtstagIm(j, m, t);
  if (naechster < jetzt) naechster = geburtstagIm(j + 1, m, t);
  return Math.round((naechster - jetzt) / 86_400_000);
}

// Alter, das an diesem nächsten Geburtstag erreicht wird.
export function wirdAlt(geburtsdatum: string, heute: string) {
  const [gj] = geburtsdatum.split("-").map(Number);
  const tage = tageBisGeburtstag(geburtsdatum, heute);
  return new Date(Date.parse(heute) + tage * 86_400_000).getUTCFullYear() - gj;
}

// Datum des nächsten Geburtstags (JJJJ-MM-TT, heute zählt mit).
export function naechsterGeburtstag(geburtsdatum: string, heute: string) {
  return new Date(Date.parse(heute) + tageBisGeburtstag(geburtsdatum, heute) * 86_400_000).toISOString().slice(0, 10);
}

export const STANDARD_VORLAUF = 14;
export const GRUSS_PLATZHALTER = ["{vorname}", "{firma}"];
export const STANDARD_GRUSS = `Hallo {vorname},

alles Gute zum Geburtstag! Wir wünschen dir Gesundheit, viel Freude und allzeit gute Fahrt.

Bei uns im Büro wartet eine kleine Überraschung auf dich.

Dein Team von {firma}`;

export function grussText(vorlage: string | null, w: { vorname: string; firma: string }) {
  return (vorlage?.trim() || STANDARD_GRUSS).replaceAll("{vorname}", w.vorname).replaceAll("{firma}", w.firma);
}
