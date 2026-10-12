// Jährliche Unterweisungen: Status je Block (ohne Datenbank, testbar).
import { datumDe, tag, type Stufe } from "@/lib/fuehrerschein/regeln";

export const BESTEHEN_PROZENT = 80;
// So viele Tage vor Ablauf wird die Unterweisung als „bald fällig“ angezeigt.
export const VORWARNUNG_TAGE = 30;

// Ein kurzer Abschnitt mit Bild; nach Abschnitt n kommt Frage n.
export type Abschnitt = { titel: string; text?: string; punkte?: string[]; bild?: string };

export type Unterweisung = {
  schluessel: string;
  titel: string;
  kurz: string;
  symbol: string;
  dauer_min: number;
};

export type Teilnahme = {
  id: string;
  unterweisung: string;
  durchgefuehrt_am: string;
  prozent: number;
  bestanden: boolean;
  unterschrieben_am: string | null;
  gueltig_bis: string | null;
};

export type Frage = { id: string; nr: number; frage: string; antworten: string[] };

export type BlockStatus = {
  stufe: Stufe;
  text: string;
  // Gültige, unterschriebene Teilnahme (neueste).
  nachweis: Teilnahme | null;
  faellig: boolean;
};

function tageZwischen(von: string, bis: string) {
  return Math.round((Date.parse(bis) - Date.parse(von)) / 86_400_000);
}

// teilnahmen: alle Teilnahmen eines Fahrers an diesem Block, beliebige Reihenfolge.
export function blockStatus(teilnahmen: Teilnahme[], heute: Date): BlockStatus {
  const nachweis =
    teilnahmen
      .filter((t) => t.bestanden && t.gueltig_bis)
      .sort((a, b) => (b.gueltig_bis! > a.gueltig_bis! ? 1 : -1))[0] ?? null;
  if (!nachweis) return { stufe: "rot", text: "Noch nicht gemacht", nachweis: null, faellig: true };

  const tage = tageZwischen(tag(heute), nachweis.gueltig_bis!);
  const bis = datumDe(nachweis.gueltig_bis!);
  if (tage < 0) return { stufe: "rot", text: `Abgelaufen seit ${bis}`, nachweis, faellig: true };
  if (tage <= VORWARNUNG_TAGE) return { stufe: "orange", text: `Bald fällig: gültig bis ${bis}`, nachweis, faellig: true };
  return { stufe: "ok", text: `Gültig bis ${bis}`, nachweis, faellig: false };
}

// Antwortreihenfolge je Versuch mischen, damit die richtige Antwort nicht immer an derselben Stelle steht.
// Liefert die ursprünglichen Indizes (0-basiert) in Anzeigereihenfolge.
export function mischen(anzahl: number, zufall: () => number = Math.random) {
  const r = Array.from({ length: anzahl }, (_, i) => i);
  for (let i = r.length - 1; i > 0; i--) {
    const j = Math.floor(zufall() * (i + 1));
    [r[i], r[j]] = [r[j], r[i]];
  }
  return r;
}

// Wie viele richtige Antworten zum Bestehen nötig sind.
export function noetig(gesamt: number) {
  return Math.ceil((gesamt * BESTEHEN_PROZENT) / 100);
}

export type Seite = { art: "abschnitt" | "frage"; i: number };

// Reihenfolge im Ablauf: Abschnitt 1, Frage 1, Abschnitt 2, Frage 2, …
// Gibt es mehr Fragen als Abschnitte (oder umgekehrt), kommen die übrigen am Ende.
export function seiten(abschnitte: number, fragen: number): Seite[] {
  const r: Seite[] = [];
  for (let i = 0; i < Math.max(abschnitte, fragen); i++) {
    if (i < abschnitte) r.push({ art: "abschnitt", i });
    if (i < fragen) r.push({ art: "frage", i });
  }
  return r;
}
