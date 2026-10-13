"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

function wert(formData: FormData, feld: string) {
  const w = String(formData.get(feld) ?? "").trim();
  return w === "" ? null : w;
}

export async function fahrerSpeichern(firmaId: string, fahrerId: string, formData: FormData) {
  const ziel = `/verwaltung/${firmaId}/fahrer/${fahrerId}`;
  const vorname = wert(formData, "vorname");
  const nachname = wert(formData, "nachname");
  if (!vorname || !nachname) redirect(`${ziel}?fehler=${encodeURIComponent("Bitte Vorname und Nachname eintragen.")}`);

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("fahrer")
    .update({
      vorname,
      nachname,
      telefon: wert(formData, "telefon"),
      geburtsdatum: wert(formData, "geburtsdatum"),
      geburtstag_gruss: formData.get("geburtstag_gruss") === "on",
      fqn_gueltig_bis: wert(formData, "fqn_gueltig_bis"),
      adr_gueltig_bis: wert(formData, "adr_gueltig_bis"),
      fahrerkarte_gueltig_bis: wert(formData, "fahrerkarte_gueltig_bis"),
    })
    .eq("id", fahrerId)
    .eq("firma_id", firmaId)
    .select("id");
  if (error || !data?.length) redirect(`${ziel}?fehler=${encodeURIComponent("Speichern hat nicht geklappt. Bitte noch einmal versuchen.")}`);

  revalidatePath(`/verwaltung/${firmaId}`, "layout");
  redirect(`${ziel}?gespeichert=1`);
}

// Unterweisung für einen Fahrer ein- oder ausschalten. Entspricht der Wert dem Standard der Firma,
// wird die eigene Zuordnung gelöscht, damit spätere Änderungen am Standard wieder greifen.
export async function fahrerUnterweisungSchalten(firmaId: string, fahrerId: string, schluessel: string, aktiv: boolean, standard: boolean) {
  const ziel = `/verwaltung/${firmaId}/fahrer/${fahrerId}`;
  const supabase = await createClient();
  const { error } =
    aktiv === standard
      ? await supabase.from("fahrer_unterweisungen").delete().eq("fahrer_id", fahrerId).eq("unterweisung", schluessel)
      : await supabase
          .from("fahrer_unterweisungen")
          .upsert({ firma_id: firmaId, fahrer_id: fahrerId, unterweisung: schluessel, aktiv }, { onConflict: "fahrer_id,unterweisung" });
  if (error) redirect(`${ziel}?fehler=${encodeURIComponent("Speichern hat nicht geklappt. Bitte noch einmal versuchen.")}#unterweisungen`);
  revalidatePath(`/verwaltung/${firmaId}`, "layout");
  revalidatePath("/fahrer", "layout");
  redirect(`${ziel}#unterweisungen`);
}
