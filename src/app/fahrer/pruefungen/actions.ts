"use server";

import { revalidatePath } from "next/cache";
import { istArt } from "@/lib/fahrzeugfristen";
import { erkennungBereit, fristLesen } from "@/lib/fristErkennung";
import { createClient } from "@/lib/supabase/server";

// Datum vom Foto lesen; ohne API-Schlüssel oder bei unlesbarem Foto kommt null zurück.
export async function fristAuslesen(firmaId: string, fahrzeugId: string, art: string, pfad: string): Promise<string | null> {
  if (!erkennungBereit() || !istArt(art) || !pfad.startsWith(`${firmaId}/${fahrzeugId}/`)) return null;
  const supabase = await createClient();
  const { data } = await supabase.storage.from("fahrzeugfristen").download(pfad);
  if (!data) return null;
  try {
    return await fristLesen(art, new Uint8Array(await data.arrayBuffer()));
  } catch (e) {
    console.error("Frist-Erkennung fehlgeschlagen", e instanceof Error ? e.message : e);
    return null;
  }
}

export async function fristSpeichern(fahrzeugId: string, art: string, datum: string, foto: string | null): Promise<{ ok: true } | { ok: false; fehler: string }> {
  if (!istArt(art) || !/^\d{4}-\d{2}-\d{2}$/.test(datum)) return { ok: false, fehler: "Bitte gib ein gültiges Datum ein." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("fahrzeug_frist_erfassen", { fz: fahrzeugId, art, datum, foto });
  if (error) return { ok: false, fehler: error.code === "P0001" ? error.message : "Speichern hat nicht geklappt. Bitte versuche es noch einmal." };
  revalidatePath("/fahrer", "layout");
  revalidatePath("/verwaltung", "layout");
  return { ok: true };
}
