import { notFound } from "next/navigation";
import { Seitenkopf } from "@/components/verwaltung/Seitenkopf";
import { Karte } from "@/components/ui";
import { holeNutzer, istVerwalter } from "@/lib/daten";
import { ART_INFO, ARTEN, PLATZHALTER, standardRegel, STANDARD_BETREFF, STANDARD_TEXT, type Art, type Regel } from "@/lib/fahrzeugfristen";
import { automatikBereit } from "@/lib/fristMail";
import { regelSpeichern } from "../actions";

const VORWARNUNG = [7, 14, 21, 30, 42, 60, 90];
const MAILVORLAUF = [14, 21, 28, 42, 56, 60, 90];

function tageText(t: number) {
  return t % 7 === 0 && t <= 56 ? `${t / 7} Wochen vorher (${t} Tage)` : t % 30 === 0 ? `${t / 30} ${t === 30 ? "Monat" : "Monate"} vorher (${t} Tage)` : `${t} Tage vorher`;
}

const eingabe = "h-11 rounded-xl border border-gray-300 bg-white px-3 text-base text-marke-blau-dunkel";

export default async function ErinnerungenSeite({ params, searchParams }: PageProps<"/verwaltung/[firmaId]/fahrzeuge/erinnerungen">) {
  const { firmaId } = await params;
  const { gespeichert, fehler } = await searchParams;
  const { supabase, mitgliedschaften } = await holeNutzer();
  const firma = mitgliedschaften.find((m) => m.firma_id === firmaId && istVerwalter(m.rolle));
  if (!firma) notFound();
  const darfAendern = firma.rolle === "verkehrsleiter";

  const { data } = await supabase.from("frist_regeln").select("art, vorwarnung_tage, mail_aktiv, mail_an, mail_betreff, mail_text, mail_tage").eq("firma_id", firmaId).returns<Regel[]>();
  const regel = (a: Art) => data?.find((r) => r.art === a) ?? standardRegel(a);
  const automatik = automatikBereit();

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-5 p-4 sm:p-6">
      <Seitenkopf pfad={[{ titel: "Fahrzeuge", href: `/verwaltung/${firmaId}/fahrzeuge` }, { titel: "Erinnerungen & E-Mails" }]} titel="Erinnerungen & E-Mails" />
      {gespeichert && (
        <p role="status" className="rounded-xl border-2 border-ok bg-white p-3 font-semibold text-ok">
          Gespeichert{typeof gespeichert === "string" && gespeichert in ART_INFO ? `: ${ART_INFO[gespeichert as Art].titel}` : ""}.
        </p>
      )}
      {typeof fehler === "string" && (
        <p role="alert" className="rounded-xl border-2 border-mangel bg-white p-3 font-semibold text-mangel">
          {fehler}
        </p>
      )}
      <p className="text-gray-700">
        Je Prüfung stellst du ein, ab wann sie in der Übersicht gelb als „bald fällig“ erscheint, und ob automatisch eine Mail an deine Werkstatt oder
        Prüfstelle geht. Platzhalter im Text: {PLATZHALTER.join(", ")}.
      </p>
      {!automatik && (
        <p className="rounded-xl border-2 border-marke-gelb bg-white p-3 text-sm">
          Der automatische Versand ist noch nicht eingeschaltet (es fehlen Einstellungen beim Hosting). Deine Einstellungen werden trotzdem gespeichert, und
          beim Fahrzeug kannst du jede Mail schon von Hand senden.
        </p>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        {ARTEN.map((a) => {
          const r = regel(a);
          return (
            <Karte key={a} titel={ART_INFO[a].titel}>
              <form action={regelSpeichern.bind(null, firmaId, a)} className="flex flex-col gap-3">
                <fieldset disabled={!darfAendern} className="flex flex-col gap-3">
                  <label className="flex flex-col gap-1 text-sm text-gray-700">
                    Erinnern (gelb anzeigen)
                    <select name="vorwarnung_tage" defaultValue={r.vorwarnung_tage} className={eingabe}>
                      {[...new Set([...VORWARNUNG, r.vorwarnung_tage])].sort((x, y) => x - y).map((t) => (
                        <option key={t} value={t}>
                          {tageText(t)}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="flex min-h-11 items-center gap-2 font-semibold">
                    <input type="checkbox" name="mail_aktiv" defaultChecked={r.mail_aktiv} className="h-5 w-5" />
                    Automatisch Mail senden
                  </label>
                  <label className="flex flex-col gap-1 text-sm text-gray-700">
                    E-Mail der Werkstatt / Prüfstelle (mehrere mit Komma)
                    <input type="text" inputMode="email" name="mail_an" defaultValue={r.mail_an ?? ""} placeholder="werkstatt@beispiel.de" className={eingabe} />
                  </label>
                  <label className="flex flex-col gap-1 text-sm text-gray-700">
                    Wann senden
                    <select name="mail_tage" defaultValue={r.mail_tage} className={eingabe}>
                      {[...new Set([...MAILVORLAUF, r.mail_tage])].sort((x, y) => x - y).map((t) => (
                        <option key={t} value={t}>
                          {tageText(t)}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="flex flex-col gap-1 text-sm text-gray-700">
                    Betreff
                    <input type="text" name="mail_betreff" defaultValue={r.mail_betreff ?? STANDARD_BETREFF} className={eingabe} />
                  </label>
                  <label className="flex flex-col gap-1 text-sm text-gray-700">
                    Text
                    <textarea
                      name="mail_text"
                      rows={8}
                      defaultValue={r.mail_text ?? STANDARD_TEXT}
                      className="rounded-xl border border-gray-300 bg-white p-3 text-base text-marke-blau-dunkel"
                    />
                  </label>
                </fieldset>
                {darfAendern ? (
                  <button type="submit" className="h-12 rounded-xl bg-marke-gelb font-semibold text-marke-blau">
                    Speichern
                  </button>
                ) : (
                  <p className="text-sm text-gray-600">Ändern kann nur der Verkehrsleiter.</p>
                )}
              </form>
            </Karte>
          );
        })}
      </div>
    </main>
  );
}
