import { redirect } from "next/navigation";
import { holeNutzer, istVerwalter } from "@/lib/daten";
import { createClient } from "@/lib/supabase/server";

// Leitet je nach Rolle weiter: Verwalter in die Verwaltung, Fahrer in die Fahrer-App.
export default async function Start() {
  // Neu angelegte Fahrer werden beim Login mit ihrem Konto verknüpft.
  const supabase = await createClient();
  await supabase.rpc("fahrer_verknuepfen");

  const { mitgliedschaften } = await holeNutzer();
  const nurFahrer =
    mitgliedschaften.length > 0 && mitgliedschaften.every((m) => !istVerwalter(m.rolle));

  redirect(nurFahrer ? "/fahrer" : "/verwaltung");
}
