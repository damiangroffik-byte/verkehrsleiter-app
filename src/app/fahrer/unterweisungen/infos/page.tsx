import { Kopfleiste } from "@/components/Kopfleiste";
import { Karte } from "@/components/ui";
import { holeNutzer } from "@/lib/daten";
import { INFO_FELDER, telefonTeile } from "@/lib/unterweisung/infos";
import { infosBestaetigen } from "../actions";
import { unterweisungenLaden } from "../daten";

export default async function InfosSeite({ searchParams }: PageProps<"/fahrer/unterweisungen/infos">) {
  const { fehler } = await searchParams;
  const { supabase, user } = await holeNutzer();
  const daten = await unterweisungenLaden(supabase, user.id);
  const felder = INFO_FELDER.filter((f) => daten?.infos[f.schluessel]);

  return (
    <main className="flex flex-1 flex-col">
      <Kopfleiste titel="Allgemeine Informationen" untertitel={daten?.fahrer.firmen?.name} zurueck="/fahrer/unterweisungen" />
      <div className="mx-auto flex w-full max-w-md flex-col gap-4 p-5">
        {felder.length === 0 ? (
          <Karte>
            <p className="text-gray-600">Dein Verkehrsleiter hat noch keine Informationen eingetragen.</p>
          </Karte>
        ) : (
          <p className="text-gray-700">Das solltest du in deiner Firma wissen. Im Notfall: 112.</p>
        )}
        {felder.map((f) => (
          <Karte key={f.schluessel} titel={f.titel}>
            <ul className="flex flex-col divide-y divide-gray-200">
              {daten!.infos[f.schluessel].map((eintrag, i) => (
                <li key={i} className="py-2 text-base">
                  {telefonTeile(eintrag).map((t, j) =>
                    t.tel ? (
                      <a key={j} href={`tel:${t.tel}`} className="inline-flex min-h-11 items-center font-semibold text-marke-blau underline">
                        {t.text}
                      </a>
                    ) : (
                      <span key={j}>{t.text}</span>
                    ),
                  )}
                </li>
              ))}
            </ul>
          </Karte>
        ))}
        {typeof fehler === "string" && (
          <p role="alert" className="rounded-xl border-2 border-mangel bg-white p-3 font-semibold text-mangel">
            {fehler}
          </p>
        )}
        {daten && felder.length > 0 &&
          (daten.infosBestaetigt ? (
            <p role="status" className="rounded-xl border-2 border-ok bg-white p-4 font-semibold text-ok">
              ✓ Gelesen und bestätigt am{" "}
              {new Date(daten.infosBestaetigt).toLocaleString("de-DE", { timeZone: "Europe/Berlin", dateStyle: "short", timeStyle: "short" })} Uhr
            </p>
          ) : (
            <form action={infosBestaetigen.bind(null, daten.fahrer.firma_id)} className="flex flex-col gap-3 rounded-2xl bg-white p-5 shadow-sm">
              <label className="flex min-h-11 items-start gap-3 text-base">
                <input type="checkbox" name="gelesen" required className="mt-0.5 h-6 w-6 shrink-0" />
                Ich habe die Informationen gelesen und weiß, wen ich im Notfall anspreche und wo Verbandkasten, Feuerlöscher und Sammelpunkt
                sind.
              </label>
              <button type="submit" className="h-12 rounded-xl bg-marke-gelb font-semibold text-marke-blau">
                Gelesen – bestätigen
              </button>
            </form>
          ))}
      </div>
    </main>
  );
}
