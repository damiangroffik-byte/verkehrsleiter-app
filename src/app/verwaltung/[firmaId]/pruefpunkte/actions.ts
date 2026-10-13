"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { EIGENE_KATEGORIEN, kategorieNummer } from "@/lib/kontrolle/kategorien";
import { createClient } from "@/lib/supabase/server";

function ziel(firmaId: string, gruppe: string, meldung?: { fehler?: string; gespeichert?: boolean }) {
  const q = new URLSearchParams({ gruppe });
  if (meldung?.fehler) q.set("fehler", meldung.fehler);
  if (meldung?.gespeichert) q.set("gespeichert", "1");
  return `/verwaltung/${firmaId}/pruefpunkte?${q}`;
}

function neuLaden(firmaId: string) {
  revalidatePath(`/verwaltung/${firmaId}/pruefpunkte`);
  revalidatePath("/fahrer", "layout");
}

const KEIN_RECHT = "Speichern hat nicht geklappt. Nur der Verkehrsleiter kann Prüfpunkte ändern.";

// Zusatzpunkt ein- oder ausschalten. Pflichtpunkte sperrt die Datenbank.
export async function pruefpunktSchalten(firmaId: string, gruppe: string, id: string, aktiv: boolean) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("pruefpunkte")
    .update({ aktiv })
    .eq("id", id)
    .eq("firma_id", firmaId)
    .eq("pflicht", false)
    .eq("veraltet", false)
    .select("id");
  if (error || !data?.length) redirect(ziel(firmaId, gruppe, { fehler: KEIN_RECHT }));
  neuLaden(firmaId);
  redirect(ziel(firmaId, gruppe));
}

export async function pruefpunktAnlegen(firmaId: string, gruppe: string, formData: FormData) {
  const frage = String(formData.get("frage") ?? "").trim().replace(/\s+/g, " ");
  const abschnitt = String(formData.get("kategorie") ?? "");
  if (frage.length < 3 || frage.length > 200) redirect(ziel(firmaId, gruppe, { fehler: "Bitte schreibe die Frage an den Fahrer (3 bis 200 Zeichen)." }));
  if (!EIGENE_KATEGORIEN.includes(abschnitt)) redirect(ziel(firmaId, gruppe, { fehler: "Bitte wähle eine Kategorie." }));

  const supabase = await createClient();
  // Eigene Punkte ans Ende der Kategorie: Kategorie * 100 + 50 + n.
  const basis = kategorieNummer(abschnitt) * 100 + 50;
  const { data: letzte } = await supabase
    .from("pruefpunkte")
    .select("reihenfolge")
    .eq("fahrzeugart_id", gruppe)
    .gte("reihenfolge", basis)
    .lt("reihenfolge", basis + 50)
    .order("reihenfolge", { ascending: false })
    .limit(1);
  const bedingung = abschnitt === "UVV Ladebordwand" ? "ladebordwand" : abschnitt === "UVV Elektro-Niederhubwagen" ? "ameise" : "immer";
  const { error } = await supabase.from("pruefpunkte").insert({
    firma_id: firmaId,
    fahrzeugart_id: gruppe,
    abschnitt,
    reihenfolge: (letzte?.[0]?.reihenfolge ?? basis) + 1,
    frage,
    mangel_bei_ja: false,
    bedingung,
    foto_bei_mangel: formData.get("foto_bei_mangel") === "on",
    mangel_stoppt: formData.get("mangel_stoppt") === "on",
  });
  if (error) redirect(ziel(firmaId, gruppe, { fehler: KEIN_RECHT }));
  neuLaden(firmaId);
  redirect(ziel(firmaId, gruppe, { gespeichert: true }));
}

export async function pruefpunktLoeschen(firmaId: string, gruppe: string, id: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.from("pruefpunkte").delete().eq("id", id).eq("firma_id", firmaId).eq("eigen", true).select("id");
  if (error || !data?.length) redirect(ziel(firmaId, gruppe, { fehler: KEIN_RECHT }));
  neuLaden(firmaId);
  redirect(ziel(firmaId, gruppe));
}

export async function gruppeAnlegen(firmaId: string, vorlage: string, formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("fahrzeuggruppe_anlegen", { f: firmaId, gruppenname: name, vorlage });
  if (error || !data) {
    redirect(ziel(firmaId, vorlage, { fehler: error?.code === "P0001" ? error.message : "Die Gruppe konnte nicht angelegt werden." }));
  }
  neuLaden(firmaId);
  redirect(ziel(firmaId, String(data), { gespeichert: true }));
}

// Fahrzeug einer Gruppe zuordnen.
export async function fahrzeugZuordnen(firmaId: string, gruppe: string, formData: FormData) {
  const fahrzeugId = String(formData.get("fahrzeug") ?? "");
  const neu = String(formData.get("gruppe") ?? "");
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("fahrzeuge")
    .update({ fahrzeugart_id: neu })
    .eq("id", fahrzeugId)
    .eq("firma_id", firmaId)
    .select("id");
  if (error || !data?.length) redirect(ziel(firmaId, gruppe, { fehler: "Das Fahrzeug konnte nicht zugeordnet werden." }));
  neuLaden(firmaId);
  revalidatePath(`/verwaltung/${firmaId}`, "layout");
  redirect(ziel(firmaId, gruppe, { gespeichert: true }));
}
