import Link from "next/link";
import { Kopfleiste } from "@/components/Kopfleiste";
import { PdfKnopf } from "@/components/PdfKnopf";
import { StatusZeile } from "@/components/StatusZeile";
import { Karte } from "@/components/ui";
import { holeNutzer, jetzt } from "@/lib/daten";
import { BESTEHEN_PROZENT, blockStatus } from "@/lib/unterweisung/regeln";
import { unterweisungenLaden } from "./daten";

export default async function UnterweisungenSeite() {
  const { supabase, user } = await holeNutzer();
  const daten = await unterweisungenLaden(supabase, user.id);

  if (!daten) {
    return (
      <main className="flex flex-1 flex-col">
        <Kopfleiste titel="Unterweisungen" zurueck="/fahrer" />
        <div className="mx-auto w-full max-w-md p-5">
          <Karte titel="Keine Firma">
            <p className="text-gray-600">Du bist noch bei keiner Firma als Fahrer eingetragen. Bitte wende dich an deinen Verkehrsleiter.</p>
          </Karte>
        </div>
      </main>
    );
  }

  const heute = new Date(jetzt());
  const liste = daten.bloecke.map((b) => ({ b, s: blockStatus(daten.teilnahmen.filter((t) => t.unterweisung === b.schluessel), heute) }));
  const offen = liste.filter((x) => x.s.faellig).length;

  return (
    <main className="flex flex-1 flex-col">
      <Kopfleiste titel="Unterweisungen" untertitel={daten.fahrer.firmen?.name} zurueck="/fahrer" />
      <div className="mx-auto flex w-full max-w-md flex-col gap-4 p-5">
        <p className="text-gray-700">
          Einmal im Jahr machst du jeden Block: lesen, Test mit {BESTEHEN_PROZENT} % richtigen Antworten bestehen und unterschreiben.
        </p>
        <p className={`rounded-xl p-3 font-semibold ${offen > 0 ? "bg-marke-gelb/40 text-marke-blau" : "bg-ok/10 text-ok"}`}>
          {offen === 0 ? "Alles erledigt. Danke!" : offen === 1 ? "1 Unterweisung ist fällig." : `${offen} Unterweisungen sind fällig.`}
        </p>
        <ul className="flex flex-col gap-3">
          {liste.map(({ b, s }) => (
            <li key={b.schluessel} className="flex flex-col gap-3 rounded-2xl bg-white p-4 shadow-sm">
              <div className="flex items-start gap-3">
                <span aria-hidden className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-marke-blau text-xl text-white">
                  {b.symbol}
                </span>
                <span className="flex flex-col">
                  <span className="font-semibold">{b.titel}</span>
                  <span className="text-sm text-gray-600">
                    {b.kurz} · ca. {b.dauer_min} Min.
                  </span>
                </span>
              </div>
              <StatusZeile stufe={s.stufe} text={s.text} />
              <div className="flex flex-wrap items-center gap-3">
                <Link
                  href={`/fahrer/unterweisungen/${b.schluessel}`}
                  className={`flex h-12 flex-1 items-center justify-center rounded-xl font-semibold ${s.faellig ? "bg-marke-gelb text-marke-blau" : "border-2 border-marke-blau text-marke-blau"}`}
                >
                  {s.nachweis ? (s.faellig ? "Jetzt wiederholen" : "Ansehen oder wiederholen") : "Jetzt starten"}
                </Link>
                {s.nachweis && (
                  <PdfKnopf href={`/unterweisung/${s.nachweis.id}/pdf`} className="flex min-h-11 items-center px-2 text-sm font-semibold text-marke-blau underline">
                    Nachweis
                  </PdfKnopf>
                )}
              </div>
            </li>
          ))}
        </ul>
      </div>
    </main>
  );
}
