import Anthropic from "@anthropic-ai/sdk";
import { ART_INFO, type Art } from "./fahrzeugfristen";

// Liest das Fälligkeitsdatum von einem Foto (Plakette, Prüfschild, Fahrzeugschein).
// Ergebnis ist nur ein Vorschlag, der Fahrer prüft es vor dem Speichern.

const SCHEMA = {
  type: "object",
  properties: {
    lesbar: { type: "boolean", description: "false, wenn auf dem Foto kein passendes Datum sicher zu erkennen ist" },
    jahr: { type: ["integer", "null"] },
    monat: { type: ["integer", "null"], description: "1 bis 12" },
    tag: { type: ["integer", "null"], description: "nur wenn ein genauer Tag angegeben ist, sonst null" },
  },
  required: ["lesbar", "jahr", "monat", "tag"],
  additionalProperties: false,
};

const HINWEIS: Record<Art, string> = {
  hu: `Gesucht: wann die nächste Hauptuntersuchung (HU) fällig ist.
Mögliche Fotos: runde HU-Plakette am Kennzeichen (Jahr steht zweistellig in der Mitte, der Monat ist die Zahl, die oben bei „12 Uhr“ steht, bzw. die Stelle, an der die Plakette ausgerichtet ist), Fahrzeugschein/Zulassungsbescheinigung Teil I (Feld „HU“ bzw. „Nächste HU“, Monat/Jahr) oder ein HU-Prüfbericht („nächste HU“).`,
  sp: `Gesucht: wann die nächste Sicherheitsprüfung (SP) fällig ist.
Mögliche Fotos: sechseckige SP-Prüfmarke (Jahr in der Mitte, Monat oben bei „12 Uhr“) oder ein SP-Prüfprotokoll („nächste SP“).`,
  tacho: `Gesucht: wann die nächste Prüfung des Fahrtenschreibers (Tachograph, § 57b StVZO) fällig ist.
Mögliche Fotos: Einbau-/Prüfschild (Plakette) des Fahrtenschreibers. Steht dort nur das Datum der letzten Prüfung, ist die nächste Prüfung 2 Jahre später im selben Monat.`,
  feuerloescher: `Gesucht: wann die nächste Prüfung des Feuerlöschers fällig ist.
Mögliche Fotos: Prüfplakette auf dem Feuerlöscher (meist Jahr in der Mitte und markierter Monat, oft „nächste Prüfung“). Ist nur die letzte Prüfung erkennbar, ist die nächste 2 Jahre später im selben Monat.`,
  uvv_ladebordwand: `Gesucht: bis wann die UVV-Prüfung der Ladebordwand/Hubladebühne gültig ist (nächste Prüfung).
Mögliche Fotos: UVV-Prüfplakette (Jahr in der Mitte, Monat markiert oder oben bei „12 Uhr“). Ist nur die letzte Prüfung erkennbar, ist die nächste 1 Jahr später im selben Monat.`,
  uvv_ameise: `Gesucht: bis wann die UVV-Prüfung des Elektro-Niederhubwagens (Ameise) bzw. Staplers gültig ist (nächste Prüfung).
Mögliche Fotos: UVV-Prüfplakette (Jahr in der Mitte, Monat markiert oder oben bei „12 Uhr“). Ist nur die letzte Prüfung erkennbar, ist die nächste 1 Jahr später im selben Monat.`,
};

export function erkennungBereit() {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

// Monat ohne Tag: fällig bis Monatsende.
export function zuDatum(roh: unknown): string | null {
  if (!roh || typeof roh !== "object") return null;
  const r = roh as Record<string, unknown>;
  if (r.lesbar !== true) return null;
  let jahr = typeof r.jahr === "number" ? r.jahr : null;
  const monat = typeof r.monat === "number" ? r.monat : null;
  if (jahr !== null && jahr < 100) jahr += 2000;
  if (!jahr || !monat || jahr < 2000 || jahr > 2100 || monat < 1 || monat > 12) return null;
  const letzter = new Date(Date.UTC(jahr, monat, 0)).getUTCDate();
  const tag = typeof r.tag === "number" && r.tag >= 1 && r.tag <= letzter ? r.tag : letzter;
  return `${jahr}-${String(monat).padStart(2, "0")}-${String(tag).padStart(2, "0")}`;
}

export async function fristLesen(art: Art, bild: Uint8Array): Promise<string | null> {
  return datumLesen(`${HINWEIS[art]}\n\nPrüfung: ${ART_INFO[art].titel}.`, bild);
}

// Datum nach einer Beschreibung (was gesucht ist, welche Fotos möglich sind) vom Foto lesen.
export async function datumLesen(hinweis: string, bild: Uint8Array): Promise<string | null> {
  const client = new Anthropic({ timeout: 60_000, maxRetries: 1 });
  const antwort = await client.beta.messages.create({
    model: "claude-opus-5-5",
    max_tokens: 2000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    output_config: { effort: "low", format: { type: "json_schema", schema: SCHEMA } },
    messages: [
      {
        role: "user",
        content: [
          { type: "image", source: { type: "base64", media_type: "image/jpeg", data: Buffer.from(bild).toString("base64") } },
          {
            type: "text",
            text: `${hinweis} Gib Jahr, Monat und, falls angegeben, den Tag zurück. Rate nicht: Was du nicht sicher lesen kannst, setzt du auf null bzw. lesbar=false.`,
          },
        ],
      },
    ],
  });
  if (antwort.stop_reason === "refusal" || antwort.stop_reason === "max_tokens") return null;
  const text = antwort.content.find((b) => b.type === "text");
  if (!text || text.type !== "text") return null;
  try {
    return zuDatum(JSON.parse(text.text));
  } catch {
    return null;
  }
}
