import type { SupabaseClient } from "@supabase/supabase-js";
import { kontrollePdf, type BerichtDaten } from "./pdf";

type Zeile = {
  id: string;
  durchgefuehrt_am: string;
  eingegangen_am: string;
  unterschrift_pfad: string;
  fristen: BerichtDaten["fristen"];
  firma: { name: string } | null;
  fahrer: { vorname: string; nachname: string } | null;
  fahrzeug: { kennzeichen: string } | null;
  anhaenger: { kennzeichen: string } | null;
  antworten: {
    abschnitt: string;
    frage: string;
    antwort_ja: boolean;
    ist_mangel: boolean;
    bemerkung: string | null;
    foto_pfade: string[];
    reihenfolge: number;
  }[];
};

async function laden(supabase: SupabaseClient, pfad: string): Promise<Uint8Array | null> {
  const { data } = await supabase.storage.from("kontrollen").download(pfad);
  return data ? new Uint8Array(await data.arrayBuffer()) : null;
}

// Lädt eine Kontrolle mit den Rechten des Nutzers (RLS) und erzeugt das PDF.
// null, wenn die Kontrolle nicht existiert oder nicht sichtbar ist.
export async function kontrolleBericht(supabase: SupabaseClient, kontrolleId: string) {
  const { data: k } = await supabase
    .from("kontrollen")
    .select(
      `id, durchgefuehrt_am, eingegangen_am, unterschrift_pfad, fristen,
       firma:firmen(name),
       fahrer(vorname, nachname),
       fahrzeug:fahrzeuge!kontrollen_fahrzeug_id_fkey(kennzeichen),
       anhaenger:fahrzeuge!kontrollen_anhaenger_id_fkey(kennzeichen),
       antworten(abschnitt, frage, antwort_ja, ist_mangel, bemerkung, foto_pfade, reihenfolge)`,
    )
    .eq("id", kontrolleId)
    .maybeSingle<Zeile>();
  if (!k) return null;

  const antworten = await Promise.all(
    [...k.antworten]
      .sort((a, b) => a.reihenfolge - b.reihenfolge)
      .map(async (a) => ({
        abschnitt: a.abschnitt,
        frage: a.frage,
        antwortJa: a.antwort_ja,
        istMangel: a.ist_mangel,
        bemerkung: a.bemerkung,
        // Nur Mangel-Fotos ins PDF, die monatlichen Reifenfotos bleiben in der App.
        fotos: a.ist_mangel
          ? (await Promise.all(a.foto_pfade.map((p) => laden(supabase, p)))).filter((f): f is Uint8Array => f !== null)
          : [],
      })),
  );

  const kennzeichen = k.fahrzeug?.kennzeichen ?? "";
  const pdf = await kontrollePdf({
    firma: k.firma?.name ?? "",
    kennzeichen,
    anhaenger: k.anhaenger?.kennzeichen ?? null,
    fahrer: k.fahrer ? `${k.fahrer.vorname} ${k.fahrer.nachname}` : "",
    durchgefuehrtAm: k.durchgefuehrt_am,
    eingegangenAm: k.eingegangen_am,
    fristen: k.fristen ?? {},
    antworten,
    unterschrift: await laden(supabase, k.unterschrift_pfad),
  });

  const tag = new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Berlin" }).format(new Date(k.durchgefuehrt_am));
  const dateiname = `Abfahrtskontrolle-${kennzeichen.replace(/[^A-Za-z0-9-]+/g, "-")}-${tag}.pdf`;
  return { pdf, dateiname };
}
