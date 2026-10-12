"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

// Block für die Firma ein- oder ausschalten (nur Verkehrsleiter, RLS).
export async function unterweisungSchalten(firmaId: string, schluessel: string, aktiv: boolean) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("firma_unterweisungen")
    .upsert({ firma_id: firmaId, unterweisung: schluessel, aktiv }, { onConflict: "firma_id,unterweisung" });
  const ziel = `/verwaltung/${firmaId}/unterweisungen`;
  if (error) redirect(`${ziel}?fehler=${encodeURIComponent("Speichern hat nicht geklappt. Nur der Verkehrsleiter kann das ändern.")}`);
  revalidatePath(ziel);
  revalidatePath("/fahrer", "layout");
  redirect(ziel);
}
