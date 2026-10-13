"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { INFO_FELDER, infosBereinigen } from "@/lib/unterweisung/infos";

export async function fuehrerscheinEinstellen(firmaId: string, formData: FormData) {
  const intervall = Number(formData.get("intervall"));
  const vorwarnung = Number(formData.get("vorwarnung"));
  const ziel = `/verwaltung/${firmaId}/einstellungen`;
  if (!Number.isInteger(intervall) || intervall < 1 || intervall > 12 || !Number.isInteger(vorwarnung) || vorwarnung < 0 || vorwarnung > 90) {
    redirect(`${ziel}?fehler=${encodeURIComponent("Bitte wähle gültige Werte aus.")}`);
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("firma_einstellungen")
    .update({ fuehrerschein_intervall_monate: intervall, fuehrerschein_vorwarnung_tage: vorwarnung })
    .eq("firma_id", firmaId)
    .select("firma_id");
  // Ohne Recht liefert RLS keinen Fehler, sondern ändert einfach nichts.
  if (error || !data?.length) {
    redirect(`${ziel}?fehler=${encodeURIComponent("Speichern hat nicht geklappt. Nur der Verkehrsleiter kann Einstellungen ändern.")}`);
  }
  revalidatePath(`/verwaltung/${firmaId}`, "layout");
  revalidatePath("/fahrer", "layout");
  redirect(`${ziel}?gespeichert=1`);
}

export async function infosSpeichern(firmaId: string, formData: FormData) {
  const roh = Object.fromEntries(INFO_FELDER.map((f) => [f.schluessel, formData.getAll(f.schluessel)]));
  const ziel = `/verwaltung/${firmaId}/einstellungen`;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("firma_infos")
    .upsert({ firma_id: firmaId, angaben: infosBereinigen(roh), geaendert_am: new Date().toISOString() })
    .select("firma_id");
  if (error || !data?.length) {
    redirect(`${ziel}?fehler=${encodeURIComponent("Speichern hat nicht geklappt. Nur der Verkehrsleiter kann die Informationen ändern.")}#infos`);
  }
  revalidatePath("/fahrer", "layout");
  redirect(`${ziel}?gespeichert=1#infos`);
}
