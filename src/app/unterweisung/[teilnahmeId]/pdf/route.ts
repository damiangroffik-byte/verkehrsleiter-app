import type { NextRequest } from "next/server";
import { nachweisPdf } from "@/lib/unterweisung/pdf";
import type { Abschnitt } from "@/lib/unterweisung/regeln";
import { createClient } from "@/lib/supabase/server";

type Zeile = {
  titel: string;
  durchgefuehrt_am: string;
  unterschrieben_am: string | null;
  unterschrift_pfad: string | null;
  gueltig_bis: string | null;
  richtig: number;
  gesamt: number;
  prozent: number;
  antworten: { frage: string; antwort: string; richtig: boolean }[];
  firma: { name: string } | null;
  fahrer: { vorname: string; nachname: string } | null;
  inhalt: { inhalt: Abschnitt[] } | null;
};

// Nachweis einer unterschriebenen Unterweisung. Sichtbar für Verwalter der Firma und den Fahrer selbst (RLS).
export async function GET(_req: NextRequest, ctx: RouteContext<"/unterweisung/[teilnahmeId]/pdf">) {
  const { teilnahmeId } = await ctx.params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new Response("Bitte melde dich an.", { status: 401 });

  const { data: t } = await supabase
    .from("unterweisung_teilnahmen")
    .select(
      `titel, durchgefuehrt_am, unterschrieben_am, unterschrift_pfad, gueltig_bis, richtig, gesamt, prozent, antworten,
       firma:firmen(name), fahrer(vorname, nachname), inhalt:unterweisungen(inhalt)`,
    )
    .eq("id", teilnahmeId)
    .maybeSingle<Zeile>();
  if (!t || !t.unterschrieben_am || !t.gueltig_bis || !t.unterschrift_pfad) return new Response("Nachweis nicht gefunden.", { status: 404 });

  const { data: bild } = await supabase.storage.from("unterweisungen").download(t.unterschrift_pfad);
  const fahrer = t.fahrer ? `${t.fahrer.vorname} ${t.fahrer.nachname}` : "";
  const pdf = await nachweisPdf({
    firma: t.firma?.name ?? "",
    fahrer,
    titel: t.titel,
    durchgefuehrtAm: t.durchgefuehrt_am,
    unterschriebenAm: t.unterschrieben_am,
    gueltigBis: t.gueltig_bis,
    richtig: t.richtig,
    gesamt: t.gesamt,
    prozent: t.prozent,
    abschnitte: t.inhalt?.inhalt ?? [],
    antworten: t.antworten,
    unterschrift: bild ? new Uint8Array(await bild.arrayBuffer()) : null,
  });

  const tag = new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Berlin" }).format(new Date(t.unterschrieben_am));
  const dateiname = `Unterweisung_${t.titel}_${fahrer}_${tag}.pdf`.replace(/[^\wäöüÄÖÜß.-]+/g, "_");
  return new Response(Buffer.from(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${dateiname}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
