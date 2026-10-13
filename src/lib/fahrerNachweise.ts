// Nachweise des Fahrers, die er selbst fotografiert (neben dem Führerschein).

export const NACHWEISE = ["fqn", "fahrerkarte", "adr"] as const;
export type Nachweis = (typeof NACHWEISE)[number];

export type NachweisFahrer = {
  fqn_gueltig_bis: string | null;
  fahrerkarte_gueltig_bis: string | null;
  adr_gueltig_bis: string | null;
};

type Info = {
  titel: string;
  spalte: keyof NachweisFahrer;
  // Pflicht in der Abfahrtskontrolle; ADR hat nicht jeder.
  pflicht: boolean;
  foto: string;
  // Für die Datumserkennung.
  hinweis: string;
};

export const NACHWEIS_INFO: Record<Nachweis, Info> = {
  fqn: {
    titel: "Code 95 / Fahrerqualifizierungsnachweis",
    spalte: "fqn_gueltig_bis",
    pflicht: true,
    foto: "Fahrerqualifizierungsnachweis (FQN-Karte) oder die Rückseite des Führerscheins mit Code 95",
    hinweis: `Gesucht: bis wann die Berufskraftfahrer-Qualifikation gilt.
Mögliche Fotos: Fahrerqualifizierungsnachweis (FQN-Karte, Feld 4b „gültig bis“) oder Rückseite des EU-Führerscheins, Zeile mit Schlüsselzahl 95 und Datum dahinter (Format TT.MM.JJ oder TT.MM.JJJJ).`,
  },
  fahrerkarte: {
    titel: "Fahrerkarte (Tacho)",
    spalte: "fahrerkarte_gueltig_bis",
    pflicht: true,
    foto: "Vorderseite der Fahrerkarte",
    hinweis: `Gesucht: bis wann die Fahrerkarte für den digitalen Tachographen gültig ist.
Foto: Vorderseite der Fahrerkarte, Feld 4b (Ablaufdatum, Format TT.MM.JJJJ). Nicht das Ausstellungsdatum (4a) nehmen.`,
  },
  adr: {
    titel: "ADR-Schein",
    spalte: "adr_gueltig_bis",
    pflicht: false,
    foto: "ADR-Schulungsbescheinigung (Seite mit „gültig bis“)",
    hinweis: `Gesucht: bis wann die ADR-Schulungsbescheinigung für Gefahrgutfahrer gültig ist.
Foto: ADR-Bescheinigung (Karte), Feld „gültig bis“ / Nr. 8 (Format TT.MM.JJJJ).`,
  },
};

export function istNachweis(wert: unknown): wert is Nachweis {
  return typeof wert === "string" && (NACHWEISE as readonly string[]).includes(wert);
}

// Code 95 kann auch schon aus der Führerscheinprüfung bekannt sein.
export function nachweisDatum(f: NachweisFahrer, art: Nachweis, code95Bis: string | null = null) {
  const d = f[NACHWEIS_INFO[art].spalte];
  return art === "fqn" ? (d ?? code95Bis) : d;
}
