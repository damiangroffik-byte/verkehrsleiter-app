"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

async function pruefen(firmaId: string, pruefungId: string, bestaetigt: boolean, vermerk: string) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("fuehrerschein_pruefen", { pruefung_id: pruefungId, bestaetigt, vermerk });
  if (error) {
    const text = error.code === "P0001" ? error.message : "Speichern hat nicht geklappt. Bitte noch einmal versuchen.";
    redirect(`/verwaltung/${firmaId}/fuehrerschein/${pruefungId}?fehler=${encodeURIComponent(text)}`);
  }
  revalidatePath(`/verwaltung/${firmaId}`);
  redirect(`/verwaltung/${firmaId}`);
}

export async function fuehrerscheinBestaetigen(firmaId: string, pruefungId: string) {
  await pruefen(firmaId, pruefungId, true, "");
}

export async function fuehrerscheinAblehnen(firmaId: string, pruefungId: string, formData: FormData) {
  await pruefen(firmaId, pruefungId, false, String(formData.get("vermerk") ?? ""));
}
