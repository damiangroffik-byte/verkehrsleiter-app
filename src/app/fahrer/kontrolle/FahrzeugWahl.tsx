"use client";

import { useState } from "react";
import { Frist } from "@/components/ui";
import { kennzeichenGueltig, kennzeichenNormal } from "@/lib/kennzeichen";
import type { KontrollFahrzeug } from "./typen";

// Wahl "eigen": der Fahrer tippt das Kennzeichen selbst ein.
export const EIGEN = "eigen";

export type Aufgeloest = {
  fahrzeug: KontrollFahrzeug | null; // Eintrag aus der Liste (auch wenn das getippte Kennzeichen dazu passt)
  kennzeichen: string; // einheitliches Format, z. B. KN-BC333
  neu: boolean; // getipptes Kennzeichen, das noch nicht in der Liste steht
  fehler: string | null;
};

export function aufloesen(wahl: string | null, eingabe: string, liste: KontrollFahrzeug[], andere: KontrollFahrzeug[], wort: string): Aufgeloest | null {
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

export function KennzeichenWahl({
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

export function Termin({ name, wert, onChange, heute }: { name: string; wert: string; onChange: (wert: string) => void; heute: number }) {
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
