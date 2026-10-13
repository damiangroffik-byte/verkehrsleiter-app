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
  const vorlauf = Number(formData.get("vorlauf"));
  const text = String(formData.get("text") ?? "").trim();
  if (!Number.isInteger(vorlauf) || vorlauf < 1 || vorlauf > 60 || text.length > 2000) {
    redirect(`${ziel}?fehler=${encodeURIComponent("Bitte wähle gültige Werte aus.")}#geburtstag`);
  }
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("firma_einstellungen")
    .update({ geburtstag_vorlauf_tage: vorlauf, geburtstag_text: text || null })
    .eq("firma_id", firmaId)
    .select("firma_id");
  if (error || !data?.length) {
    redirect(`${ziel}?fehler=${encodeURIComponent("Speichern hat nicht geklappt. Nur der Verkehrsleiter kann Einstellungen ändern.")}#geburtstag`);
  }
  revalidatePath(`/verwaltung/${firmaId}`, "layout");
  revalidatePath("/fahrer", "layout");
  redirect(`${ziel}?gespeichert=1#geburtstag`);
}

export async function werkstattAnlegen(firmaId: string, formData: FormData) {
  const ziel = `/verwaltung/${firmaId}/einstellungen`;
  const wert = (n: string, max: number) => String(formData.get(n) ?? "").trim().slice(0, max) || null;
  const name = wert("name", 120);
  const email = wert("email", 200);
  if (!name) redirect(`${ziel}?fehler=${encodeURIComponent("Bitte einen Namen für die Werkstatt eingeben.")}#werkstaetten`);
  if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) redirect(`${ziel}?fehler=${encodeURIComponent("Die E-Mail-Adresse sieht nicht richtig aus.")}#werkstaetten`);
  const supabase = await createClient();
  const { error } = await supabase.from("werkstaetten").insert({ firma_id: firmaId, name, email, adresse: wert("adresse", 300), telefon: wert("telefon", 60) });
  if (error) redirect(`${ziel}?fehler=${encodeURIComponent("Speichern hat nicht geklappt.")}#werkstaetten`);
  revalidatePath(`/verwaltung/${firmaId}`, "layout");
  redirect(`${ziel}?gespeichert=1#werkstaetten`);
}

export async function werkstattLoeschen(firmaId: string, werkstattId: string) {
  const supabase = await createClient();
  await supabase.from("werkstaetten").delete().eq("id", werkstattId).eq("firma_id", firmaId);
  revalidatePath(`/verwaltung/${firmaId}`, "layout");
  redirect(`/verwaltung/${firmaId}/einstellungen?gespeichert=1#werkstaetten`);
}
