import { Kopfleiste } from "@/components/Kopfleiste";
import { Karte } from "@/components/ui";
import { holeNutzer } from "@/lib/daten";
import { INFO_FELDER, telefonTeile } from "@/lib/unterweisung/infos";
import { unterweisungenLaden } from "../daten";

export default async function InfosSeite() {
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
      </div>
    </main>
  );
}
