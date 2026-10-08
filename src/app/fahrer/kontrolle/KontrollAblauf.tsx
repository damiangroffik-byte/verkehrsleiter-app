"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { FotoAufnahme } from "@/components/FotoAufnahme";
import { JaNein } from "@/components/JaNein";
import { Frist, Karte } from "@/components/ui";
import { Unterschrift, alsPng } from "@/components/Unterschrift";
import { fotoPflicht, istMangel, istSichtbar, pruefeEntwurf, reifenfotosFaellig, type Antwort } from "@/lib/kontrolle/regeln";
import { createClient } from "@/lib/supabase/browser";
import { kontrolleEinreichen } from "./actions";
import type { KontrollEntwurf, KontrollFahrzeug, KontrollPruefpunkt } from "./typen";

type Schritt = "fahrzeug" | "pruefpunkte" | "unterschrift" | "fertig";

const leer: Antwort = { antwortJa: null, bemerkung: "", fotoPfade: [] };

export function KontrollAblauf({
  firmaId,
  fahrzeuge,
  anhaenger,
  pruefpunkte,
  standardArtId,
  reifenZuletzt,
  heute,
}: {
  firmaId: string;
  fahrzeuge: KontrollFahrzeug[];
  anhaenger: KontrollFahrzeug[];
  pruefpunkte: KontrollPruefpunkt[];
  standardArtId: string | null;
  reifenZuletzt: Record<string, string>;
  heute: number;
}) {
  const [kontrolleId] = useState(() => crypto.randomUUID());
  const [schritt, setSchritt] = useState<Schritt>("fahrzeug");
  const [fahrzeugId, setFahrzeugId] = useState<string | null>(fahrzeuge.length === 1 ? fahrzeuge[0].id : null);
  const [anhaengerId, setAnhaengerId] = useState<string | null>(null);
  const [antworten, setAntworten] = useState<Record<string, Antwort>>({});
  const [offen, setOffen] = useState<Record<string, boolean>>({});
  const [unterschrift, setUnterschrift] = useState<HTMLCanvasElement | null>(null);
  const [fehler, setFehler] = useState<{ text: string; pruefpunktId?: string } | null>(null);
  const [sendet, setSendet] = useState(false);
  const [mitMangel, setMitMangel] = useState(false);

  const ordner = `${firmaId}/${kontrolleId}`;
  const fahrzeug = fahrzeuge.find((f) => f.id === fahrzeugId) ?? null;
  const gewaehlterAnhaenger = anhaenger.find((a) => a.id === anhaengerId) ?? null;
  const reifenFaellig = fahrzeug ? reifenfotosFaellig(reifenZuletzt[fahrzeug.id] ?? null, new Date(heute)) : false;

  const sichtbare = useMemo(() => {
    if (!fahrzeug) return [];
    const art = fahrzeug.fahrzeugart_id ?? standardArtId;
    const lage = { adr: fahrzeug.adr || Boolean(gewaehlterAnhaenger?.adr), mitAnhaenger: Boolean(gewaehlterAnhaenger) };
    return pruefpunkte.filter((p) => p.fahrzeugart_id === art && istSichtbar(p, lage));
  }, [fahrzeug, gewaehlterAnhaenger, pruefpunkte, standardArtId]);

  const abschnitte = useMemo(() => {
    const gruppen = new Map<string, KontrollPruefpunkt[]>();
    for (const p of sichtbare) gruppen.set(p.abschnitt, [...(gruppen.get(p.abschnitt) ?? []), p]);
    return [...gruppen.entries()];
  }, [sichtbare]);

  function antworte(id: string, teil: Partial<Antwort>) {
    setAntworten((a) => ({ ...a, [id]: { ...(a[id] ?? leer), ...teil } }));
    if (fehler?.pruefpunktId === id) setFehler(null);
  }

  function zeigeFehler(text: string, pruefpunktId?: string) {
    setFehler({ text, pruefpunktId });
    if (pruefpunktId) {
      setSchritt("pruefpunkte");
      requestAnimationFrame(() =>
        document.getElementById(`punkt-${pruefpunktId}`)?.scrollIntoView({ behavior: "smooth", block: "center" }),
      );
    } else {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }

  function weiterZuUnterschrift() {
    const f = pruefeEntwurf({ fahrzeugId, antworten, unterschrieben: true }, sichtbare, reifenFaellig);
    if (f) return zeigeFehler(f.text, f.feld === "pruefpunkt" ? f.pruefpunktId : undefined);
    setFehler(null);
    setSchritt("unterschrift");
    window.scrollTo({ top: 0 });
  }

  async function einreichen() {
    const f = pruefeEntwurf({ fahrzeugId, antworten, unterschrieben: Boolean(unterschrift) }, sichtbare, reifenFaellig);
    if (f) return zeigeFehler(f.text, f.feld === "pruefpunkt" ? f.pruefpunktId : undefined);
    if (!unterschrift || !fahrzeugId) return;

    setSendet(true);
    setFehler(null);
    try {
      const durchgefuehrtAm = new Date().toISOString();
      const unterschriftPfad = `${ordner}/unterschrift.png`;
      const { error } = await createClient()
        .storage.from("kontrollen")
        .upload(unterschriftPfad, await alsPng(unterschrift), { contentType: "image/png", upsert: false });
      // Beim erneuten Senden liegt die Unterschrift schon in Storage.
      if (error && !/exists|duplicate/i.test(error.message)) throw error;

      const entwurf: KontrollEntwurf = {
        kontrolleId,
        firmaId,
        fahrzeugId,
        anhaengerId,
        durchgefuehrtAm,
        unterschriftPfad,
        antworten: sichtbare.map((p) => {
          const a = antworten[p.id] ?? leer;
          return {
            pruefpunktId: p.id,
            antwortJa: a.antwortJa === true,
            bemerkung: a.bemerkung.trim() || null,
            fotoPfade: a.fotoPfade,
          };
        }),
      };
      const ergebnis = await kontrolleEinreichen(entwurf);
      if (!ergebnis.ok) {
        const punkt = ergebnis.feld?.startsWith("pruefpunkt:") ? ergebnis.feld.slice("pruefpunkt:".length) : undefined;
        return zeigeFehler(ergebnis.fehler, punkt);
      }
      setMitMangel(ergebnis.mitMangel);
      setSchritt("fertig");
      window.scrollTo({ top: 0 });
    } catch {
      zeigeFehler("Die Kontrolle konnte nicht gesendet werden. Bitte prüfe die Verbindung und tippe noch einmal auf „Einreichen“.");
    } finally {
      setSendet(false);
    }
  }

  if (schritt === "fertig") {
    return (
      <Karte titel="Kontrolle eingereicht">
        <p className="text-lg">
          Danke! Die Abfahrtskontrolle für <strong>{fahrzeug?.kennzeichen}</strong> ist gespeichert.
        </p>
        {mitMangel && (
          <p className="rounded-xl border-2 border-mangel bg-mangel/5 p-3 font-semibold text-mangel">
            Du hast einen Mangel gemeldet. Fahrt erst nach Rücksprache mit Disposition oder Verkehrsleiter antreten.
          </p>
        )}
        <Link href="/fahrer" className="flex h-12 items-center justify-center rounded-xl bg-marke-gelb font-semibold text-marke-blau">
          Fertig
        </Link>
      </Karte>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <Schritte aktuell={schritt} />

      {fehler && (
        <p role="alert" className="rounded-xl border-2 border-mangel bg-white p-3 font-semibold text-mangel">
          {fehler.text}
        </p>
      )}

      {schritt === "fahrzeug" && (
        <>
          <Karte titel="Fahrzeug">
            <div className="flex flex-col gap-2">
              {fahrzeuge.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setFahrzeugId(f.id)}
                  aria-pressed={f.id === fahrzeugId}
                  className={`flex min-h-12 items-center justify-between rounded-xl border-2 px-4 text-left font-semibold ${f.id === fahrzeugId ? "border-marke-blau bg-marke-blau text-white" : "border-gray-300 bg-white"}`}
                >
                  {f.kennzeichen}
                  {f.adr && <span className="text-sm font-normal">ADR</span>}
                </button>
              ))}
            </div>
          </Karte>

          {anhaenger.length > 0 && (
            <Karte titel="Anhänger">
              <select
                value={anhaengerId ?? ""}
                onChange={(e) => setAnhaengerId(e.target.value || null)}
                className="h-12 rounded-xl border border-gray-300 bg-white px-3 text-base"
              >
                <option value="">Ohne Anhänger</option>
                {anhaenger.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.kennzeichen}
                  </option>
                ))}
              </select>
            </Karte>
          )}

          {fahrzeug && (
            <Karte titel="Fristen">
              <Fristen fahrzeug={fahrzeug} heute={heute} />
              {gewaehlterAnhaenger && (
                <>
                  <p className="pt-2 text-sm font-semibold">Anhänger {gewaehlterAnhaenger.kennzeichen}</p>
                  <Fristen fahrzeug={gewaehlterAnhaenger} heute={heute} />
                </>
              )}
            </Karte>
          )}

          <button
            type="button"
            disabled={!fahrzeug}
            onClick={() => {
              setFehler(null);
              setSchritt("pruefpunkte");
              window.scrollTo({ top: 0 });
            }}
            className="h-12 rounded-xl bg-marke-gelb font-semibold text-marke-blau disabled:opacity-50"
          >
            Weiter zu den Prüfpunkten
          </button>
        </>
      )}

      {schritt === "pruefpunkte" && (
        <>
          <p className="text-sm text-gray-600">
            {fahrzeug?.kennzeichen}
            {gewaehlterAnhaenger && ` mit ${gewaehlterAnhaenger.kennzeichen}`} ·{" "}
            <button type="button" className="underline" onClick={() => setSchritt("fahrzeug")}>
              ändern
            </button>
          </p>
          {abschnitte.map(([abschnitt, punkte]) => (
            <Karte key={abschnitt} titel={abschnitt}>
              <ul className="flex flex-col divide-y divide-gray-200">
                {punkte.map((p) => {
                  const a = antworten[p.id] ?? leer;
                  const mangel = istMangel(p, a.antwortJa);
                  const reifenPflicht = p.monatliche_fotos && reifenFaellig;
                  const zusatz = mangel || reifenPflicht || offen[p.id];
                  return (
                    <li
                      key={p.id}
                      id={`punkt-${p.id}`}
                      className={`flex flex-col gap-3 py-4 ${fehler?.pruefpunktId === p.id ? "-mx-2 rounded-xl px-2 ring-2 ring-mangel" : ""}`}
                    >
                      <p className="font-semibold">{p.frage}</p>
                      <JaNein name={p.frage} wert={a.antwortJa} mangelBeiJa={p.mangel_bei_ja} onChange={(ja) => antworte(p.id, { antwortJa: ja })} />
                      {reifenPflicht && (
                        <p className="text-sm text-warnung">Diesen Monat bitte Fotos aller Reifen machen.</p>
                      )}
                      {zusatz ? (
                        <>
                          <label className="flex flex-col gap-1 text-sm text-gray-700">
                            {mangel ? "Beschreibung des Mangels (Pflicht)" : "Bemerkung (freiwillig)"}
                            <textarea
                              value={a.bemerkung}
                              onChange={(e) => antworte(p.id, { bemerkung: e.target.value })}
                              rows={2}
                              className={`rounded-xl border bg-white p-3 text-base ${mangel && !a.bemerkung.trim() ? "border-mangel" : "border-gray-300"}`}
                            />
                          </label>
                          <FotoAufnahme
                            ordner={ordner}
                            praefix={`antwort-${p.reihenfolge}`}
                            pfade={a.fotoPfade}
                            onChange={(fotoPfade) => antworte(p.id, { fotoPfade })}
                            pflicht={fotoPflicht(p, a.antwortJa, reifenFaellig)}
                            beschriftung={
                              reifenPflicht ? "Reifen fotografieren" : mangel ? "Foto vom Mangel (Pflicht)" : "Foto hinzufügen"
                            }
                          />
                        </>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setOffen((o) => ({ ...o, [p.id]: true }))}
                          className="h-11 self-start text-sm text-marke-blau underline"
                        >
                          Bemerkung oder Foto hinzufügen
                        </button>
                      )}
                    </li>
                  );
                })}
              </ul>
            </Karte>
          ))}
          <button type="button" onClick={weiterZuUnterschrift} className="h-12 rounded-xl bg-marke-gelb font-semibold text-marke-blau">
            Weiter zur Unterschrift
          </button>
        </>
      )}

      {schritt === "unterschrift" && (
        <>
          <Karte titel="Unterschrift">
            <p className="text-sm text-gray-600">
              Mit deiner Unterschrift bestätigst du, dass du die Abfahrtskontrolle für {fahrzeug?.kennzeichen}
              {gewaehlterAnhaenger && ` und ${gewaehlterAnhaenger.kennzeichen}`} durchgeführt hast.
            </p>
            <Unterschrift onChange={setUnterschrift} />
          </Karte>
          <button
            type="button"
            onClick={einreichen}
            disabled={sendet}
            className="h-12 rounded-xl bg-marke-gelb font-semibold text-marke-blau disabled:opacity-60"
          >
            {sendet ? "Wird gesendet …" : "Einreichen"}
          </button>
          <button type="button" onClick={() => setSchritt("pruefpunkte")} className="h-11 text-sm underline">
            Zurück zu den Prüfpunkten
          </button>
        </>
      )}
    </div>
  );
}

