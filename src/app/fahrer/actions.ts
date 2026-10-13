"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

// Fahrer bestätigt eine Nachricht vom Büro (z. B. Werkstatttermin).
export async function nachrichtGelesen(nachrichtId: string) {
  const supabase = await createClient();
  await supabase.rpc("nachricht_gelesen", { nachricht_id: nachrichtId });
  revalidatePath("/fahrer");
}
