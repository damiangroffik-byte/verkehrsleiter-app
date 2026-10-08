import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type Rolle = "verkehrsleiter" | "unternehmer" | "fahrer";

export type Mitgliedschaft = {
  firma_id: string;
  rolle: Rolle;
  firmen: { name: string } | null;
};

// Angemeldeter Nutzer mit seinen Firmen. Ohne Anmeldung geht es zum Login.
export async function holeNutzer() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data } = await supabase
    .from("mitgliedschaften")
    .select("firma_id, rolle, firmen(name)")
    .eq("user_id", user.id)
    .returns<Mitgliedschaft[]>();

  return { supabase, user, mitgliedschaften: data ?? [] };
}

export function istVerwalter(rolle: Rolle) {
  return rolle === "verkehrsleiter" || rolle === "unternehmer";
}

// Zeitpunkt der Anfrage, einmal pro Seite ermittelt (Server Components rendern einmal).
export function jetzt() {
  return Date.now();
}
