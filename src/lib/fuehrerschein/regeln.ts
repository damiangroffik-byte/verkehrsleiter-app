// Fristen der Führerscheinkontrolle (ohne Datenbank, testbar).

export const KLASSEN = ["B", "BE", "C1", "C1E", "C", "CE", "D1", "D1E", "D", "DE", "AM", "A1", "A2", "A", "L", "T"] as const;

export type Pruefung = {
  status: "eingereicht" | "bestaetigt" | "abgelehnt" | "ersetzt";
  eingereicht_am: string;
  geprueft_am: string | null;
  gueltig_bis: string;
  code95_bis: string | null;
  vermerk: string | null;
};

export type Stufe = "rot" | "orange" | "ok" | "wartet";

export type Status = {
  stufe: Stufe;
  text: string;
  naechstePruefung: string | null;
  bestaetigt: Pruefung | null;
  offen: Pruefung | null;
  abgelehnt: Pruefung | null;
};

const BALD_TAGE = 30;

// Kalendertag in Berlin als JJJJ-MM-TT.
export function tag(d: Date | string) {
  return new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Berlin" }).format(new Date(d));
}

export function plusMonate(datum: string, monate: number) {
  const [j, m, t] = datum.split("-").map(Number);
  const ziel = new Date(Date.UTC(j, m - 1 + monate, 1));
  const letzter = new Date(Date.UTC(ziel.getUTCFullYear(), ziel.getUTCMonth() + 1, 0)).getUTCDate();
  ziel.setUTCDate(Math.min(t, letzter));
  return ziel.toISOString().slice(0, 10);
}

function tageBis(datum: string, heute: string) {
  return Math.round((Date.parse(datum) - Date.parse(heute)) / 86_400_000);
}

export function datumDe(datum: string) {
  const [j, m, t] = datum.split("-");
  return `${t}.${m}.${j}`;
}

// pruefungen: alle Prüfungen eines Fahrers, neueste zuerst.
export function fuehrerscheinStatus(pruefungen: Pruefung[], intervallMonate: number, jetzt: Date): Status {
  const heute = tag(jetzt);
  const bestaetigt = pruefungen.find((p) => p.status === "bestaetigt") ?? null;
  const offen = pruefungen.find((p) => p.status === "eingereicht") ?? null;
  const neueste = pruefungen.find((p) => p.status !== "ersetzt");
  const abgelehnt = neueste?.status === "abgelehnt" ? neueste : null;
  const basis = { bestaetigt, offen, abgelehnt };

  if (!bestaetigt) {
    if (offen) return { ...basis, stufe: "wartet", text: "Wartet auf Prüfung", naechstePruefung: null };
    if (abgelehnt) return { ...basis, stufe: "rot", text: "Abgelehnt, bitte neu einreichen", naechstePruefung: null };
    return { ...basis, stufe: "rot", text: "Noch nicht geprüft", naechstePruefung: null };
  }

  const naechste = plusMonate(tag(bestaetigt.geprueft_am ?? bestaetigt.eingereicht_am), intervallMonate);
  const s = (stufe: Stufe, text: string): Status => ({ ...basis, stufe, text, naechstePruefung: naechste });

  if (bestaetigt.gueltig_bis < heute) return s("rot", "Fahrerlaubnis abgelaufen");
  if (bestaetigt.code95_bis && bestaetigt.code95_bis < heute) return s("rot", "Code 95 abgelaufen");
  if (naechste <= heute) {
    if (offen) return s("wartet", "Wartet auf Prüfung");
    return s("rot", abgelehnt ? "Abgelehnt, bitte neu einreichen" : "Prüfung fällig");
  }
  if (offen) return s("wartet", "Wartet auf Prüfung");
  if (tageBis(bestaetigt.gueltig_bis, heute) <= BALD_TAGE) return s("orange", `Fahrerlaubnis läuft am ${datumDe(bestaetigt.gueltig_bis)} ab`);
  if (bestaetigt.code95_bis && tageBis(bestaetigt.code95_bis, heute) <= BALD_TAGE)
    return s("orange", `Code 95 läuft am ${datumDe(bestaetigt.code95_bis)} ab`);
  if (tageBis(naechste, heute) <= BALD_TAGE) return s("orange", `Prüfung fällig am ${datumDe(naechste)}`);
  return s("ok", `Geprüft, nächste Prüfung ${datumDe(naechste)}`);
}

// Fahrer soll (neu) einreichen, wenn nicht gerade eine Prüfung offen ist und es nicht „ok“ ist.
export function einreichenNoetig(status: Status) {
  return status.stufe === "rot" || status.stufe === "orange";
}
