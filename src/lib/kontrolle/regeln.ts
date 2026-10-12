// Reine Geschäftsregeln der Abfahrtskontrolle (ohne Datenbank, testbar).
// Die Datenbankfunktion kontrolle_einreichen prüft dieselben Regeln noch einmal.

export type Bedingung = "immer" | "adr" | "anhaenger" | "ladebordwand" | "ameise" | "winter";

export type Pruefpunkt = {
  id: string;
  abschnitt: string;
  reihenfolge: number;
  frage: string;
  mangel_bei_ja: boolean;
  bedingung: Bedingung;
  monatliche_fotos: boolean;
  // Pflichtpunkt (BG Verkehr / gesetzlich): kann der Verkehrsleiter nicht abschalten.
  pflicht: boolean;
  foto_bei_mangel: boolean;
  // Bei einem Mangel darf der Fahrer nicht losfahren.
  mangel_stoppt: boolean;
};

export type Antwort = {
  antwortJa: boolean | null;
  bemerkung: string;
  fotoPfade: string[];
  // Antwort auf „Darf ich so losfahren?“ (nur bei Mangel).
  losfahren: boolean | null;
};

export type Lage = { adr: boolean; mitAnhaenger: boolean; ladebordwand: boolean; ameise: boolean; winter: boolean };

export type Entwurf = {
  fahrzeugId: string | null;
  antworten: Record<string, Antwort>;
  unterschrieben: boolean;
};

export type Fehlend =
  | { feld: "fahrzeug"; text: string }
  | { feld: "pruefpunkt"; pruefpunktId: string; text: string }
  | { feld: "unterschrift"; text: string };

// ADR-Punkte nur bei ADR, Anhänger-Punkte nur mit Anhänger, UVV-Punkte nur mit
// Ladebordwand bzw. Elektro-Ameise, Winterpunkte nur vom 01.11. bis 31.03.
export function istSichtbar(p: Pick<Pruefpunkt, "bedingung">, lage: Lage) {
  switch (p.bedingung) {
    case "adr":
      return lage.adr;
    case "anhaenger":
      return lage.mitAnhaenger;
    case "ladebordwand":
      return lage.ladebordwand;
    case "ameise":
      return lage.ameise;
    case "winter":
      return lage.winter;
    default:
      return true;
  }
}

// Winter vom 01.11. bis 31.03. (Zeitzone Europe/Berlin), wie ist_winter in der Datenbank.
export function istWinter(jetzt: Date) {
  const m = Number(new Intl.DateTimeFormat("de-DE", { timeZone: "Europe/Berlin", month: "numeric" }).format(jetzt));
  return m >= 11 || m <= 3;
}

// Muss der Fahrer beim Mangel „Darf ich so losfahren?“ beantworten?
export function losfahrenFrage(p: Pick<Pruefpunkt, "mangel_bei_ja" | "mangel_stoppt">, a: Pick<Antwort, "antwortJa">) {
  return istMangel(p, a.antwortJa) && !p.mangel_stoppt;
}

// Darf der Fahrer nach dieser Antwort losfahren? null = noch offen.
export function darfLosfahren(p: Pick<Pruefpunkt, "mangel_bei_ja" | "mangel_stoppt">, a: Pick<Antwort, "antwortJa" | "losfahren">) {
  if (!istMangel(p, a.antwortJa)) return true;
  if (p.mangel_stoppt) return false;
  return a.losfahren;
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
  return (istMangel(p, antwortJa) && p.foto_bei_mangel) || (p.monatliche_fotos && reifenFaellig);
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
      const text = mangel && p.foto_bei_mangel ? `Bitte mache ein Foto vom Mangel: ${p.frage}` : "Bitte fotografiere diesen Monat alle Reifen.";
      return { feld: "pruefpunkt", pruefpunktId: p.id, text };
    }
    if (losfahrenFrage(p, a) && a.losfahren === null) {
      return { feld: "pruefpunkt", pruefpunktId: p.id, text: `Bitte beantworte „Darf ich so losfahren?“: ${p.frage}` };
    }
  }

  if (!entwurf.unterschrieben) return { feld: "unterschrift", text: "Bitte unterschreibe die Kontrolle." };
  return null;
}
