import Anthropic from "@anthropic-ai/sdk";
import { KLASSEN } from "./regeln";

// Liest Klassen und Fristen von den Führerscheinfotos (Claude, Bildeingabe).
// Ergebnis ist nur ein Vorschlag: Der Fahrer prüft es, der Verkehrsleiter bestätigt.

export type Erkannt = {
  klassen: string[];
  gueltigBis: string | null;
  code95Bis: string | null;
};

const SCHEMA = {
  type: "object",
  properties: {
    lesbar: { type: "boolean", description: "false, wenn die Fotos keinen EU-Kartenführerschein zeigen oder unlesbar sind" },
    klassen: { type: "array", items: { type: "string", enum: [...KLASSEN] } },
    gueltig_bis: { type: ["string", "null"], description: "JJJJ-MM-TT" },
    code95_bis: { type: ["string", "null"], description: "JJJJ-MM-TT" },
  },
  required: ["lesbar", "klassen", "gueltig_bis", "code95_bis"],
  additionalProperties: false,
};

const ANWEISUNG = `Die beiden Bilder zeigen Vorder- und Rückseite eines deutschen bzw. EU-Kartenführerscheins.
Lies daraus:
- klassen: alle Klassen, die auf der Rückseite in Spalte 10 ein Erteilungsdatum haben (nicht die leeren Zeilen).
- gueltig_bis: das früheste Ablaufdatum aus Spalte 11 der Klassen C1, C1E, C oder CE. Hat keine dieser Klassen ein Datum in Spalte 11, nimm das Datum aus Feld 4b der Vorderseite. Fehlt beides, null.
- code95_bis: das Datum hinter der Schlüsselzahl 95 in Spalte 12 (Format 95.TT.MM.JJ), sonst null.
Datumsangaben auf dem Führerschein stehen als TT.MM.JJJJ oder TT.MM.JJ; gib sie als JJJJ-MM-TT zurück.
Rate nicht: Was du nicht sicher lesen kannst, lässt du weg bzw. setzt es auf null.`;

const DATUM = /^\d{4}-\d{2}-\d{2}$/;

// Antwort des Modells absichern, bevor sie ins Formular geht.
export function bereinigen(roh: unknown): Erkannt | null {
  if (!roh || typeof roh !== "object") return null;
  const r = roh as Record<string, unknown>;
  if (r.lesbar !== true) return null;
  const erlaubt = new Set<string>(KLASSEN);
  const klassen = Array.isArray(r.klassen) ? [...new Set(r.klassen.filter((k): k is string => typeof k === "string" && erlaubt.has(k)))] : [];
  const datum = (v: unknown) => (typeof v === "string" && DATUM.test(v) && !Number.isNaN(Date.parse(v)) ? v : null);
  return { klassen, gueltigBis: datum(r.gueltig_bis), code95Bis: datum(r.code95_bis) };
}

export function erkennungBereit() {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

export async function fuehrerscheinLesen(vorne: Uint8Array, hinten: Uint8Array): Promise<Erkannt | null> {
  const client = new Anthropic({ timeout: 60_000, maxRetries: 1 });
  const bild = (daten: Uint8Array) => ({
    type: "image" as const,
    source: { type: "base64" as const, media_type: "image/jpeg" as const, data: Buffer.from(daten).toString("base64") },
  });

  const antwort = await client.beta.messages.create({
    model: "claude-opus-5-5",
    max_tokens: 4000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    output_config: { effort: "low", format: { type: "json_schema", schema: SCHEMA } },
    messages: [{ role: "user", content: [bild(vorne), bild(hinten), { type: "text", text: ANWEISUNG }] }],
  });
  if (antwort.stop_reason === "refusal" || antwort.stop_reason === "max_tokens") return null;

  const text = antwort.content.find((b) => b.type === "text");
  if (!text || text.type !== "text") return null;
  try {
    return bereinigen(JSON.parse(text.text));
  } catch {
    return null;
  }
}
