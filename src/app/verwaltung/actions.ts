"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

function text(formData: FormData, feld: string) {
  const wert = String(formData.get(feld) ?? "").trim();
  return wert === "" ? null : wert;
}

export async function firmaAnlegen(formData: FormData) {
  const name = text(formData, "name");
  if (!name) return;
  const supabase = await createClient();
  // Id hier erzeugen: Die Mitgliedschaft entsteht erst per Trigger nach dem
  // Einfügen, ein direktes Zurücklesen würde an den Zugriffsregeln scheitern.
  const id = crypto.randomUUID();
  const { error } = await supabase.from("firmen").insert({ id, name, adresse: text(formData, "adresse") });
  if (error) throw new Error("Firma konnte nicht angelegt werden.");
  redirect(`/verwaltung/${id}`);
}

export async function fahrerAnlegen(firmaId: string, formData: FormData) {
  const vorname = text(formData, "vorname");
  const nachname = text(formData, "nachname");
  if (!vorname || !nachname) return;
  const supabase = await createClient();
  const { error } = await supabase.from("fahrer").insert({
    firma_id: firmaId,
    vorname,
    nachname,
    email: text(formData, "email")?.toLowerCase() ?? null,
    telefon: text(formData, "telefon"),
  });
  if (error) throw new Error("Fahrer konnte nicht angelegt werden.");
  revalidatePath(`/verwaltung/${firmaId}`);
}

export async function fahrzeugAnlegen(firmaId: string, formData: FormData) {
  const kennzeichen = text(formData, "kennzeichen")?.toUpperCase();
  if (!kennzeichen) return;
  const supabase = await createClient();
  const { error } = await supabase.from("fahrzeuge").insert({
    firma_id: firmaId,
    kennzeichen,
    ist_anhaenger: formData.get("ist_anhaenger") === "on",
    adr: formData.get("adr") === "on",
    hu_faellig: text(formData, "hu_faellig"),
    sp_faellig: text(formData, "sp_faellig"),
    tacho_faellig: text(formData, "tacho_faellig"),
  });
  if (error) throw new Error("Fahrzeug konnte nicht angelegt werden. Gibt es das Kennzeichen schon?");
  revalidatePath(`/verwaltung/${firmaId}`);
}
