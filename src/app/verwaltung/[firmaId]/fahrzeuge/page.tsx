import { notFound } from "next/navigation";
import { Seitenkopf } from "@/components/verwaltung/Seitenkopf";
import { Feld, Frist, Haken, Karte, Knopf } from "@/components/ui";
import { holeNutzer, istVerwalter, jetzt } from "@/lib/daten";
import { fahrzeugAnlegen } from "../../actions";

type Fahrzeug = {
  id: string;
  kennzeichen: string;
  ist_anhaenger: boolean;
  adr: boolean;
  ladebordwand: boolean;
  ameise: boolean;
  hu_faellig: string | null;
  sp_faellig: string | null;
  tacho_faellig: string | null;
  fahrzeugart: { name: string } | null;
};

export default async function FahrzeugeSeite({ params }: PageProps<"/verwaltung/[firmaId]/fahrzeuge">) {
  const { firmaId } = await params;
  const { supabase, mitgliedschaften } = await holeNutzer();
  const firma = mitgliedschaften.find((m) => m.firma_id === firmaId && istVerwalter(m.rolle));
  if (!firma) notFound();
  const heute = jetzt();

  const { data: fahrzeuge } = await supabase
    .from("fahrzeuge")
    .select("id, kennzeichen, ist_anhaenger, adr, ladebordwand, ameise, hu_faellig, sp_faellig, tacho_faellig, fahrzeugart:fahrzeugarten(name)")
    .eq("firma_id", firmaId)
    .eq("aktiv", true)
    .order("kennzeichen")
    .returns<Fahrzeug[]>();
  const liste = fahrzeuge ?? [];

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-5 p-4 sm:p-6">
      <Seitenkopf titel="Fahrzeuge" untertitel={`${liste.length} Fahrzeuge und Anhänger`} />
      <Karte>
        {liste.length > 0 ? (
          <div className="-mx-5 overflow-x-auto px-5">
            <table className="w-full min-w-[36rem] text-left text-sm">
              <thead className="text-gray-600">
                <tr>
                  <th className="py-2 pr-3 font-semibold">Kennzeichen</th>
                  <th className="py-2 pr-3 font-semibold">Art</th>
                  <th className="py-2 pr-3 font-semibold">HU</th>
                  <th className="py-2 pr-3 font-semibold">SP</th>
                  <th className="py-2 pr-3 font-semibold">Tacho</th>
                </tr>
              </thead>
              <tbody>
                {liste.map((z) => (
                  <tr key={z.id} className="border-t border-gray-200">
                    <td className="py-3 pr-3 font-semibold">{z.kennzeichen}</td>
                    <td className="py-3 pr-3">
                      {z.ist_anhaenger ? "Anhänger" : (z.fahrzeugart?.name ?? "Zugmaschine/LKW")}
                      <span className="block text-xs text-gray-600">
                        {[z.adr && "ADR", z.ladebordwand && "Ladebordwand", z.ameise && "Elektro-Ameise"].filter(Boolean).join(" · ")}
                      </span>
                    </td>
                    <td className="py-3 pr-3">
                      <Frist heute={heute} datum={z.hu_faellig} />
                    </td>
                    <td className="py-3 pr-3">
                      <Frist heute={heute} datum={z.sp_faellig} />
                    </td>
                    <td className="py-3 pr-3">
                      <Frist heute={heute} datum={z.tacho_faellig} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-gray-600">Noch keine Fahrzeuge angelegt.</p>
        )}
      </Karte>
      <Karte titel="Fahrzeug hinzufügen">
        <form action={fahrzeugAnlegen.bind(null, firmaId)} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Feld label="Kennzeichen" name="kennzeichen" placeholder="KN-BC333" autoCapitalize="characters" required />
          <Feld label="HU fällig" name="hu_faellig" type="date" />
          <Feld label="SP fällig" name="sp_faellig" type="date" />
          <Feld label="Tacho-Prüfung fällig" name="tacho_faellig" type="date" />
          <Haken label="Anhänger/Auflieger" name="ist_anhaenger" />
          <Haken label="ADR-Fahrzeug" name="adr" />
          <Haken label="Ladebordwand" name="ladebordwand" />
          <Haken label="Elektro-Ameise an Bord" name="ameise" />
          <div>
            <Knopf>Fahrzeug hinzufügen</Knopf>
          </div>
        </form>
      </Karte>
    </main>
  );
}
