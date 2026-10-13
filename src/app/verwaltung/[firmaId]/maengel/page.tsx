import { notFound } from "next/navigation";
import { Seitenkopf } from "@/components/verwaltung/Seitenkopf";
import { MANGEL_SPALTEN, MangelEintrag, weitergabeLaden, type Mangel } from "@/components/verwaltung/MangelEintrag";
import { Karte } from "@/components/ui";
import { holeNutzer, istVerwalter } from "@/lib/daten";
import { Gesendet } from "@/components/verwaltung/Gesendet";

export default async function MaengelSeite({ params, searchParams }: PageProps<"/verwaltung/[firmaId]/maengel">) {
  const { firmaId } = await params;
  const { fehler, gesendet } = await searchParams;
  const { supabase, mitgliedschaften } = await holeNutzer();
  const firma = mitgliedschaften.find((m) => m.firma_id === firmaId && istVerwalter(m.rolle));
  if (!firma) notFound();

  const { data } = await supabase.from("maengel").select(MANGEL_SPALTEN).eq("firma_id", firmaId).order("id").limit(200).returns<Mangel[]>();
  const alle = (data ?? []).sort((a, b) => (b.kontrolle?.durchgefuehrt_am ?? "").localeCompare(a.kontrolle?.durchgefuehrt_am ?? ""));
  const offen = alle.filter((m) => m.status === "offen");
  const behoben = alle.filter((m) => m.status === "behoben").slice(0, 20);
  const zurueck = `/verwaltung/${firmaId}/maengel`;
  const weitergabe = await weitergabeLaden(supabase, firmaId, firma.firmen?.name ?? "", [...offen, ...behoben].map((m) => m.id));

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-5 p-4 sm:p-6">
      <Seitenkopf titel="Mängelmeldungen" untertitel={offen.length === 0 ? "Keine offenen Mängel" : `${offen.length} offen`} />
      {typeof gesendet === "string" && <Gesendet art={gesendet} />}
      {typeof fehler === "string" && (
        <p role="alert" className="rounded-xl border-2 border-mangel bg-white p-3 font-semibold text-mangel">
          {fehler}
        </p>
      )}
      <Karte titel="Offen">
        {offen.length > 0 ? (
          <ul className="divide-y divide-gray-200">
            {offen.map((m) => (
              <MangelEintrag key={m.id} m={m} firmaId={firmaId} zurueck={zurueck} weitergabe={weitergabe} />
            ))}
          </ul>
        ) : (
          <p className="text-gray-600">Alles in Ordnung.</p>
        )}
      </Karte>
      {behoben.length > 0 && (
        <Karte titel="Zuletzt erledigt">
          <ul className="divide-y divide-gray-200">
            {behoben.map((m) => (
              <MangelEintrag key={m.id} m={m} firmaId={firmaId} zurueck={zurueck} weitergabe={weitergabe} />
            ))}
          </ul>
        </Karte>
      )}
    </main>
  );
}
