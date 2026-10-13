import Link from "next/link";
import { notFound } from "next/navigation";
import { Seitenkopf } from "@/components/verwaltung/Seitenkopf";
import { PdfKnopf } from "@/components/PdfKnopf";
import { StatusZeile } from "@/components/StatusZeile";
import { Karte } from "@/components/ui";
import { holeNutzer, istVerwalter, jetzt } from "@/lib/daten";
import { BESTEHEN_PROZENT, blockStatus, type Teilnahme, type Unterweisung } from "@/lib/unterweisung/regeln";
import { unterweisungSchalten } from "./actions";

type Fahrer = { id: string; vorname: string; nachname: string; user_id: string | null };
type FirmaTeilnahme = Teilnahme & { fahrer_id: string };

export default async function UnterweisungenVerwaltung({ params, searchParams }: PageProps<"/verwaltung/[firmaId]/unterweisungen">) {
  const { firmaId } = await params;
  const { fehler } = await searchParams;
  const { supabase, mitgliedschaften } = await holeNutzer();
  const firma = mitgliedschaften.find((m) => m.firma_id === firmaId && istVerwalter(m.rolle));
  if (!firma) notFound();
  const darfAendern = firma.rolle === "verkehrsleiter";
  const heute = new Date(jetzt());

  const [{ data: fahrer }, { data: bloecke }, { data: auswahl }, { data: teilnahmen }] = await Promise.all([
    supabase.from("fahrer").select("id, vorname, nachname, user_id").eq("firma_id", firmaId).eq("aktiv", true).order("nachname").returns<Fahrer[]>(),
    supabase.from("unterweisungen").select("schluessel, titel, kurz, symbol, dauer_min").order("reihenfolge").returns<Unterweisung[]>(),
    supabase.from("firma_unterweisungen").select("unterweisung, aktiv").eq("firma_id", firmaId).returns<{ unterweisung: string; aktiv: boolean }[]>(),
    supabase
      .from("unterweisung_teilnahmen")
      .select("id, fahrer_id, unterweisung, durchgefuehrt_am, prozent, bestanden, unterschrieben_am, gueltig_bis")
      .eq("firma_id", firmaId)
      .order("durchgefuehrt_am", { ascending: false })
      .returns<FirmaTeilnahme[]>(),
  ]);
  const aus = new Set((auswahl ?? []).filter((a) => !a.aktiv).map((a) => a.unterweisung));
  const aktive = (bloecke ?? []).filter((b) => !aus.has(b.schluessel));

  const liste = (fahrer ?? []).map((f) => {
    const eigene = (teilnahmen ?? []).filter((t) => t.fahrer_id === f.id);
    const status = aktive.map((b) => {
      const versuche = eigene.filter((t) => t.unterweisung === b.schluessel);
      return { b, s: blockStatus(versuche, heute), versuche: versuche.length };
    });
    return { f, status, offen: status.filter((x) => x.s.faellig).length };
  });
  liste.sort((a, b) => b.offen - a.offen);
  const gesamt = liste.length * aktive.length;
  const erledigt = gesamt - liste.reduce((n, x) => n + x.offen, 0);

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-5 p-4 sm:p-6">
      <Seitenkopf titel="Unterweisungen" untertitel="Jährlich mit Test und Unterschrift" />
      <div className="grid w-full gap-5 lg:grid-cols-[1fr_20rem]">
        <div className="flex flex-col gap-4">
          {fehler && (
            <p role="alert" className="rounded-xl border-2 border-mangel bg-white p-3 font-semibold text-mangel">
              {fehler}
            </p>
          )}
          <section className="flex flex-col gap-1 rounded-2xl bg-marke-blau p-5 text-white">
            <p className="font-titel text-3xl font-extrabold">
              {erledigt} von {gesamt}
            </p>
            <p>gültige Unterweisungen ({liste.length} Fahrer × {aktive.length} Blöcke)</p>
          </section>
          {liste.length === 0 && (
            <Karte>
              <p className="text-gray-600">Noch keine aktiven Fahrer.</p>
            </Karte>
          )}
          {liste.map(({ f, status, offen }) => (
            <section key={f.id} className="flex flex-col gap-3 rounded-2xl bg-white p-5 shadow-sm">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="font-titel text-lg font-semibold">
                  {f.vorname} {f.nachname}
                </h2>
                <span className={`text-sm font-semibold ${offen > 0 ? "text-mangel" : "text-ok"}`}>
                  {offen === 0 ? "alles erledigt" : `${offen} offen`}
                  {!f.user_id && <span className="font-normal text-gray-600"> · noch nicht angemeldet</span>}
                </span>
              </div>
              <ul className="divide-y divide-gray-200">
                {status.map(({ b, s, versuche }) => (
                  <li key={b.schluessel} className="flex flex-wrap items-center justify-between gap-2 py-2">
                    <span className="flex min-w-0 flex-col">
                      <span className="font-semibold">{b.titel}</span>
                      <StatusZeile stufe={s.stufe} text={s.text} />
                      {s.nachweis && (
                        <span className="text-sm text-gray-600">
                          Test {s.nachweis.prozent} % · {versuche} {versuche === 1 ? "Versuch" : "Versuche"}
                        </span>
                      )}
                      {!s.nachweis && versuche > 0 && (
                        <span className="text-sm text-gray-600">
                          {versuche} {versuche === 1 ? "Versuch" : "Versuche"}, noch nicht bestanden oder unterschrieben
                        </span>
                      )}
                    </span>
                    {s.nachweis && (
                      <PdfKnopf href={`/unterweisung/${s.nachweis.id}/pdf`} className="flex min-h-11 items-center text-sm font-semibold text-marke-blau underline">
                        Nachweis-PDF
                      </PdfKnopf>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>

        <aside className="flex flex-col gap-4">
          <Karte titel="So funktioniert es">
            <ul className="flex list-disc flex-col gap-1 pl-5 text-gray-700">
              <li>Der Fahrer liest jeden Block in der App.</li>
              <li>Danach Test mit 10 Fragen, mindestens {BESTEHEN_PROZENT} % richtig. Wiederholen ist jederzeit möglich.</li>
              <li>Nach bestandenem Test unterschreibt er in der App.</li>
              <li>Gültig für ein Jahr. 30 Tage vorher wird er als „bald fällig“ angezeigt.</li>
              <li>Zu jeder Unterweisung gibt es einen Nachweis als PDF.</li>
            </ul>
          </Karte>
          <Karte titel="Allgemeine Informationen">
            <p className="text-sm text-gray-600">Ersthelfer, Verbandkästen, Feuerlöscher, Sammelpunkt und Ansprechpartner. Die Fahrer lesen sie ohne Test.</p>
            <Link href={`/verwaltung/${firmaId}/einstellungen#infos`} className="flex h-12 items-center justify-center rounded-xl bg-marke-gelb font-semibold text-marke-blau">
              {darfAendern ? "Informationen eintragen" : "Informationen ansehen"}
            </Link>
          </Karte>
          <Karte titel="Blöcke für diese Firma">
            <p className="text-sm text-gray-600">
              {darfAendern ? "Ausgeschaltete Blöcke sehen die Fahrer nicht." : "Nur der Verkehrsleiter kann Blöcke ein- oder ausschalten."}
            </p>
            <ul className="flex flex-col">
              {(bloecke ?? []).map((b) => {
                const an = !aus.has(b.schluessel);
                return (
                  <li key={b.schluessel} className="flex items-center justify-between gap-3 py-1">
                    <span className="flex flex-col">
                      <span className="font-semibold">{b.titel}</span>
                      <span className="text-sm text-gray-600">{b.kurz}</span>
                    </span>
                    <form action={unterweisungSchalten.bind(null, firmaId, b.schluessel, !an)}>
                      <button
                        type="submit"
                        role="switch"
                        aria-checked={an}
                        aria-label={`${b.titel} ${an ? "ausschalten" : "einschalten"}`}
                        disabled={!darfAendern}
                        className="flex h-11 items-center disabled:opacity-60"
                      >
                        <span className={`flex h-7 w-12 items-center rounded-full p-1 ${an ? "justify-end bg-ok" : "justify-start bg-gray-300"}`}>
                          <span className="h-5 w-5 rounded-full bg-white shadow" />
                        </span>
                      </button>
                    </form>
                  </li>
                );
              })}
            </ul>
          </Karte>
        </aside>
      </div>
    </main>
  );
}
