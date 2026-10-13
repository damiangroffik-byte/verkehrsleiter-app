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
  const angaben = infosBereinigen(roh);
  const supabase = await createClient();
  // Nur bei echter Änderung neuer Stand, sonst müssten alle Fahrer unnötig neu bestätigen.
  const { data: alt } = await supabase.from("firma_infos").select("angaben").eq("firma_id", firmaId).maybeSingle();
  if (alt && JSON.stringify(infosBereinigen(alt.angaben ?? {})) === JSON.stringify(angaben)) redirect(`${ziel}?gespeichert=1#infos`);
  const { data, error } = await supabase
    .from("firma_infos")
    .upsert({ firma_id: firmaId, angaben, geaendert_am: new Date().toISOString() })
    .select("firma_id");
  if (error || !data?.length) {
    redirect(`${ziel}?fehler=${encodeURIComponent("Speichern hat nicht geklappt. Nur der Verkehrsleiter kann die Informationen ändern.")}#infos`);
  }
  revalidatePath("/fahrer", "layout");
  redirect(`${ziel}?gespeichert=1#infos`);
}

export async function geburtstagEinstellen(firmaId: string, formData: FormData) {
  const ziel = `/verwaltung/${firmaId}/einstellungen`;
  const aktiv = formData.get("aktiv") === "on";
  const vorlauf = Number(formData.get("vorlauf"));
  const text = String(formData.get("text") ?? "").trim();
  if (!Number.isInteger(vorlauf) || vorlauf < 1 || vorlauf > 60 || text.length > 2000) {
    redirect(`${ziel}?fehler=${encodeURIComponent("Bitte wähle gültige Werte aus.")}#geburtstag`);
  }
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("firma_einstellungen")
    .update({ geburtstag_aktiv: aktiv, geburtstag_vorlauf_tage: vorlauf, geburtstag_text: text || null })
    .eq("firma_id", firmaId)
    .select("firma_id");
  if (error || !data?.length) {
    redirect(`${ziel}?fehler=${encodeURIComponent("Speichern hat nicht geklappt. Nur der Verkehrsleiter kann Einstellungen ändern.")}#geburtstag`);
  }
  revalidatePath(`/verwaltung/${firmaId}`, "layout");
  revalidatePath("/fahrer", "layout");
  redirect(`${ziel}?gespeichert=1#geburtstag`);
}
