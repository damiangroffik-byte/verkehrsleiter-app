import { notFound } from "next/navigation";
import { Kopfleiste } from "@/components/Kopfleiste";
import { holeNutzer } from "@/lib/daten";
import type { Abschnitt, Frage } from "@/lib/unterweisung/regeln";
import { unterweisungenLaden } from "../daten";
import { UnterweisungAblauf } from "./UnterweisungAblauf";

export default async function UnterweisungSeite({ params }: PageProps<"/fahrer/unterweisungen/[schluessel]">) {
  const { schluessel } = await params;
  const { supabase, user } = await holeNutzer();
  const daten = await unterweisungenLaden(supabase, user.id);
  const block = daten?.bloecke.find((b) => b.schluessel === schluessel);
  if (!daten || !block) notFound();

  const [{ data: inhalt }, { data: fragen }] = await Promise.all([
    supabase.from("unterweisungen").select("inhalt").eq("schluessel", schluessel).single<{ inhalt: Abschnitt[] }>(),
    supabase.rpc("unterweisung_fragen_lesen", { u: schluessel }),
  ]);

  return (
    <main className="flex flex-1 flex-col">
      <Kopfleiste titel={block.titel} untertitel="Unterweisung" zurueck="/fahrer/unterweisungen" />
      <UnterweisungAblauf
        firmaId={daten.fahrer.firma_id}
        schluessel={schluessel}
        titel={block.titel}
        dauer={block.dauer_min}
        abschnitte={inhalt?.inhalt ?? []}
        fragen={(fragen as Frage[] | null) ?? []}
      />
    </main>
  );
}
