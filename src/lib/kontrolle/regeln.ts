// Reine Geschäftsregeln der Abfahrtskontrolle (ohne Datenbank, testbar).
// Die Datenbankfunktion kontrolle_einreichen prüft dieselben Regeln noch einmal.

export type Bedingung = "immer" | "adr" | "anhaenger";

export type Pruefpunkt = {
  id: string;
  abschnitt: string;
  reihenfolge: number;
  frage: string;
  mangel_bei_ja: boolean;
  bedingung: Bedingung;
  monatliche_fotos: boolean;
};

export type Antwort = {
  antwortJa: boolean | null;
  bemerkung: string;
  fotoPfade: string[];
};

export type Entwurf = {
  fahrzeugId: string | null;
  antworten: Record<string, Antwort>;
  unterschrieben: boolean;
};

export type Fehlend =
  | { feld: "fahrzeug"; text: string }
  | { feld: "pruefpunkt"; pruefpunktId: string; text: string }
  | { feld: "unterschrift"; text: string };

// ADR-Punkte nur bei ADR-Fahrzeug oder ADR-Anhänger, Anhänger-Punkte nur mit Anhänger.
export function istSichtbar(p: Pick<Pruefpunkt, "bedingung">, lage: { adr: boolean; mitAnhaenger: boolean }) {
  if (p.bedingung === "adr") return lage.adr;
  if (p.bedingung === "anhaenger") return lage.mitAnhaenger;
  return true;
}

export function istMangel(p: Pick<Pruefpunkt, "mangel_bei_ja">, antwortJa: boolean | null) {
  return antwortJa !== null && antwortJa === p.mangel_bei_ja;
}

// Reifenfotos einmal pro Kalendermonat (Zeitzone Europe/Berlin).
export function reifenfotosFaellig(letzteReifenfotos: string | Date | null, jetzt: Date) {
  if (!letzteReifenfotos) return true;
  return monat(new Date(letzteReifenfotos)) !== monat(jetzt);
}

function monat(d: Date) {
  return new Intl.DateTimeFormat("de-DE", { timeZone: "Europe/Berlin", year: "numeric", month: "2-digit" }).format(d);
}

// Fotos sind Pflicht bei Mangel und bei fälligen Reifenfotos.
export function fotoPflicht(p: Pruefpunkt, antwortJa: boolean | null, reifenFaellig: boolean) {
  return istMangel(p, antwortJa) || (p.monatliche_fotos && reifenFaellig);
}

// Erstes fehlendes Feld in der Reihenfolge, in der der Fahrer die Seite sieht.
export function pruefeEntwurf(
  entwurf: Entwurf,
  sichtbare: Pruefpunkt[],
  reifenFaellig: boolean,
): Fehlend | null {
  if (!entwurf.fahrzeugId) return { feld: "fahrzeug", text: "Bitte wähle ein Fahrzeug." };

  for (const p of sichtbare) {
    const a = entwurf.antworten[p.id];
    if (!a || a.antwortJa === null) {
      return { feld: "pruefpunkt", pruefpunktId: p.id, text: `Bitte beantworte: ${p.frage}` };
    }
    const mangel = istMangel(p, a.antwortJa);
    if (mangel && !a.bemerkung.trim()) {
      return { feld: "pruefpunkt", pruefpunktId: p.id, text: `Bitte beschreibe den Mangel: ${p.frage}` };
    }
    if (fotoPflicht(p, a.antwortJa, reifenFaellig) && a.fotoPfade.length === 0) {
      const text = mangel ? `Bitte mache ein Foto vom Mangel: ${p.frage}` : "Bitte fotografiere diesen Monat alle Reifen.";
      return { feld: "pruefpunkt", pruefpunktId: p.id, text };
    }
  }

  if (!entwurf.unterschrieben) return { feld: "unterschrift", text: "Bitte unterschreibe die Kontrolle." };
  return null;
}
