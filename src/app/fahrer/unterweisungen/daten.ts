import type { SupabaseClient } from "@supabase/supabase-js";
import type { Teilnahme, Unterweisung } from "@/lib/unterweisung/regeln";

type EigenerFahrer = { id: string; firma_id: string; vorname: string; firmen: { name: string } | null };

// Fahrer-Datensatz, aktive Blöcke der Firma und eigene Teilnahmen (RLS liefert nur die eigenen).
export async function unterweisungenLaden(supabase: SupabaseClient, userId: string) {
  const { data: ich } = await supabase
    .from("fahrer")
    .select("id, firma_id, vorname, firmen(name)")
    .eq("user_id", userId)
    .eq("aktiv", true)
    .limit(1)
    .returns<EigenerFahrer[]>();
  const fahrer = ich?.[0];
  if (!fahrer) return null;

  const [{ data: bloecke }, { data: auswahl }, { data: teilnahmen }] = await Promise.all([
    supabase.from("unterweisungen").select("schluessel, titel, kurz, symbol, dauer_min").order("reihenfolge").returns<Unterweisung[]>(),
    supabase.from("firma_unterweisungen").select("unterweisung, aktiv").eq("firma_id", fahrer.firma_id).returns<{ unterweisung: string; aktiv: boolean }[]>(),
    supabase
      .from("unterweisung_teilnahmen")
      .select("id, unterweisung, durchgefuehrt_am, prozent, bestanden, unterschrieben_am, gueltig_bis")
      .eq("fahrer_id", fahrer.id)
      .order("durchgefuehrt_am", { ascending: false })
      .returns<Teilnahme[]>(),
  ]);
  const aus = new Set((auswahl ?? []).filter((a) => !a.aktiv).map((a) => a.unterweisung));
  return {
    fahrer,
    bloecke: (bloecke ?? []).filter((b) => !aus.has(b.schluessel)),
    teilnahmen: teilnahmen ?? [],
  };
}
