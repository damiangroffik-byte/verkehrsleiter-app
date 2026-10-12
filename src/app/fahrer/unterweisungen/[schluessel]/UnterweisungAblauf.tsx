"use client";

import Link from "next/link";
import { useState } from "react";
import { Unterschrift, alsPng } from "@/components/Unterschrift";
import { createClient } from "@/lib/supabase/browser";
import { BESTEHEN_PROZENT, mischen, noetig, seiten, type Abschnitt, type Frage } from "@/lib/unterweisung/regeln";
import { testAuswerten, unterweisungUnterschreiben } from "../actions";
import { Bild } from "./Bild";

type Props = { firmaId: string; schluessel: string; titel: string; dauer: number; abschnitte: Abschnitt[]; fragen: Frage[] };
type Schritt = "start" | "lernen" | "ergebnis" | "fertig";
// Ein Durchgang: eigene ID und gemischte Antwortreihenfolge je Frage.
type Versuch = { id: string; reihenfolge: Record<string, number[]> };
type Ergebnis = { richtig: number; gesamt: number; prozent: number; bestanden: boolean; falsch: string[] };

const gelb = "flex h-14 w-full items-center justify-center rounded-xl bg-marke-gelb text-lg font-semibold text-marke-blau disabled:opacity-50";
const rahmen = "flex h-12 w-full items-center justify-center rounded-xl border-2 border-marke-blau font-semibold text-marke-blau";

