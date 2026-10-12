"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type AuswertungEntwurf = {
  teilnahmeId: string;
  firmaId: string;
  unterweisung: string;
  // Frage-ID → gewählte Antwort (1 = erste Antwort in der Datenbank)
  antworten: Record<string, number>;
};

export type Auswertung =
  | { ok: true; richtig: number; gesamt: number; prozent: number; bestanden: boolean; falsch: string[] }
  | { ok: false; fehler: string };

function fehlertext(error: { code?: string; message: string }, standard: string) {
  // Eigene Fehler der Datenbankfunktion sind für den Fahrer formuliert (Code P0001).
  return error.code === "P0001" ? error.message : standard;
}

// Test in der Datenbank auswerten; die richtigen Antworten verlassen die Datenbank nie.
export async function testAuswerten(entwurf: AuswertungEntwurf): Promise<Auswertung> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("unterweisung_auswerten", { p: entwurf });
  if (error) return { ok: false, fehler: fehlertext(error, "Der Test konnte nicht ausgewertet werden. Bitte versuche es noch einmal.") };
  const e = data as { richtig: number; gesamt: number; prozent: number; bestanden: boolean; falsch: string[] };
  revalidatePath("/fahrer", "layout");
  return { ok: true, ...e };
}

export async function unterweisungUnterschreiben(
  teilnahmeId: string,
  pfad: string,
): Promise<{ ok: true; gueltigBis: string } | { ok: false; fehler: string }> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("unterweisung_unterschreiben", { teilnahme: teilnahmeId, pfad });
  if (error) return { ok: false, fehler: fehlertext(error, "Die Unterschrift konnte nicht gespeichert werden. Bitte versuche es noch einmal.") };
  revalidatePath("/fahrer", "layout");
  revalidatePath("/verwaltung", "layout");
  return { ok: true, gueltigBis: (data as { gueltig_bis: string }).gueltig_bis };
}
