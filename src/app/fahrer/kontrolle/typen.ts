import type { Pruefpunkt } from "@/lib/kontrolle/regeln";

export type KontrollFahrzeug = {
  id: string;
  kennzeichen: string;
  ist_anhaenger: boolean;
  adr: boolean;
  hu_faellig: string | null;
  sp_faellig: string | null;
  tacho_faellig: string | null;
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
  durchgefuehrtAm: string;
  unterschriftPfad: string;
  antworten: {
    pruefpunktId: string;
    antwortJa: boolean;
    bemerkung: string | null;
    fotoPfade: string[];
  }[];
};

// Vom Fahrer eingetragene Prüftermine (JJJJ-MM-TT).
export type Prueftermine = {
  hu: string;
  sp: string;
  tacho: string;
  anhaengerHu: string;
  anhaengerSp: string;
};

export type EinreichenErgebnis =
  | { ok: true; kontrolleId: string; mitMangel: boolean }
  | { ok: false; fehler: string; feld?: string };
