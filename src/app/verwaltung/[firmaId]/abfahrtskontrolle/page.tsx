import Link from "next/link";
import { notFound } from "next/navigation";
import { PdfKnopf } from "@/components/PdfKnopf";
import { Seitenkopf } from "@/components/verwaltung/Seitenkopf";
import { Karte } from "@/components/ui";
import { holeNutzer, istVerwalter } from "@/lib/daten";

type Kontrolle = {
  id: string;
  durchgefuehrt_am: string;
  hat_mangel: boolean;
  abfahrt_freigegeben: boolean;
  fahrer: { vorname: string; nachname: string } | null;
  fahrzeug: { kennzeichen: string } | null;
};

export default async function AbfahrtskontrolleSeite({ params }: PageProps<"/verwaltung/[firmaId]/abfahrtskontrolle">) {
  const { firmaId } = await params;
  const { supabase, mitgliedschaften } = await holeNutzer();
  const firma = mitgliedschaften.find((m) => m.firma_id === firmaId && istVerwalter(m.rolle));
  if (!firma) notFound();

  const { data: kontrollen } = await supabase
    .from("kontrollen")
    .select("id, durchgefuehrt_am, hat_mangel, abfahrt_freigegeben, fahrer(vorname, nachname), fahrzeug:fahrzeuge!kontrollen_fahrzeug_id_fkey(kennzeichen)")
    .eq("firma_id", firmaId)
    .order("durchgefuehrt_am", { ascending: false })
    .limit(50)
    .returns<Kontrolle[]>();

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-5 p-4 sm:p-6">
      <Seitenkopf titel="Abfahrtskontrolle" untertitel="Die letzten 50 Kontrollen deiner Fahrer">
        <Link href={`/verwaltung/${firmaId}/pruefpunkte`} className="flex h-12 items-center rounded-xl bg-marke-gelb px-5 font-semibold text-marke-blau">
          Prüfpunkte festlegen
        </Link>
      </Seitenkopf>
      <Karte>
        {kontrollen && kontrollen.length > 0 ? (
          <ul className="divide-y divide-gray-200">
            {kontrollen.map((k) => (
              <li key={k.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
                <span className="flex flex-col">
                  <span className="font-semibold">
                    {k.fahrzeug?.kennzeichen} · {k.fahrer ? `${k.fahrer.vorname} ${k.fahrer.nachname}` : ""}
                  </span>
                  <span className="text-sm text-gray-600">
                    {new Date(k.durchgefuehrt_am).toLocaleString("de-DE", { timeZone: "Europe/Berlin", dateStyle: "short", timeStyle: "short" })} Uhr ·{" "}
                    <span className={k.hat_mangel ? "font-semibold text-mangel" : "text-ok"}>
                      {k.hat_mangel ? (k.abfahrt_freigegeben ? "Mangel" : "Mangel · Fahrt gestoppt") : "ohne Mangel"}
                    </span>
                  </span>
                </span>
                <PdfKnopf href={`/kontrolle/${k.id}/pdf`} className="flex h-11 items-center rounded-xl border-2 border-marke-blau px-4 font-semibold text-marke-blau">
                  PDF
                </PdfKnopf>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-gray-600">Noch keine Kontrolle eingereicht.</p>
        )}
      </Karte>
    </main>
  );
}
