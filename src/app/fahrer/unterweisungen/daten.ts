import type { SupabaseClient } from "@supabase/supabase-js";
import { infosBereinigen } from "@/lib/unterweisung/infos";
import { blockAktiv, type Auswahl, type Teilnahme, type Unterweisung } from "@/lib/unterweisung/regeln";

type EigenerFahrer = { id: string; firma_id: string; vorname: string; firmen: { name: string } | null };

// Fahrer-Datensatz, für ihn aktive Blöcke (eigene Zuordnung vor Firmen-Auswahl), eigene Teilnahmen und allgemeine Informationen (RLS liefert nur die eigenen).
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

  const [{ data: bloecke }, { data: auswahl }, { data: zuordnung }, { data: teilnahmen }, { data: infos }, { data: bestaetigung }] = await Promise.all([
    supabase.from("unterweisungen").select("schluessel, titel, kurz, symbol, dauer_min").order("reihenfolge").returns<Unterweisung[]>(),
    supabase.from("firma_unterweisungen").select("unterweisung, aktiv").eq("firma_id", fahrer.firma_id).returns<Auswahl[]>(),
    supabase.from("fahrer_unterweisungen").select("unterweisung, aktiv").eq("fahrer_id", fahrer.id).returns<Auswahl[]>(),
    supabase
      .from("unterweisung_teilnahmen")
      .select("id, unterweisung, durchgefuehrt_am, prozent, bestanden, unterschrieben_am, gueltig_bis")
      .eq("fahrer_id", fahrer.id)
      .order("durchgefuehrt_am", { ascending: false })
      .returns<Teilnahme[]>(),
    supabase.from("firma_infos").select("angaben, geaendert_am").eq("firma_id", fahrer.firma_id).maybeSingle(),
    supabase
      .from("firma_info_bestaetigungen")
      .select("stand, bestaetigt_am")
      .eq("fahrer_id", fahrer.id)
      .order("stand", { ascending: false })
      .limit(1)
      .returns<{ stand: string; bestaetigt_am: string }[]>(),
  ]);
  const angaben = infosBereinigen(infos?.angaben ?? {});
  const letzte = bestaetigung?.[0];
  // Bestätigung gilt nur für den Stand, den der Fahrer gelesen hat.
  const infosBestaetigt = letzte && infos && Date.parse(letzte.stand) >= Date.parse(infos.geaendert_am) ? letzte.bestaetigt_am : null;
  return {
    fahrer,
    bloecke: (bloecke ?? []).filter((b) => blockAktiv(b.schluessel, auswahl ?? [], zuordnung ?? [])),
    teilnahmen: teilnahmen ?? [],
    infos: angaben,
    infosBestaetigt,
    infosOffen: Object.keys(angaben).length > 0 && !infosBestaetigt,
  };
}
