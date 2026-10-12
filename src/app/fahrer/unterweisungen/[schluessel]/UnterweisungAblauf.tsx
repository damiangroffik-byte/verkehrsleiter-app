"use client";

import Link from "next/link";
import { useState } from "react";
import { Unterschrift, alsPng } from "@/components/Unterschrift";
import { createClient } from "@/lib/supabase/browser";
import { BESTEHEN_PROZENT, mischen, noetig, type Abschnitt, type Frage } from "@/lib/unterweisung/regeln";
import { testAuswerten, unterweisungUnterschreiben } from "../actions";

type Props = { firmaId: string; schluessel: string; titel: string; abschnitte: Abschnitt[]; fragen: Frage[] };
type Schritt = "lesen" | "test" | "ergebnis" | "fertig";
// Ein Testversuch: eigene ID und gemischte Antwortreihenfolge je Frage.
type Versuch = { id: string; reihenfolge: Record<string, number[]> };
type Ergebnis = { richtig: number; gesamt: number; prozent: number; bestanden: boolean; falsch: string[] };

const gelb = "flex h-14 w-full items-center justify-center rounded-xl bg-marke-gelb text-lg font-semibold text-marke-blau disabled:opacity-50";
const rahmen = "flex h-12 w-full items-center justify-center rounded-xl border-2 border-marke-blau font-semibold text-marke-blau";

