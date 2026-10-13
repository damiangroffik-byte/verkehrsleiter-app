import { notFound } from "next/navigation";
import { Seitenkopf } from "@/components/verwaltung/Seitenkopf";
import { Karte, Knopf } from "@/components/ui";
import { holeNutzer, istVerwalter } from "@/lib/daten";
import { VORWARNUNG_TAGE } from "@/lib/fuehrerschein/regeln";
import { INFO_FELDER, infosBereinigen } from "@/lib/unterweisung/infos";
import { fuehrerscheinEinstellen, infosSpeichern } from "./actions";

const INTERVALLE = [1, 2, 3, 4, 6, 12];
const VORWARNUNGEN = [7, 14, 21, 30, 45, 60];

export default async function EinstellungenSeite({ params, searchParams }: PageProps<"/verwaltung/[firmaId]/einstellungen">) {
  const { firmaId } = await params;
  const { gespeichert, fehler } = await searchParams;
  const { supabase, mitgliedschaften } = await holeNutzer();
  const firma = mitgliedschaften.find((m) => m.firma_id === firmaId && istVerwalter(m.rolle));
  if (!firma) notFound();
  const darfAendern = firma.rolle === "verkehrsleiter";

  const [{ data: einstellung }, { data: infos }] = await Promise.all([
    supabase.from("firma_einstellungen").select("fuehrerschein_intervall_monate, fuehrerschein_vorwarnung_tage").eq("firma_id", firmaId).maybeSingle(),
    supabase.from("firma_infos").select("angaben").eq("firma_id", firmaId).maybeSingle(),
  ]);
  const angaben = infosBereinigen(infos?.angaben ?? {});
  const intervall = einstellung?.fuehrerschein_intervall_monate ?? 6;
  const vorwarnung = einstellung?.fuehrerschein_vorwarnung_tage ?? VORWARNUNG_TAGE;
  // Gespeicherte Werte, die nicht in der Auswahl stehen, trotzdem anzeigen.
  const intervalle = [...new Set([...INTERVALLE, intervall])].sort((a, b) => a - b);
  const vorwarnungen = [...new Set([...VORWARNUNGEN, vorwarnung])].sort((a, b) => a - b);

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-5 p-4 sm:p-6">
      <Seitenkopf titel="Einstellungen" />
      <div className="flex w-full max-w-xl flex-col gap-5">
        {gespeichert && (
          <p role="status" className="rounded-xl border-2 border-ok bg-white p-3 font-semibold text-ok">
            Gespeichert.
          </p>
        )}
        {typeof fehler === "string" && (
          <p role="alert" className="rounded-xl border-2 border-mangel bg-white p-3 font-semibold text-mangel">
            {fehler}
          </p>
        )}

        <Karte titel="Führerschein">
          <form action={fuehrerscheinEinstellen.bind(null, firmaId)} className="flex flex-col gap-4">
            <label className="flex flex-col gap-1 text-sm text-gray-700">
              Wie oft muss der Fahrer seinen Führerschein fotografieren?
              <select
                name="intervall"
                defaultValue={intervall}
                disabled={!darfAendern}
                className="h-12 rounded-xl border border-gray-300 bg-white px-3 text-base text-marke-blau-dunkel"
              >
                {intervalle.map((m) => (
                  <option key={m} value={m}>
                    {m === 1 ? "Jeden Monat" : m === 12 ? "Einmal im Jahr" : `Alle ${m} Monate`}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-sm text-gray-700">
              Wann soll der Fahrer in seiner App daran erinnert werden?
              <select
                name="vorwarnung"
                defaultValue={vorwarnung}
                disabled={!darfAendern}
                className="h-12 rounded-xl border border-gray-300 bg-white px-3 text-base text-marke-blau-dunkel"
              >
                {vorwarnungen.map((t) => (
                  <option key={t} value={t}>
                    {t === 0 ? "Erst am Tag der Prüfung" : `${t} Tage vorher`}
                  </option>
                ))}
              </select>
            </label>
            <p className="text-sm text-gray-600">
              Ab dann sieht der Fahrer auf seiner Startseite „Prüfung fällig am …“ und kann das Foto gleich hochladen. Die gleiche Vorwarnung
              gilt, wenn die Fahrerlaubnis oder Code 95 bald abläuft.
            </p>
            {darfAendern ? <Knopf>Speichern</Knopf> : <p className="text-sm text-gray-600">Ändern kann nur der Verkehrsleiter.</p>}
          </form>
        </Karte>

        <div id="infos" className="scroll-mt-4">
          <Karte titel="Allgemeine Informationen für Fahrer">
            <p className="text-sm text-gray-600">
              Diese Angaben sehen deine Fahrer in der App unter „Unterweisungen“ und bestätigen sie als gelesen. Änderst du etwas, müssen sie neu bestätigen. Leere Felder werden nicht angezeigt.
            </p>
            <form action={infosSpeichern.bind(null, firmaId)} className="flex flex-col gap-5">
              {INFO_FELDER.map((f) => (
                <fieldset key={f.schluessel} className="flex flex-col gap-2">
                  <legend className="mb-1 font-semibold text-marke-blau-dunkel">{f.titel}</legend>
                  {Array.from({ length: f.anzahl }, (_, i) => (
                    <input
                      key={i}
                      name={f.schluessel}
                      defaultValue={angaben[f.schluessel]?.[i] ?? ""}
                      placeholder={i === 0 ? f.beispiel : ""}
                      aria-label={f.anzahl > 1 ? `${f.titel} ${i + 1}` : f.titel}
                      maxLength={200}
                      disabled={!darfAendern}
                      className="h-11 rounded-xl border border-gray-300 bg-white px-3 text-base text-marke-blau-dunkel"
                    />
                  ))}
                </fieldset>
              ))}
              {darfAendern ? <Knopf>Informationen speichern</Knopf> : <p className="text-sm text-gray-600">Ändern kann nur der Verkehrsleiter.</p>}
            </form>
          </Karte>
        </div>
      </div>
    </main>
  );
}
