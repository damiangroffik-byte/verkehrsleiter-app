import { Kopfleiste } from "@/components/Kopfleiste";
import { FristErfassen } from "@/components/FristErfassen";
import { Karte } from "@/components/ui";
import { holeNutzer, jetzt } from "@/lib/daten";
import { datumVon, geltendeArten, stufe } from "@/lib/fahrzeugfristen";
import { tag } from "@/lib/fuehrerschein/regeln";
import { pruefungenLaden } from "./daten";

export default async function PruefungenSeite() {
  const { supabase, user } = await holeNutzer();
  const daten = await pruefungenLaden(supabase, user.id);
  const heute = tag(new Date(jetzt()));

  return (
    <main className="flex flex-1 flex-col">
      <Kopfleiste titel="Prüftermine" untertitel={daten?.fahrer.firmen?.name} zurueck="/fahrer" />
      <div className="mx-auto flex w-full max-w-md flex-col gap-4 p-5">
        {!daten ? (
          <Karte>
            <p className="text-gray-600">Du bist noch bei keiner Firma als Fahrer eingetragen.</p>
          </Karte>
        ) : (
          <>
            <p className="text-gray-700">
              Mach einmal ein Foto von jeder Plakette. Die App liest das Datum und merkt es sich, du musst es bei der Abfahrtskontrolle nicht mehr eintippen.
            </p>
            {daten.fahrzeuge.length === 0 && (
              <Karte>
                <p className="text-gray-600">Noch keine Fahrzeuge angelegt.</p>
              </Karte>
            )}
            {daten.fahrzeuge.map((f) => (
              <Karte key={f.id} titel={`${f.kennzeichen}${f.ist_anhaenger ? " (Anhänger)" : ""}`}>
                <ul className="flex flex-col gap-2">
                  {geltendeArten(f).map((a) => {
                    const d = datumVon(f, a);
                    return <FristErfassen key={a} firmaId={daten.fahrer.firma_id} fahrzeugId={f.id} art={a} datum={d} stufe={stufe(d, heute, daten.vorwarnung(a))} />;
                  })}
                </ul>
              </Karte>
            ))}
          </>
        )}
      </div>
    </main>
  );
}