export function UnterweisungAblauf({ firmaId, schluessel, titel, abschnitte, fragen }: Props) {
  const [schritt, setSchritt] = useState<Schritt>("lesen");
  const [versuch, setVersuch] = useState<Versuch | null>(null);
  const [antworten, setAntworten] = useState<Record<string, number>>({});
  const [ergebnis, setErgebnis] = useState<Ergebnis | null>(null);
  const [unterschrift, setUnterschrift] = useState<HTMLCanvasElement | null>(null);
  const [gueltigBis, setGueltigBis] = useState("");
  const [sendet, setSendet] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);

  function gehe(s: Schritt) {
    setSchritt(s);
    setFehler(null);
    window.scrollTo({ top: 0 });
  }

  // Jeder Versuch bekommt eine neue ID und neu gemischte Antworten.
  function testStarten() {
    setVersuch({
      id: crypto.randomUUID(),
      reihenfolge: Object.fromEntries(fragen.map((f) => [f.id, mischen(f.antworten.length)])),
    });
    setAntworten({});
    setErgebnis(null);
    gehe("test");
  }

  const beantwortet = fragen.filter((f) => antworten[f.id] !== undefined).length;

  async function auswerten() {
    if (!versuch || beantwortet < fragen.length) return;
    setSendet(true);
    setFehler(null);
    try {
      const a = await testAuswerten({
        teilnahmeId: versuch.id,
        firmaId,
        unterweisung: schluessel,
        antworten: Object.fromEntries(Object.entries(antworten).map(([id, i]) => [id, i + 1])),
      });
      if (!a.ok) return setFehler(a.fehler);
      setErgebnis(a);
      gehe("ergebnis");
    } catch {
      setFehler("Der Test konnte nicht gesendet werden. Bitte prüfe die Verbindung und tippe noch einmal.");
    } finally {
      setSendet(false);
    }
  }

  async function unterschreiben() {
    if (!versuch || !unterschrift) return;
    setSendet(true);
    setFehler(null);
    try {
      const pfad = `${firmaId}/${versuch.id}/unterschrift.png`;
      const { error } = await createClient()
        .storage.from("unterweisungen")
        .upload(pfad, await alsPng(unterschrift), { contentType: "image/png", upsert: false });
      // Beim erneuten Senden liegt die Unterschrift schon in Storage.
      if (error && !/exists|duplicate/i.test(error.message)) throw error;
      const a = await unterweisungUnterschreiben(versuch.id, pfad);
      if (!a.ok) return setFehler(a.fehler);
      setGueltigBis(a.gueltigBis);
      gehe("fertig");
    } catch {
      setFehler("Die Unterschrift konnte nicht gesendet werden. Bitte prüfe die Verbindung und tippe noch einmal.");
    } finally {
      setSendet(false);
    }
  }

  const fehlerZeile = fehler && (
    <p role="alert" className="rounded-xl border-2 border-mangel bg-white p-3 font-semibold text-mangel">
      {fehler}
    </p>
  );

  if (schritt === "lesen") {
    return (
      <div className="mx-auto flex w-full max-w-md flex-col gap-4 p-5">
        <p className="text-gray-700">Lies alles in Ruhe durch. Danach kommt ein kurzer Test mit {fragen.length} Fragen.</p>
        {abschnitte.map((a) => (
          <section key={a.titel} className="flex flex-col gap-3 rounded-2xl bg-white p-5 shadow-sm">
            <h2 className="font-titel text-lg font-semibold text-marke-blau">{a.titel}</h2>
            <ul className="flex flex-col gap-2">
              {a.punkte.map((p) => (
                <li key={p} className="flex gap-2">
                  <span aria-hidden className="mt-2 h-2 w-2 shrink-0 rounded-full bg-marke-gelb" />
                  <span>{p}</span>
                </li>
              ))}
            </ul>
          </section>
        ))}
        <button type="button" onClick={testStarten} className={gelb} disabled={fragen.length === 0}>
          Gelesen – weiter zum Test
        </button>
      </div>
    );
  }

  if (schritt === "test" && versuch) {
    return (
      <div className="mx-auto flex w-full max-w-md flex-col gap-4 p-5">
        <div className="flex flex-col gap-2">
          <p className="text-gray-700">
            Mindestens {noetig(fragen.length)} von {fragen.length} Antworten müssen richtig sein ({BESTEHEN_PROZENT} %).
          </p>
          <div className="h-2 overflow-hidden rounded-full bg-gray-200" aria-hidden>
            <div className="h-full bg-marke-blau transition-all" style={{ width: `${(beantwortet / Math.max(1, fragen.length)) * 100}%` }} />
          </div>
          <p className="text-sm text-gray-600">
            {beantwortet} von {fragen.length} beantwortet
          </p>
        </div>
        <ol className="flex flex-col gap-3">
          {fragen.map((f, n) => (
            <li key={f.id} className="flex flex-col gap-3 rounded-2xl bg-white p-4 shadow-sm">
              <p className="font-semibold">
                <span className="text-marke-blau">{n + 1}.</span> {f.frage}
              </p>
              <div role="radiogroup" aria-label={f.frage} className="flex flex-col gap-2">
                {versuch.reihenfolge[f.id].map((i) => {
                  const gewaehlt = antworten[f.id] === i;
                  return (
                    <button
                      key={i}
                      type="button"
                      role="radio"
                      aria-checked={gewaehlt}
                      onClick={() => setAntworten((a) => ({ ...a, [f.id]: i }))}
                      className={`flex min-h-12 items-center gap-3 rounded-xl border-2 px-3 py-2 text-left ${gewaehlt ? "border-marke-blau bg-marke-blau/10 font-semibold" : "border-gray-300 bg-white"}`}
                    >
                      <span
                        aria-hidden
                        className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 ${gewaehlt ? "border-marke-blau" : "border-gray-400"}`}
                      >
                        {gewaehlt && <span className="h-2.5 w-2.5 rounded-full bg-marke-blau" />}
                      </span>
                      {f.antworten[i]}
                    </button>
                  );
                })}
              </div>
            </li>
          ))}
        </ol>
        {fehlerZeile}
        <button type="button" onClick={auswerten} className={gelb} disabled={sendet || beantwortet < fragen.length}>
          {sendet ? "Wird ausgewertet …" : beantwortet < fragen.length ? `Noch ${fragen.length - beantwortet} offen` : "Test auswerten"}
        </button>
      </div>
    );
  }

  if (schritt === "ergebnis" && ergebnis) {
    const falsch = fragen.filter((f) => ergebnis.falsch.includes(f.id));
    return (
      <div className="mx-auto flex w-full max-w-md flex-col gap-4 p-5">
        <section className={`flex flex-col items-center gap-1 rounded-2xl p-5 text-center text-white ${ergebnis.bestanden ? "bg-ok" : "bg-mangel"}`}>
          <p className="text-4xl font-extrabold">{ergebnis.prozent} %</p>
          <p className="font-semibold">
            {ergebnis.richtig} von {ergebnis.gesamt} richtig · {ergebnis.bestanden ? "bestanden" : "nicht bestanden"}
          </p>
        </section>
        {falsch.length > 0 && (
          <section className="flex flex-col gap-2 rounded-2xl bg-white p-5 shadow-sm">
            <h2 className="font-semibold">{falsch.length === 1 ? "Diese Frage war falsch:" : "Diese Fragen waren falsch:"}</h2>
            <ul className="flex list-disc flex-col gap-1 pl-5 text-gray-700">
              {falsch.map((f) => (
                <li key={f.id}>{f.frage}</li>
              ))}
            </ul>
          </section>
        )}
        {ergebnis.bestanden ? (
          <section className="flex flex-col gap-3 rounded-2xl bg-white p-5 shadow-sm">
            <h2 className="font-titel text-lg font-semibold">Unterschrift</h2>
            <p>
              Ich wurde zu „{titel}“ unterwiesen, habe die Inhalte verstanden und werde sie einhalten.
            </p>
            <Unterschrift onChange={setUnterschrift} />
            {fehlerZeile}
            <button type="button" onClick={unterschreiben} className={gelb} disabled={sendet || !unterschrift}>
              {sendet ? "Wird gespeichert …" : "Unterschreiben und abschließen"}
            </button>
          </section>
        ) : (
          <>
            <p className="text-gray-700">
              Du brauchst mindestens {noetig(ergebnis.gesamt)} richtige Antworten. Lies die Unterweisung noch einmal und versuche es erneut.
            </p>
            <button type="button" onClick={() => gehe("lesen")} className={gelb}>
              Noch einmal lesen
            </button>
            <button type="button" onClick={testStarten} className={rahmen}>
              Test sofort wiederholen
            </button>
          </>
        )}
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-4 p-5">
      <section className="flex flex-col items-center gap-2 rounded-2xl bg-white p-6 text-center shadow-sm">
        <span aria-hidden className="flex h-14 w-14 items-center justify-center rounded-full bg-ok text-3xl text-white">
          ✓
        </span>
        <h2 className="font-titel text-xl font-semibold">Unterweisung abgeschlossen</h2>
        <p className="text-gray-700">
          „{titel}“ ist erledigt und gilt bis {gueltigBis.split("-").reverse().join(".")}.
        </p>
      </section>
      <Link href="/fahrer/unterweisungen" className={gelb}>
        Zu den Unterweisungen
      </Link>
    </div>
  );
}
