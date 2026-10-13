import Link from "next/link";
import { notFound } from "next/navigation";
import { StatusZeile } from "@/components/StatusZeile";
import { Seitenkopf } from "@/components/verwaltung/Seitenkopf";
import { Karte } from "@/components/ui";
import { holeNutzer, istVerwalter, jetzt } from "@/lib/daten";
import { datumDe, tag } from "@/lib/fuehrerschein/regeln";
import { fristenListe, type Frist, type FristFahrer, type FristFahrzeug } from "@/lib/fristen";

function FristZeile({ f, firmaId }: { f: Frist; firmaId: string }) {
  const stufe = f.tage < 0 ? "rot" : f.tage <= 60 ? "orange" : "ok";
  const text = f.tage < 0 ? `Abgelaufen seit ${datumDe(f.datum)}` : f.tage === 0 ? "Heute fällig" : `${datumDe(f.datum)} · in ${f.tage} Tagen`;
  const inhalt = (
    <>
      <span className="flex min-w-0 flex-col">
        <span className="font-semibold">{f.wer}</span>
        <span className="text-sm text-gray-600">{f.was}</span>
      </span>
      <span className="text-sm">
        <StatusZeile stufe={stufe} text={text} />
      </span>
    </>
  );
  return (
    <li>
      {f.art === "fahrer" ? (
        <Link href={`/verwaltung/${firmaId}/fahrer/${f.id}`} className="flex min-h-12 flex-wrap items-center justify-between gap-2 py-2">
          {inhalt}
        </Link>
      ) : (
        <div className="flex min-h-12 flex-wrap items-center justify-between gap-2 py-2">{inhalt}</div>
      )}
    </li>
  );
}

export default async function FristenSeite({ params }: PageProps<"/verwaltung/[firmaId]/fristen">) {
  const { firmaId } = await params;
  const { supabase, mitgliedschaften } = await holeNutzer();
  const firma = mitgliedschaften.find((m) => m.firma_id === firmaId && istVerwalter(m.rolle));
  if (!firma) notFound();

  const [{ data: fahrzeuge }, { data: fahrer }] = await Promise.all([
    supabase
      .from("fahrzeuge")
      .select("id, kennzeichen, hu_faellig, sp_faellig, tacho_faellig, feuerloescher_bis, ladebordwand_uvv_bis, ameise_uvv_bis")
      .eq("firma_id", firmaId)
      .eq("aktiv", true)
      .returns<FristFahrzeug[]>(),
    supabase
      .from("fahrer")
      .select("id, vorname, nachname, fqn_gueltig_bis, adr_gueltig_bis, fahrerkarte_gueltig_bis")
      .eq("firma_id", firmaId)
      .eq("aktiv", true)
      .returns<FristFahrer[]>(),
  ]);
  const liste = fristenListe(fahrzeuge ?? [], fahrer ?? [], tag(new Date(jetzt())));
  const dringend = liste.filter((f) => f.tage <= 60);
  const spaeter = liste.filter((f) => f.tage > 60);

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-5 p-4 sm:p-6">
      <Seitenkopf titel="Fristen" untertitel="HU, SP, Tacho, Feuerlöscher, UVV sowie Code 95, ADR-Schein und Fahrerkarte" />
      <Karte titel={`Abgelaufen oder in den nächsten 60 Tagen (${dringend.length})`}>
        {dringend.length > 0 ? (
          <ul className="divide-y divide-gray-200">
            {dringend.map((f) => (
              <FristZeile key={f.schluessel} f={f} firmaId={firmaId} />
            ))}
          </ul>
        ) : (
          <p className="text-gray-600">Nichts dringend.</p>
        )}
      </Karte>
      {spaeter.length > 0 && (
        <Karte titel="Später">
          <ul className="divide-y divide-gray-200">
            {spaeter.map((f) => (
              <FristZeile key={f.schluessel} f={f} firmaId={firmaId} />
            ))}
          </ul>
        </Karte>
      )}
      <p className="text-sm text-gray-600">
        Fristen ohne eingetragenes Datum erscheinen hier nicht. Fahrerfristen trägst du beim Fahrer ein.
      </p>
    </main>
  );
}
