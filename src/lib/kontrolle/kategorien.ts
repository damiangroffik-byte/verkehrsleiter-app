// Kategorien der Abfahrtskontrolle in der Reihenfolge, in der der Fahrer sie sieht.
// Der Name entspricht dem Feld „abschnitt“ der Prüfpunkte; unbekannte Abschnitte
// (z. B. von früheren Checklisten) landen am Ende mit eigenem Namen.

export type Kategorie = {
  name: string;
  kurz: string; // Untertitel auf der Startseite, z. B. „Reifen, Licht, Kupplung“
  symbol: string;
  uvv?: boolean; // gelb markiert, mit Prüfplakette
};

export const KATEGORIEN: Kategorie[] = [
  { name: "Rund um das Fahrzeug", kurz: "Reifen, Licht, Kupplung", symbol: "◎" },
  { name: "Motorraum", kurz: "Füllstände, Leckagen", symbol: "◍" },
  { name: "Ladung & Sicherung", kurz: "Zurrmittel, Achslast", symbol: "▣" },
  { name: "Fahrerhaus & Funktionscheck", kurz: "Sicht, Bremse, Ausrüstung", symbol: "◷" },
  { name: "Papiere & Nachweise", kurz: "Führerschein, Zulassung, Lizenz", symbol: "▤" },
  { name: "Gefahrgut (ADR)", kurz: "Ausrüstung nach ADR", symbol: "⚠" },
  { name: "UVV Ladebordwand", kurz: "Hubladebühne · täglich vor Einsatz", symbol: "▥", uvv: true },
  { name: "UVV Elektro-Niederhubwagen", kurz: "Elektro-Ameise · vor Einsatz", symbol: "▦", uvv: true },
  { name: "Winterliche Verhältnisse", kurz: "aktiv vom 1. November bis 31. März", symbol: "❄" },
];

export function kategorie(name: string): Kategorie {
  return KATEGORIEN.find((k) => k.name === name) ?? { name, kurz: "", symbol: "•" };
}

// Kategorien, in denen der Verkehrsleiter eigene Prüfpunkte anlegen kann.
export const EIGENE_KATEGORIEN = KATEGORIEN.filter((k) => k.name !== "Winterliche Verhältnisse" && k.name !== "Gefahrgut (ADR)").map((k) => k.name);

// Reihenfolge eigener Punkte: ans Ende ihrer Kategorie (Kategorie * 100 + 50 + n).
export function kategorieNummer(name: string) {
  const i = KATEGORIEN.findIndex((k) => k.name === name);
  return i < 0 ? 10 : i + 1;
}

// Prüfplakette „gültig bis“ als MM/JJJJ.
export function monatJahr(datum: string | null) {
  if (!datum) return "";
  const [j, m] = datum.split("-");
  return `${m}/${j}`;
}
