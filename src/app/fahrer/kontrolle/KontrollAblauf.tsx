"use client";

import Link from "next/link";
import { useState } from "react";
import { FotoAufnahme } from "@/components/FotoAufnahme";
import { JaNein } from "@/components/JaNein";
import { Frist, Karte } from "@/components/ui";
import { Unterschrift, alsPng } from "@/components/Unterschrift";
import { kennzeichenGueltig, kennzeichenNormal } from "@/lib/kennzeichen";
import { fotoPflicht, istMangel, istSichtbar, pruefeEntwurf, reifenfotosFaellig, type Antwort } from "@/lib/kontrolle/regeln";
import { createClient } from "@/lib/supabase/browser";
import { kontrolleEinreichen } from "./actions";
import type { KontrollEntwurf, KontrollFahrzeug, KontrollPruefpunkt, Prueftermine } from "./typen";

type Schritt = "fahrzeug" | "pruefpunkte" | "unterschrift" | "fertig";

const leer: Antwort = { antwortJa: null, bemerkung: "", fotoPfade: [] };

// Wahl "eigen": der Fahrer tippt das Kennzeichen selbst ein.
const EIGEN = "eigen";

type Aufgeloest = {
  fahrzeug: KontrollFahrzeug | null; // Eintrag aus der Liste (auch wenn das getippte Kennzeichen dazu passt)
  kennzeichen: string; // einheitliches Format, z. B. KN-BC333
  neu: boolean; // getipptes Kennzeichen, das noch nicht in der Liste steht
  fehler: string | null;
};

function aufloesen(wahl: string | null, eingabe: string, liste: KontrollFahrzeug[], andere: KontrollFahrzeug[], wort: string): Aufgeloest | null {
  if (wahl === null) return null;
  if (wahl !== EIGEN) {
    const f = liste.find((x) => x.id === wahl) ?? null;
    return { fahrzeug: f, kennzeichen: f?.kennzeichen ?? "", neu: false, fehler: f ? null : `Bitte wähle ${wort}.` };
  }
  const kennzeichen = kennzeichenNormal(eingabe);
  const f = liste.find((x) => x.kennzeichen === kennzeichen) ?? null;
  if (f) return { fahrzeug: f, kennzeichen, neu: false, fehler: null };
  let fehler: string | null = null;
  if (!kennzeichen) fehler = `Bitte gib das Kennzeichen ${wort === "ein Fahrzeug" ? "des Fahrzeugs" : "des Anhängers"} ein.`;
  else if (!kennzeichenGueltig(kennzeichen)) fehler = "Bitte gib das Kennzeichen so ein: KN-BC333.";
  else if (andere.some((x) => x.kennzeichen === kennzeichen))
    fehler = `${kennzeichen} ist als ${wort === "ein Fahrzeug" ? "Anhänger" : "Fahrzeug"} eingetragen.`;
  return { fahrzeug: null, kennzeichen, neu: true, fehler };
}