export function UnterweisungAblauf({ firmaId, schluessel, titel, dauer, abschnitte, fragen }: Props) {
  const [schritt, setSchritt] = useState<Schritt>("start");
  const [seite, setSeite] = useState(0);
  const [versuch, setVersuch] = useState<Versuch | null>(null);
  const [antworten, setAntworten] = useState<Record<string, number>>({});
  const [ergebnis, setErgebnis] = useState<Ergebnis | null>(null);
  const [unterschrift, setUnterschrift] = useState<HTMLCanvasElement | null>(null);
  const [gueltigBis, setGueltigBis] = useState("");
  const [sendet, setSendet] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);

  const ablauf = seiten(abschnitte.length, fragen.length);

  function oben() {
    window.scrollTo({ top: 0 });
  }

  // Jeder Durchgang bekommt eine neue ID und neu gemischte Antworten.
  function starten() {
    setVersuch({
      id: crypto.randomUUID(),
      reihenfolge: Object.fromEntries(fragen.map((f) => [f.id, mischen(f.antworten.length)])),
    });
    setAntworten({});
    setErgebnis(null);
    setSeite(0);
    setFehler(null);
    setSchritt("lernen");
    oben();
  }

  function zu(n: number) {
    setSeite(n);
    setFehler(null);
    oben();
  }

  async function auswerten() {
    if (!versuch) return;
    const offen = fragen.findIndex((f) => antworten[f.id] === undefined);
    if (offen >= 0) return zu(ablauf.findIndex((s) => s.art === "frage" && s.i === offen));
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
      setSchritt("ergebnis");
      oben();
    } catch {
      setFehler("Die Antworten konnten nicht gesendet werden. Bitte prüfe die Verbindung und tippe noch einmal.");
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
      setSchritt("fertig");
      oben();
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

  if (schritt === "start") {
    return (
      <div className="mx-auto flex w-full max-w-md flex-col gap-4 p-5">
        <section className="flex flex-col gap-3 rounded-2xl bg-white p-5 shadow-sm">
          <h2 className="font-titel text-xl font-semibold">So geht&apos;s</h2>
          <ul className="flex flex-col gap-2">
            <li>📖 {abschnitte.length} kurze Abschnitte mit Bild</li>
            <li>❓ Nach jedem Abschnitt eine Frage</li>
            <li>
              ✅ Mindestens {noetig(fragen.length)} von {fragen.length} richtig ({BESTEHEN_PROZENT} %)
            </li>
            <li>✍️ Zum Schluss unterschreiben</li>
          </ul>
          <p className="text-sm text-gray-600">Dauer etwa {dauer} Minuten.</p>
        </section>
        <button type="button" onClick={starten} className={gelb} disabled={ablauf.length === 0}>
          Los geht&apos;s
        </button>
      </div>
    );
  }

  if (schritt === "lernen" && versuch) {
    const s = ablauf[seite];
    const letzte = seite === ablauf.length - 1;
    const fortschritt = (
      <div className="flex flex-col gap-1">
        <div className="h-2 overflow-hidden rounded-full bg-gray-200" aria-hidden>
          <div className="h-full bg-marke-blau transition-all" style={{ width: `${((seite + 1) / ablauf.length) * 100}%` }} />
        </div>
        <p className="text-sm text-gray-600">
          {s.art === "abschnitt" ? `Abschnitt ${s.i + 1} von ${abschnitte.length}` : `Frage ${s.i + 1} von ${fragen.length}`}
        </p>
      </div>
    );
    const zurueck = seite > 0 && (
      <button type="button" onClick={() => zu(seite - 1)} className="h-12 px-3 font-semibold text-marke-blau underline">
        Zurück
      </button>
    );

    if (s.art === "abschnitt") {
      const a = abschnitte[s.i];
      return (
        <div className="mx-auto flex w-full max-w-md flex-col gap-4 p-5">
          {fortschritt}
          <section className="flex flex-col gap-4 rounded-2xl bg-white p-5 shadow-sm">
            <Bild name={a.bild} titel={a.titel} />
            <h2 className="font-titel text-xl font-semibold text-marke-blau">{a.titel}</h2>
            {a.text && <p className="text-lg leading-relaxed">{a.text}</p>}
            {a.punkte && a.punkte.length > 0 && (
              <ul className="flex flex-col gap-2">
                {a.punkte.map((p) => (
                  <li key={p} className="flex gap-2 text-lg">
                    <span aria-hidden className="mt-2.5 h-2 w-2 shrink-0 rounded-full bg-marke-gelb" />
                    <span>{p}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
          <div className="flex items-center gap-2">
            {zurueck}
            <button type="button" onClick={() => (letzte ? auswerten() : zu(seite + 1))} className={gelb} disabled={sendet}>
              Weiter
            </button>
          </div>
          {fehlerZeile}
        </div>
      );
    }

    const f = fragen[s.i];
    const beantwortet = antworten[f.id] !== undefined;
    return (
      <div className="mx-auto flex w-full max-w-md flex-col gap-4 p-5">
        {fortschritt}
        <section className="flex flex-col gap-4 rounded-2xl border-2 border-marke-gelb bg-white p-5 shadow-sm">
          <p className="text-sm font-semibold tracking-wide text-warnung uppercase">Frage {s.i + 1}</p>
          <h2 className="text-lg font-semibold">{f.frage}</h2>
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
                  className={`flex min-h-14 items-center gap-3 rounded-xl border-2 px-3 py-2 text-left ${gewaehlt ? "border-marke-blau bg-marke-blau/10 font-semibold" : "border-gray-300 bg-white"}`}
                >
                  <span aria-hidden className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 ${gewaehlt ? "border-marke-blau" : "border-gray-400"}`}>
                    {gewaehlt && <span className="h-3 w-3 rounded-full bg-marke-blau" />}
                  </span>
                  {f.antworten[i]}
                </button>
              );
            })}
          </div>
        </section>
        <div className="flex items-center gap-2">
          {zurueck}
          <button type="button" onClick={() => (letzte ? auswerten() : zu(seite + 1))} className={gelb} disabled={!beantwortet || sendet}>
            {!beantwortet ? "Bitte eine Antwort wählen" : letzte ? (sendet ? "Wird ausgewertet …" : "Auswerten") : "Weiter"}
          </button>
        </div>
        {fehlerZeile}
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
            <p>Ich wurde zu „{titel}“ unterwiesen, habe die Inhalte verstanden und werde sie einhalten.</p>
            <Unterschrift onChange={setUnterschrift} />
            {fehlerZeile}
            <button type="button" onClick={unterschreiben} className={gelb} disabled={sendet || !unterschrift}>
              {sendet ? "Wird gespeichert …" : "Unterschreiben und abschließen"}
            </button>
          </section>
        ) : (
          <>
            <p className="text-gray-700">Du brauchst mindestens {noetig(ergebnis.gesamt)} richtige Antworten. Geh die Abschnitte noch einmal durch.</p>
            <button type="button" onClick={starten} className={gelb}>
              Noch einmal von vorn
            </button>
            <Link href="/fahrer/unterweisungen" className={rahmen}>
              Später weitermachen
            </Link>
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
