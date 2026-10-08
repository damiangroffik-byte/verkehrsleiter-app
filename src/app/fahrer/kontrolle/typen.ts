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
  fahrzeugId: string;
  anhaengerId: string | null;
  durchgefuehrtAm: string;
  unterschriftPfad: string;
  antworten: {
    pruefpunktId: string;
    antwortJa: boolean;
    bemerkung: string | null;
    fotoPfade: string[];
  }[];
};

export type EinreichenErgebnis =
  | { ok: true; kontrolleId: string; mitMangel: boolean }
  | { ok: false; fehler: string; feld?: string };
