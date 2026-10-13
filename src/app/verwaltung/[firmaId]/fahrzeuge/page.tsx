import Link from "next/link";
import { notFound } from "next/navigation";
import { Seitenkopf } from "@/components/verwaltung/Seitenkopf";
import { FristZelle } from "@/components/verwaltung/FristZelle";
import { Feld, Haken, Karte, Knopf } from "@/components/ui";
import { holeNutzer, istVerwalter, jetzt } from "@/lib/daten";
import { ART_INFO, ARTEN, datumVon, FAHRZEUG_SPALTEN, standardRegel, stufe, type Art, type FristFahrzeug } from "@/lib/fahrzeugfristen";
import { tag } from "@/lib/fuehrerschein/regeln";
import { fahrzeugAnlegen } from "../../actions";

type Fahrzeug = FristFahrzeug & { adr: boolean; fahrzeugart: { name: string } | null };

export default async function FahrzeugeSeite({ params }: PageProps<"/verwaltung/[firmaId]/fahrzeuge">) {
  const { firmaId } = await params;
  const { supabase, mitgliedschaften } = await holeNutzer();
  const firma = mitgliedschaften.find((m) => m.firma_id === firmaId && istVerwalter(m.rolle));
  if (!firma) notFound();
  const heute = tag(new Date(jetzt()));

  const [{ data: fahrzeuge }, { data: regeln }, { data: belege }] = await Promise.all([
    supabase
      .from("fahrzeuge")
      .select(`${FAHRZEUG_SPALTEN}, adr, fahrzeugart:fahrzeugarten(name)`)
      .eq("firma_id", firmaId)
      .eq("aktiv", true)
      .order("kennzeichen")
      .returns<Fahrzeug[]>(),
    supabase.from("frist_regeln").select("art, vorwarnung_tage").eq("firma_id", firmaId).returns<{ art: Art; vorwarnung_tage: number }[]>(),
    supabase.from("fahrzeug_frist_belege").select("fahrzeug_id, art").eq("firma_id", firmaId).not("foto_pfad", "is", null).returns<{ fahrzeug_id: string; art: Art }[]>(),
  ]);
  const liste = fahrzeuge ?? [];
  const vorwarnung = (a: Art) => regeln?.find((r) => r.art === a)?.vorwarnung_tage ?? standardRegel(a).vorwarnung_tage;
  const mitFoto = new Set((belege ?? []).map((b) => `${b.fahrzeug_id}-${b.art}`));
  const offen = liste.reduce((n, f) => n + ARTEN.filter((a) => ART_INFO[a].gilt(f) && ["fehlt", "rot"].includes(stufe(datumVon(f, a), heute, vorwarnung(a)))).length, 0);

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-5 p-4 sm:p-6">
      <Seitenkopf titel="Fahrzeuge" untertitel={`${liste.length} Fahrzeuge und Anhänger${offen ? ` · ${offen} Prüftermine fehlen oder abgelaufen` : ""}`}>
        <Link href={`/verwaltung/${firmaId}/fahrzeuge/erinnerungen`} className="flex h-12 items-center rounded-xl bg-marke-gelb px-5 font-semibold text-marke-blau">
          Erinnerungen & E-Mails
        </Link>
      </Seitenkopf>
      <Karte>
        {liste.length > 0 ? (
          <div className="-mx-5 overflow-x-auto px-5">
            <table className="w-full min-w-[52rem] text-left text-sm">
              <thead className="text-gray-600">
                <tr>
                  <th className="py-2 pr-3 font-semibold">Kennzeichen</th>
                  {ARTEN.map((a) => (
                    <th key={a} className="py-2 pr-3 font-semibold">
                      {ART_INFO[a].kurz}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {liste.map((z) => (
                  <tr key={z.id} className="border-t border-gray-200">
                    <td className="py-2 pr-3">
                      <Link href={`/verwaltung/${firmaId}/fahrzeuge/${z.id}`} className="flex min-h-11 flex-col justify-center">
                        <span className="font-semibold text-marke-blau underline">{z.kennzeichen}</span>
                        <span className="text-xs text-gray-600">
                          {[z.ist_anhaenger ? "Anhänger" : (z.fahrzeugart?.name ?? "LKW"), z.adr && "ADR", z.ladebordwand && "Ladebordwand", z.ameise && "Ameise"]
                            .filter(Boolean)
                            .join(" · ")}
                        </span>
                      </Link>
                    </td>
                    {ARTEN.map((a) => (
                      <td key={a} className="py-2 pr-3">
                        {ART_INFO[a].gilt(z) ? (
                          <FristZelle datum={datumVon(z, a)} stufe={stufe(datumVon(z, a), heute, vorwarnung(a))} foto={mitFoto.has(`${z.id}-${a}`)} />
                        ) : (
                          <span className="text-gray-400">–</span>
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-gray-600">Noch keine Fahrzeuge angelegt.</p>
        )}
        <p className="text-sm text-gray-600">
          Rot = abgelaufen oder fehlt, gelb = bald fällig, 📷 = vom Fahrer fotografiert. Tippe auf ein Kennzeichen, um Termine zu ändern. Fahrer erfassen
          fehlende Termine in ihrer App unter „Prüftermine“.
        </p>
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
