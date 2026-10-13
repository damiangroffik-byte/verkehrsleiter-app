"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

// Mangel auf „erledigt“ (mit freiwilligem Vermerk) oder zurück auf „offen“ setzen.
export async function mangelStatus(firmaId: string, mangelId: string, erledigt: boolean, zurueck: string, formData: FormData) {
  const supabase = await createClient();
  const { error } = erledigt
    ? await supabase.rpc("mangel_schliessen", { mangel_id: mangelId, vermerk: String(formData.get("vermerk") ?? "").slice(0, 500) })
    : await supabase.rpc("mangel_oeffnen", { mangel_id: mangelId });
  // Nur Pfade innerhalb der eigenen Firma als Rücksprung.
  const ziel = zurueck.startsWith(`/verwaltung/${firmaId}/`) ? zurueck : `/verwaltung/${firmaId}/maengel`;
  if (error) redirect(`${ziel}?fehler=${encodeURIComponent(error.code === "P0001" ? error.message : "Speichern hat nicht geklappt. Bitte noch einmal versuchen.")}`);
  revalidatePath(`/verwaltung/${firmaId}`, "layout");
  redirect(ziel);
}