const keineTermine: Prueftermine = { hu: "", sp: "", tacho: "", anhaengerHu: "", anhaengerSp: "" };

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
  const start = fahrzeuge.length === 1 ? fahrzeuge[0] : null;
  const [kontrolleId] = useState(() => crypto.randomUUID());
  const [schritt, setSchritt] = useState<Schritt>("fahrzeug");
  const [wahl, setWahl] = useState<string | null>(start ? start.id : fahrzeuge.length === 0 ? EIGEN : null);
  const [eingabe, setEingabe] = useState("");
  const [anhWahl, setAnhWahl] = useState<string | null>(null);
  const [anhEingabe, setAnhEingabe] = useState("");
  const [termine, setTermine] = useState<Prueftermine>({
    ...keineTermine,
    hu: start?.hu_faellig ?? "",
    sp: start?.sp_faellig ?? "",
    tacho: start?.tacho_faellig ?? "",
  });
  const [vorbelegt, setVorbelegt] = useState({ fahrzeug: start?.id ?? null, anhaenger: null as string | null });
  const [antworten, setAntworten] = useState<Record<string, Antwort>>({});
  const [offen, setOffen] = useState<Record<string, boolean>>({});
  const [unterschrift, setUnterschrift] = useState<HTMLCanvasElement | null>(null);
  const [fehler, setFehler] = useState<{ text: string; pruefpunktId?: string } | null>(null);
  const [sendet, setSendet] = useState(false);
  const [mitMangel, setMitMangel] = useState(false);

  const ordner = `${firmaId}/${kontrolleId}`;
  const fz = aufloesen(wahl, eingabe, fahrzeuge, anhaenger, "ein Fahrzeug");
  const anh = aufloesen(anhWahl, anhEingabe, anhaenger, fahrzeuge, "einen Anhänger");
  const fahrzeug = fz?.fahrzeug ?? null;
  const gewaehlterAnhaenger = anh?.fahrzeug ?? null;
  const fahrzeugBereit = Boolean(fz && !fz.fehler);
  const reifenFaellig = fahrzeugBereit ? reifenfotosFaellig(fahrzeug ? (reifenZuletzt[fahrzeug.id] ?? null) : null, new Date(heute)) : false;

  // Prüftermine mit den bekannten Werten vorbelegen, sobald ein anderes Fahrzeug gewählt ist.
  const fzSchluessel = fahrzeug?.id ?? null;
  const anhSchluessel = gewaehlterAnhaenger?.id ?? null;
  if (fzSchluessel !== vorbelegt.fahrzeug || anhSchluessel !== vorbelegt.anhaenger) {
    setVorbelegt({ fahrzeug: fzSchluessel, anhaenger: anhSchluessel });
    setTermine((t) => ({
      ...t,
      ...(fzSchluessel !== vorbelegt.fahrzeug && {
        hu: fahrzeug?.hu_faellig ?? "",
        sp: fahrzeug?.sp_faellig ?? "",
        tacho: fahrzeug?.tacho_faellig ?? "",
      }),
      ...(anhSchluessel !== vorbelegt.anhaenger && {
        anhaengerHu: gewaehlterAnhaenger?.hu_faellig ?? "",
        anhaengerSp: gewaehlterAnhaenger?.sp_faellig ?? "",
      }),
    }));
  }

  const art = fahrzeug?.fahrzeugart_id ?? standardArtId;
  const lage = { adr: Boolean(fahrzeug?.adr || gewaehlterAnhaenger?.adr), mitAnhaenger: anh !== null };
  const sichtbare = fahrzeugBereit ? pruefpunkte.filter((p) => p.fahrzeugart_id === art && istSichtbar(p, lage)) : [];

  const gruppen = new Map<string, KontrollPruefpunkt[]>();
  for (const p of sichtbare) gruppen.set(p.abschnitt, [...(gruppen.get(p.abschnitt) ?? []), p]);
  const abschnitte = [...gruppen.entries()];

  const anhaengerText = anh ? anh.kennzeichen : null;

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

  // Fehlt etwas im ersten Schritt (Fahrzeug, Anhänger, Prüftermine)?
  function fahrzeugFehler(): string | null {
    if (!fz) return "Bitte wähle ein Fahrzeug oder tippe das Kennzeichen ein.";
    if (fz.fehler) return fz.fehler;
    if (anh?.fehler) return anh.fehler;
    const pflicht: [keyof Prueftermine, string][] = [
      ["hu", "HU"],
      ["sp", "SP"],
      ["tacho", "Tacho-Prüfung"],
      ...(anh ? ([["anhaengerHu", "HU des Anhängers"], ["anhaengerSp", "SP des Anhängers"]] as [keyof Prueftermine, string][]) : []),
    ];
    const fehlt = pflicht.find(([k]) => !termine[k]);
    return fehlt ? `Bitte trage den Termin für ${fehlt[1]} ein.` : null;
  }

  function weiterZuPruefpunkten() {
    const f = fahrzeugFehler();
    if (f) return zeigeFehler(f);
    setFehler(null);
    setSchritt("pruefpunkte");
    window.scrollTo({ top: 0 });
  }

  function weiterZuUnterschrift() {
    const f = pruefeEntwurf({ fahrzeugId: fahrzeugBereit ? EIGEN : null, antworten, unterschrieben: true }, sichtbare, reifenFaellig);
    if (f) return zeigeFehler(f.text, f.feld === "pruefpunkt" ? f.pruefpunktId : undefined);
    setFehler(null);
    setSchritt("unterschrift");
    window.scrollTo({ top: 0 });
  }

  async function einreichen() {
    const vorn = fahrzeugFehler();
    if (vorn) {
      setSchritt("fahrzeug");
      return zeigeFehler(vorn);
    }
    const f = pruefeEntwurf({ fahrzeugId: EIGEN, antworten, unterschrieben: Boolean(unterschrift) }, sichtbare, reifenFaellig);
    if (f) return zeigeFehler(f.text, f.feld === "pruefpunkt" ? f.pruefpunktId : undefined);
    if (!unterschrift || !fz) return;

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
        fahrzeugId: fahrzeug?.id ?? null,
        kennzeichen: fahrzeug ? null : fz.kennzeichen,
        anhaengerId: gewaehlterAnhaenger?.id ?? null,
        anhaengerKennzeichen: anh && !gewaehlterAnhaenger ? anh.kennzeichen : null,
        fristen: anh ? termine : { ...termine, anhaengerHu: "", anhaengerSp: "" },
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
        if (ergebnis.feld === "fristen" || ergebnis.feld === "fahrzeug" || ergebnis.feld === "anhaenger") setSchritt("fahrzeug");
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
          Danke! Die Abfahrtskontrolle für <strong>{fz?.kennzeichen}</strong> ist gespeichert.
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
            <KennzeichenWahl
              liste={fahrzeuge}
              wahl={wahl}
              onWahl={setWahl}
              eingabe={eingabe}
              onEingabe={setEingabe}
              aufgeloest={fz}
            />
          </Karte>

          <Karte titel="Anhänger">
            <KennzeichenWahl
              liste={anhaenger}
              wahl={anhWahl}
              onWahl={setAnhWahl}
              eingabe={anhEingabe}
              onEingabe={setAnhEingabe}
              aufgeloest={anh}
              ohne="Ohne Anhänger"
            />
          </Karte>

          {fz && (
            <Karte titel="Prüftermine">
              <p className="text-sm text-gray-600">Bitte prüfe die Termine und trage sie ein, wenn sie fehlen oder nicht stimmen.</p>
              <div className="grid grid-cols-1 gap-3">
                <Termin name="HU" wert={termine.hu} onChange={(hu) => setTermine((t) => ({ ...t, hu }))} heute={heute} />
                <Termin name="SP" wert={termine.sp} onChange={(sp) => setTermine((t) => ({ ...t, sp }))} heute={heute} />
                <Termin name="Tacho-Prüfung" wert={termine.tacho} onChange={(tacho) => setTermine((t) => ({ ...t, tacho }))} heute={heute} />
              </div>
              {anh && (
                <>
                  <p className="pt-2 text-sm font-semibold">Anhänger {anh.kennzeichen}</p>
                  <div className="grid grid-cols-1 gap-3">
                    <Termin name="HU" wert={termine.anhaengerHu} onChange={(anhaengerHu) => setTermine((t) => ({ ...t, anhaengerHu }))} heute={heute} />
                    <Termin name="SP" wert={termine.anhaengerSp} onChange={(anhaengerSp) => setTermine((t) => ({ ...t, anhaengerSp }))} heute={heute} />
                  </div>
                </>
              )}
            </Karte>
          )}

          <button type="button" onClick={weiterZuPruefpunkten} className="h-12 rounded-xl bg-marke-gelb font-semibold text-marke-blau">
            Weiter zu den Prüfpunkten
          </button>
        </>
      )}

      {schritt === "pruefpunkte" && (
        <>
          <p className="text-sm text-gray-600">
            {fz?.kennzeichen}
            {anhaengerText && ` mit ${anhaengerText}`} ·{" "}
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
              Mit deiner Unterschrift bestätigst du, dass du die Abfahrtskontrolle für {fz?.kennzeichen}
              {anhaengerText && ` und ${anhaengerText}`} durchgeführt hast.
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

function KennzeichenWahl({
  liste,
  wahl,
  onWahl,
  eingabe,
  onEingabe,
  aufgeloest,
  ohne,
}: {
  liste: KontrollFahrzeug[];
  wahl: string | null;
  onWahl: (wahl: string | null) => void;
  eingabe: string;
  onEingabe: (eingabe: string) => void;
  aufgeloest: Aufgeloest | null;
  ohne?: string;
}) {
  const [offen, setOffen] = useState(false);
  const gewaehlt = wahl !== null && wahl !== EIGEN ? (liste.find((f) => f.id === wahl) ?? null) : null;
  const eintrag = (aktiv: boolean) =>
    `flex min-h-12 items-center justify-between rounded-xl border-2 px-4 text-left font-semibold ${aktiv ? "border-marke-blau bg-marke-blau text-white" : "border-gray-300 bg-white"}`;

  function waehle(id: string | null) {
    onWahl(id);
    onEingabe("");
    setOffen(false);
  }

  function tippe(text: string) {
    onEingabe(text.toUpperCase());
    // Leeres Feld beim Anhänger heißt „ohne Anhänger“.
    onWahl(text.trim() === "" && ohne ? null : EIGEN);
  }

  return (
    <div className="flex flex-col gap-3">
      {(liste.length > 0 || ohne) && (
        <div className="flex flex-col gap-2">
          <button
            type="button"
            onClick={() => setOffen((o) => !o)}
            aria-expanded={offen}
            className={`flex min-h-12 items-center justify-between rounded-xl border-2 px-4 text-left font-semibold ${gewaehlt ? "border-marke-blau bg-marke-blau text-white" : "border-marke-blau bg-white text-marke-blau"}`}
          >
            <span>{gewaehlt ? gewaehlt.kennzeichen : `${ohne ? "Gespeicherte Anhänger" : "Gespeicherte Fahrzeuge"} (${liste.length})`}</span>
            <span aria-hidden className="text-sm font-normal">
              {offen ? "schließen ▴" : gewaehlt ? "ändern ▾" : "auswählen ▾"}
            </span>
          </button>
          {offen && (
            <div className="flex flex-col gap-2 rounded-xl bg-grund p-2">
              {ohne && (
                <button type="button" onClick={() => waehle(null)} aria-pressed={wahl === null} className={eintrag(wahl === null)}>
                  {ohne}
                </button>
              )}
              {liste.map((f) => (
                <button key={f.id} type="button" onClick={() => waehle(f.id)} aria-pressed={f.id === wahl} className={eintrag(f.id === wahl)}>
                  {f.kennzeichen}
                  {f.adr && <span className="text-sm font-normal">ADR</span>}
                </button>
              ))}
              {liste.length === 0 && <p className="px-2 py-1 text-sm text-gray-600">Noch keine gespeichert.</p>}
            </div>
          )}
        </div>
      )}
      <label className="flex flex-col gap-1 text-sm text-gray-700">
        {liste.length > 0 || ohne ? "Oder Kennzeichen selbst eintragen, z. B. KN-BC333" : "Kennzeichen eintragen, z. B. KN-BC333"}
        <input
          value={eingabe}
          onChange={(e) => tippe(e.target.value)}
          autoCapitalize="characters"
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          enterKeyHint="done"
          placeholder="KN-BC333"
          className={`h-12 rounded-xl border bg-white px-3 text-lg font-semibold uppercase tracking-wide ${wahl === EIGEN ? "border-marke-blau" : "border-gray-300"}`}
        />
        {wahl === EIGEN && aufgeloest && aufgeloest.kennzeichen && !aufgeloest.fehler && (
          <span className="text-gray-700">
            Wird gespeichert als <strong>{aufgeloest.kennzeichen}</strong>
            {aufgeloest.neu ? " (neu)" : " (aus der Liste)"}
          </span>
        )}
        {wahl === EIGEN && aufgeloest?.fehler && eingabe.trim() && <span className="text-mangel">{aufgeloest.fehler}</span>}
      </label>
    </div>
  );
}

function Termin({ name, wert, onChange, heute }: { name: string; wert: string; onChange: (wert: string) => void; heute: number }) {
  return (
    <label className="flex flex-col gap-1 text-sm text-gray-700">
      <span className="flex justify-between">
        {name} fällig
        {wert && <Frist datum={wert} heute={heute} />}
      </span>
      <input
        type="date"
        value={wert}
        onChange={(e) => onChange(e.target.value)}
        className={`h-12 rounded-xl border bg-white px-3 text-base ${wert ? "border-gray-300" : "border-mangel"}`}
      />
    </label>
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
