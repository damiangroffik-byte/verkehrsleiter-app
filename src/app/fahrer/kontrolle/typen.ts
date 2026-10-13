import type { FristFahrzeug } from "@/lib/fahrzeugfristen";
import type { Pruefpunkt } from "@/lib/kontrolle/regeln";

export type KontrollFahrzeug = FristFahrzeug & {
  adr: boolean;
  fahrzeugart_id: string | null;
};

export type KontrollPruefpunkt = Pruefpunkt & { fahrzeugart_id: string };

export type KontrollEntwurf = {
  kontrolleId: string;
  firmaId: string;
  // Aus der Liste gewählt (Id) oder selbst eingetippt (Kennzeichen); eins von beiden ist gesetzt.
  fahrzeugId: string | null;
  kennzeichen: string | null;
  anhaengerId: string | null;
  anhaengerKennzeichen: string | null;
  fristen: Prueftermine;
  ausstattung: { ladebordwand: boolean; ameise: boolean };
  standort: { lat: number; lng: number; genauigkeit: number } | null;
  durchgefuehrtAm: string;
  unterschriftPfad: string;
  antworten: {
    pruefpunktId: string;
    antwortJa: boolean;
    bemerkung: string | null;
    fotoPfade: string[];
    losfahren: boolean | null;
  }[];
};

// Vom Fahrer eingetragene Prüftermine (JJJJ-MM-TT).
export type Prueftermine = {
  hu: string;
  sp: string;
  tacho: string;
  anhaengerHu: string;
  anhaengerSp: string;
  // UVV-Prüfplakette gültig bis (JJJJ-MM).
  ladebordwand: string;
  ameise: string;
};

export type EinreichenErgebnis =
  | { ok: true; kontrolleId: string; mitMangel: boolean; freigegeben: boolean }
  | { ok: false; fehler: string; feld?: string };
