import type { SupabaseClient } from "@supabase/supabase-js";
import { FAHRZEUG_SPALTEN, standardRegel, type Art, type FristFahrzeug, type Regel } from "@/lib/fahrzeugfristen";

type EigenerFahrer = { id: string; firma_id: string; firmen: { name: string } | null };

// Fahrzeuge der eigenen Firma mit ihren Prüffristen und den Vorwarnzeiten.
export async function pruefungenLaden(supabase: SupabaseClient, userId: string) {
  const { data: ich } = await supabase
    .from("fahrer")
    .select("id, firma_id, firmen(name)")
    .eq("user_id", userId)
    .eq("aktiv", true)
    .limit(1)
    .returns<EigenerFahrer[]>();
  const fahrer = ich?.[0];
  if (!fahrer) return null;
  const [{ data: fahrzeuge }, { data: regeln }] = await Promise.all([
    supabase.from("fahrzeuge").select(FAHRZEUG_SPALTEN).eq("firma_id", fahrer.firma_id).eq("aktiv", true).order("kennzeichen").returns<FristFahrzeug[]>(),
    supabase.from("frist_regeln").select("art, vorwarnung_tage").eq("firma_id", fahrer.firma_id).returns<Pick<Regel, "art" | "vorwarnung_tage">[]>(),
  ]);
  const vorwarnung = (art: Art) => regeln?.find((r) => r.art === art)?.vorwarnung_tage ?? standardRegel(art).vorwarnung_tage;
  return { fahrer, fahrzeuge: fahrzeuge ?? [], vorwarnung };
}