function Fristen({ fahrzeug, heute }: { fahrzeug: KontrollFahrzeug; heute: number }) {
  return (
    <dl className="grid grid-cols-3 gap-2 text-sm">
      {(
        [
          ["HU", fahrzeug.hu_faellig],
          ["SP", fahrzeug.sp_faellig],
          ["Tacho", fahrzeug.tacho_faellig],
        ] as const
      ).map(([name, datum]) => (
        <div key={name} className="flex flex-col">
          <dt className="text-gray-600">{name}</dt>
          <dd>
            <Frist datum={datum} heute={heute} />
          </dd>
        </div>
      ))}
    </dl>
  );
}

function Schritte({ aktuell }: { aktuell: Schritt }) {
  const liste: [Schritt, string][] = [
    ["fahrzeug", "Fahrzeug"],
    ["pruefpunkte", "Prüfpunkte"],
    ["unterschrift", "Unterschrift"],
  ];
  const index = liste.findIndex(([s]) => s === aktuell);
  return (
    <ol className="grid grid-cols-3 gap-2 text-center text-sm">
      {liste.map(([s, name], i) => (
        <li
          key={s}
          aria-current={s === aktuell ? "step" : undefined}
          className={`rounded-lg py-2 font-semibold ${i <= index ? "bg-marke-blau text-white" : "bg-white text-gray-500"}`}
        >
          {i + 1}. {name}
        </li>
      ))}
    </ol>
  );
}
