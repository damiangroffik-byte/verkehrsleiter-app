"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { after } from "next/server";
import { erkennungBereit, fuehrerscheinLesen, type Erkannt } from "@/lib/fuehrerschein/erkennung";
import { fuehrerscheinMail, mailBereit, sendeMail } from "@/lib/mail";
import { createClient } from "@/lib/supabase/server";

export type FuehrerscheinEntwurf = {
  pruefungId: string;
  firmaId: string;
  fotoVorne: string | null;
  fotoHinten: string | null;
  klassen: string[];
  gueltigBis: string;
  code95Bis: string;
};

export type FuehrerscheinErgebnis = { ok: true } | { ok: false; fehler: string; feld?: string };

type Antwort = { pruefung_id: string; fahrer?: string; verkehrsleiter_emails: string[] };

export async function fuehrerscheinEinreichen(entwurf: FuehrerscheinEntwurf): Promise<FuehrerscheinErgebnis> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("fuehrerschein_einreichen", { p: entwurf });
  if (error) {
    // Eigene Fehler der Datenbankfunktion sind für den Fahrer formuliert (Code P0001).
    const eigen = error.code === "P0001";
    return {
      ok: false,
      fehler: eigen ? error.message : "Der Führerschein konnte nicht gespeichert werden. Bitte versuche es noch einmal.",
      feld: eigen ? (error.hint ?? undefined) : undefined,
    };
  }

  const ergebnis = data as Antwort;
  const basis = process.env.NEXT_PUBLIC_APP_URL ?? (await headers()).get("origin") ?? "";
  if (ergebnis.verkehrsleiter_emails.length > 0 && mailBereit()) {
    after(async () => {
      try {
        const { betreff, text } = fuehrerscheinMail({
          fahrer: ergebnis.fahrer ?? "Ein Fahrer",
          pruefLink: `${basis}/verwaltung/${entwurf.firmaId}/fuehrerschein/${ergebnis.pruefung_id}`,
        });
        await sendeMail(ergebnis.verkehrsleiter_emails, betreff, text);
      } catch (e) {
        console.error("Führerschein-Mail fehlgeschlagen", ergebnis.pruefung_id, e);
      }
    });
  }

  revalidatePath("/fahrer");
  revalidatePath("/fahrer/fuehrerschein");
  return { ok: true };
}

export type AuslesenErgebnis = { ok: true; werte: Erkannt } | { ok: false };

// Vorschlag für Klassen und Fristen aus den Fotos. Ohne API-Schlüssel oder bei
// unlesbaren Fotos kommt nichts zurück; der Fahrer füllt dann selbst aus.
export async function fuehrerscheinAuslesen(firmaId: string, fotoVorne: string, fotoHinten: string): Promise<AuslesenErgebnis> {
  if (!erkennungBereit()) return { ok: false };
  if (![fotoVorne, fotoHinten].every((p) => p.startsWith(`${firmaId}/`))) return { ok: false };

  const supabase = await createClient();
  // Herunterladen klappt nur mit Leserecht (eigene Fotos oder Verwalter), siehe Storage-Regeln.
  const [vorne, hinten] = await Promise.all(
    [fotoVorne, fotoHinten].map(async (p) => {
      const { data } = await supabase.storage.from("fuehrerscheine").download(p);
      return data ? new Uint8Array(await data.arrayBuffer()) : null;
    }),
  );
  if (!vorne || !hinten) return { ok: false };

  try {
    const werte = await fuehrerscheinLesen(vorne, hinten);
    return werte ? { ok: true, werte } : { ok: false };
  } catch (e) {
    console.error("Führerschein-Erkennung fehlgeschlagen", e instanceof Error ? e.message : e);
    return { ok: false };
  }
}
