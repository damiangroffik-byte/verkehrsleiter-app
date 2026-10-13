// Texte für „Mangel an Werkstatt melden“ und „Fahrer zur Werkstatt schicken“.

export type Werkstatt = { id: string; name: string; email: string | null; adresse: string | null; telefon: string | null };

type MangelInfo = { kennzeichen: string; frage: string; bemerkung: string | null; festgestellt: string | null; firma: string };

// „Reifen, Räder, Felgen beschädigt?“ → „Reifen, Räder, Felgen beschädigt“
export function mangelName(frage: string) {
  return frage.trim().replace(/\?+$/, "");
}

const datumDe = (iso: string) => new Date(iso).toLocaleDateString("de-DE", { timeZone: "Europe/Berlin" });

export function werkstattBetreff(m: Pick<MangelInfo, "kennzeichen" | "frage">) {
  return `Reparaturanfrage ${m.kennzeichen}: ${mangelName(m.frage)}`;
}

export function werkstattText(m: MangelInfo) {
  return [
    "Guten Tag,",
    "",
    `bei unserem Fahrzeug ${m.kennzeichen} wurde${m.festgestellt ? ` am ${datumDe(m.festgestellt)}` : ""} bei der Abfahrtskontrolle ein Mangel festgestellt:`,
    "",
    mangelName(m.frage),
    ...(m.bemerkung ? [`Beschreibung: ${m.bemerkung}`] : []),
    "",
    "Bitte nennen Sie uns einen Termin für die Reparatur. Der Kontrollbericht hängt als PDF an.",
    "",
    "Mit freundlichen Grüßen",
    m.firma,
  ].join("\n");
}

const WOCHENTAGE = ["Sonntag", "Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag"];

// „2026-10-14“ → „Mittwoch, 14.10.2026“
export function tagText(datum: string) {
  const [j, m, t] = datum.split("-").map(Number);
  if (!j || !m || !t) return "";
  return `${WOCHENTAGE[new Date(Date.UTC(j, m - 1, t)).getUTCDay()]}, ${String(t).padStart(2, "0")}.${String(m).padStart(2, "0")}.${j}`;
}

export function fahrerText(w: {
  vorname: string;
  datum: string;
  uhrzeit: string;
  kennzeichen: string;
  frage: string;
  werkstatt: Pick<Werkstatt, "name" | "adresse" | "telefon"> | null;
  firma: string;
}) {
  const wann = [w.datum ? `am ${tagText(w.datum)}` : "", w.uhrzeit ? `um ${w.uhrzeit} Uhr` : ""].filter(Boolean).join(" ");
  return [
    `Hallo ${w.vorname},`,
    "",
    `bitte fahre${wann ? ` ${wann}` : ""} mit ${w.kennzeichen} zur Werkstatt${w.werkstatt ? ":" : "."}`,
    ...(w.werkstatt ? [w.werkstatt.name, ...(w.werkstatt.adresse ? [w.werkstatt.adresse] : []), ...(w.werkstatt.telefon ? [`Tel. ${w.werkstatt.telefon}`] : [])] : []),
    "",
    `Grund: ${mangelName(w.frage)}`,
    "",
    "Danke!",
    w.firma,
  ].join("\n");
}

// Datum und Uhrzeit (deutsche Ortszeit) als Zeitpunkt; null wenn unvollständig.
export function berlinZeitpunkt(datum: string, uhrzeit: string): string | null {
  const d = /^(\d{4})-(\d{2})-(\d{2})$/.exec(datum);
  const z = /^(\d{2}):(\d{2})$/.exec(uhrzeit);
  if (!d || !z) return null;
  const alsUtc = Date.UTC(+d[1], +d[2] - 1, +d[3], +z[1], +z[2]);
  // Abstand Berlin–UTC zu diesem Zeitpunkt (Sommer-/Winterzeit).
  const teile = new Intl.DateTimeFormat("en-US", { timeZone: "Europe/Berlin", hourCycle: "h23", year: "numeric", month: "numeric", day: "numeric", hour: "numeric", minute: "numeric" })
    .formatToParts(new Date(alsUtc))
    .reduce<Record<string, number>>((a, p) => (p.type === "literal" ? a : { ...a, [p.type]: Number(p.value) }), {});
  const berlin = Date.UTC(teile.year, teile.month - 1, teile.day, teile.hour, teile.minute);
  return new Date(alsUtc - (berlin - alsUtc)).toISOString();
}

export function terminText(iso: string) {
  return new Date(iso).toLocaleString("de-DE", { timeZone: "Europe/Berlin", weekday: "long", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}
