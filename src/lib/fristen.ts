// Alle Fristen einer Firma (Fahrzeuge und Fahrer) in einer Liste, die nächste zuerst.
export type FristFahrzeug = {
  id: string;
  kennzeichen: string;
  hu_faellig: string | null;
  sp_faellig: string | null;
  tacho_faellig: string | null;
  ladebordwand_uvv_bis: string | null;
  ameise_uvv_bis: string | null;
};
export type FristFahrer = {
  id: string;
  vorname: string;
  nachname: string;
  fqn_gueltig_bis: string | null;
  adr_gueltig_bis: string | null;
  fahrerkarte_gueltig_bis: string | null;
};
export type Frist = { schluessel: string; wer: string; was: string; datum: string; tage: number; art: "fahrzeug" | "fahrer"; id: string };

const FAHRZEUG: [keyof FristFahrzeug, string][] = [
  ["hu_faellig", "Hauptuntersuchung (HU)"],
  ["sp_faellig", "Sicherheitsprüfung (SP)"],
  ["tacho_faellig", "Tacho-Prüfung"],
  ["ladebordwand_uvv_bis", "UVV Ladebordwand"],
  ["ameise_uvv_bis", "UVV Elektro-Ameise"],
];
const FAHRER: [keyof FristFahrer, string][] = [
  ["fqn_gueltig_bis", "Berufskraftfahrer (Code 95)"],
  ["adr_gueltig_bis", "ADR-Schulungsbescheinigung"],
  ["fahrerkarte_gueltig_bis", "Fahrerkarte"],
];

// heute als "JJJJ-MM-TT" (Berliner Datum)
export function fristenListe(fahrzeuge: FristFahrzeug[], fahrer: FristFahrer[], heute: string): Frist[] {
  const tage = (d: string) => Math.round((Date.parse(d) - Date.parse(heute)) / 86_400_000);
  const liste: Frist[] = [];
  for (const z of fahrzeuge) {
    for (const [feld, was] of FAHRZEUG) {
      const d = z[feld];
      if (d) liste.push({ schluessel: `${z.id}-${feld}`, wer: z.kennzeichen, was, datum: d, tage: tage(d), art: "fahrzeug", id: z.id });
    }
  }
  for (const f of fahrer) {
    for (const [feld, was] of FAHRER) {
      const d = f[feld];
      if (d) liste.push({ schluessel: `${f.id}-${feld}`, wer: `${f.vorname} ${f.nachname}`, was, datum: d, tage: tage(d), art: "fahrer", id: f.id });
    }
  }
  return liste.sort((a, b) => a.datum.localeCompare(b.datum));
}
