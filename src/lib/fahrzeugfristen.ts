// Prüffristen am Fahrzeug: welche es gibt, für welche Fahrzeuge sie gelten und wann erinnert bzw. gemailt wird.

export const ARTEN = ["hu", "sp", "tacho", "feuerloescher", "uvv_ladebordwand", "uvv_ameise"] as const;
export type Art = (typeof ARTEN)[number];

export type FristFahrzeug = {
  id: string;
  kennzeichen: string;
  ist_anhaenger: boolean;
  ladebordwand: boolean;
  ameise: boolean;
  hu_faellig: string | null;
  sp_faellig: string | null;
  tacho_faellig: string | null;
  feuerloescher_bis: string | null;
  ladebordwand_uvv_bis: string | null;
  ameise_uvv_bis: string | null;
};

export const FAHRZEUG_SPALTEN =
  "id, kennzeichen, ist_anhaenger, ladebordwand, ameise, hu_faellig, sp_faellig, tacho_faellig, feuerloescher_bis, ladebordwand_uvv_bis, ameise_uvv_bis";

type ArtInfo = {
  titel: string;
  kurz: string;
  spalte: keyof FristFahrzeug;
  gilt: (f: FristFahrzeug) => boolean;
  // Was der Fahrer fotografieren soll.
  foto: string;
};

export const ART_INFO: Record<Art, ArtInfo> = {
  hu: { titel: "Hauptuntersuchung (HU)", kurz: "HU", spalte: "hu_faellig", gilt: () => true, foto: "HU-Plakette am hinteren Kennzeichen oder Fahrzeugschein" },
  sp: { titel: "Sicherheitsprüfung (SP)", kurz: "SP", spalte: "sp_faellig", gilt: () => true, foto: "SP-Plakette oder letzter Prüfbericht" },
  tacho: { titel: "Tacho-Prüfung", kurz: "Tacho", spalte: "tacho_faellig", gilt: (f) => !f.ist_anhaenger, foto: "Prüfschild des Fahrtenschreibers (meist an der Fahrertür)" },
  feuerloescher: { titel: "Feuerlöscher", kurz: "Feuerlöscher", spalte: "feuerloescher_bis", gilt: (f) => !f.ist_anhaenger, foto: "Prüfplakette auf dem Feuerlöscher" },
  uvv_ladebordwand: { titel: "UVV Ladebordwand / Hubladebühne", kurz: "UVV LBW", spalte: "ladebordwand_uvv_bis", gilt: (f) => f.ladebordwand, foto: "UVV-Prüfplakette an der Ladebordwand" },
  uvv_ameise: { titel: "UVV Ameise / Stapler", kurz: "UVV Ameise", spalte: "ameise_uvv_bis", gilt: (f) => f.ameise, foto: "UVV-Prüfplakette an der Ameise bzw. am Stapler" },
};

export function istArt(wert: unknown): wert is Art {
  return typeof wert === "string" && (ARTEN as readonly string[]).includes(wert);
}

export function datumVon(f: FristFahrzeug, art: Art): string | null {
  return (f[ART_INFO[art].spalte] as string | null) ?? null;
}

export function geltendeArten(f: FristFahrzeug): Art[] {
  return ARTEN.filter((a) => ART_INFO[a].gilt(f));
}

export type Regel = {
  art: Art;
  vorwarnung_tage: number;
  mail_aktiv: boolean;
  mail_an: string | null;
  mail_betreff: string | null;
  mail_text: string | null;
  mail_tage: number;
};

export function standardRegel(art: Art): Regel {
  return { art, vorwarnung_tage: 30, mail_aktiv: false, mail_an: null, mail_betreff: null, mail_text: null, mail_tage: 42 };
}

export const STANDARD_BETREFF = "{pruefung} für {kennzeichen} am {datum}";
export const STANDARD_TEXT = `Sehr geehrte Partner,

das Fahrzeug mit dem Kennzeichen {kennzeichen} hat am {datum} die {pruefung}.
Bitte nennen Sie uns einen Termin.

Mit freundlichen Grüßen
{firma}`;

export const PLATZHALTER = ["{kennzeichen}", "{pruefung}", "{datum}", "{firma}"];

export function datumDe(d: string) {
  const [j, m, t] = d.split("-");
  return `${t}.${m}.${j}`;
}

export function ausfuellen(vorlage: string, w: { kennzeichen: string; art: Art; datum: string; firma: string }) {
  return vorlage
    .replaceAll("{kennzeichen}", w.kennzeichen)
    .replaceAll("{pruefung}", ART_INFO[w.art].titel)
    .replaceAll("{datum}", datumDe(w.datum))
    .replaceAll("{firma}", w.firma);
}

export function tageBis(datum: string, heute: string) {
  return Math.round((Date.parse(datum) - Date.parse(heute)) / 86_400_000);
}

export type Stufe = "rot" | "orange" | "ok" | "fehlt";

export function stufe(datum: string | null, heute: string, vorwarnungTage: number): Stufe {
  if (!datum) return "fehlt";
  const t = tageBis(datum, heute);
  return t < 0 ? "rot" : t <= vorwarnungTage ? "orange" : "ok";
}

// Automatische Mail fällig: ab mail_tage vor dem Termin bis höchstens 14 Tage danach (falls der Versand ausfiel).
export function mailFaellig(datum: string | null, heute: string, mailTage: number) {
  if (!datum) return false;
  const t = tageBis(datum, heute);
  return t <= mailTage && t >= -14;
}
