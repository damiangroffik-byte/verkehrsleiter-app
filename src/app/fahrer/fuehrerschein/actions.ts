"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { after } from "next/server";
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
