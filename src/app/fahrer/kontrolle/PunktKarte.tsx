"use client";

import { FotoAufnahme } from "@/components/FotoAufnahme";
import { fotoPflicht, istMangel, type Antwort } from "@/lib/kontrolle/regeln";
import type { KontrollPruefpunkt } from "./typen";

export const leer: Antwort = { antwortJa: null, bemerkung: "", fotoPfade: [], losfahren: null };

// „In Ordnung“ / „Mangel“ auf die gespeicherte Ja/Nein-Antwort abbilden.
export function inOrdnung(p: KontrollPruefpunkt, a: Antwort): boolean | null {
  if (a.antwortJa === null) return null;
  return !istMangel(p, a.antwortJa);
}

export function Abzeichen({ pflicht }: { pflicht: boolean }) {
  return pflicht ? (
    <span className="inline-flex items-center gap-1 self-start rounded-md bg-marke-blau/10 px-2 py-0.5 text-xs font-semibold text-marke-blau">
      <span aria-hidden>🔒</span> Pflicht
    </span>
  ) : (
    <span className="self-start rounded-md bg-marke-gelb/50 px-2 py-0.5 text-xs font-semibold text-marke-blau-dunkel">Verkehrsleiter</span>
  );
}

type Props = {
  p: KontrollPruefpunkt;
  a: Antwort;
  onChange: (teil: Partial<Antwort>) => void;
  ordner: string;
  reifenFaellig: boolean;
  markiert: boolean;
  zusatzOffen: boolean;
  onZusatz: () => void;
  // UVV-Zeilen: ohne Link „Bemerkung oder Foto“, damit die Liste kurz bleibt.
  ohneLink?: boolean;
};

// Ein Prüfpunkt als Karte (Kategorien) – wie im Konzept „Fahrer · Prüfpunkte“.
export function PunktKarte(props: Props) {
  const { p, a, onChange, markiert } = props;
  const ok = inOrdnung(p, a);
  return (
    <li
      id={`punkt-${p.id}`}
      className={`flex flex-col gap-3 rounded-2xl border-2 bg-white p-4 shadow-sm ${markiert || ok === false ? "border-mangel" : "border-transparent"}`}
    >
      <Abzeichen pflicht={p.pflicht} />
      <p className="font-semibold">{p.frage}</p>
      <div role="radiogroup" aria-label={p.frage} className="grid grid-cols-2 gap-2">
        <button
          type="button"
          role="radio"
          aria-checked={ok === true}
          onClick={() => onChange({ antwortJa: !p.mangel_bei_ja, losfahren: null })}
          className={`h-12 rounded-xl border-2 font-semibold ${ok === true ? "border-ok bg-ok text-white" : "border-gray-300 bg-white"}`}
        >
          ✓ In Ordnung
        </button>
        <button
          type="button"
          role="radio"
          aria-checked={ok === false}
          onClick={() => onChange({ antwortJa: p.mangel_bei_ja })}
          className={`h-12 rounded-xl border-2 font-semibold ${ok === false ? "border-mangel bg-mangel text-white" : "border-gray-300 bg-white"}`}
        >
          {ok === false ? "✕ Mangel" : "Mangel"}
        </button>
      </div>
      <Zusatz {...props} />
    </li>
  );
}

// UVV-Punkt als kompakte Zeile mit Haken – wie im Konzept „UVV Arbeitsgeräte“.
export function UvvZeile(props: Props) {
  const { p, a, onChange, markiert } = props;
  const ok = inOrdnung(p, a);
  return (
    <li id={`punkt-${p.id}`} className={`flex flex-col gap-3 px-4 py-2 ${markiert ? "bg-mangel/5 ring-2 ring-mangel ring-inset" : ""}`}>
      <div className="flex items-center gap-3">
        <button
          type="button"
          role="checkbox"
          aria-checked={ok === true}
          onClick={() => onChange(ok === true ? { antwortJa: null } : { antwortJa: !p.mangel_bei_ja, losfahren: null })}
          className="flex min-h-11 flex-1 items-center gap-3 text-left"
        >
          <span
            aria-hidden
            className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 text-sm font-bold ${ok === true ? "border-ok bg-ok text-white" : ok === false ? "border-mangel bg-mangel text-white" : "border-gray-300 bg-white"}`}
          >
            {ok === true ? "✓" : ok === false ? "✕" : ""}
          </span>
          <span className="flex flex-col">
            <span>{p.frage}</span>
            {!p.pflicht && <span className="text-xs font-semibold text-warnung">vom Verkehrsleiter gewählt</span>}
          </span>
        </button>
        <button
          type="button"
          aria-pressed={ok === false}
          onClick={() => onChange({ antwortJa: p.mangel_bei_ja })}
          className={`h-11 shrink-0 rounded-lg border-2 px-3 text-sm font-semibold ${ok === false ? "border-mangel bg-mangel text-white" : "border-gray-300 text-gray-700"}`}
        >
          Mangel
        </button>
      </div>
      <Zusatz {...props} ohneLink />
    </li>
  );
}

// Mangel-Bereich („Was ist defekt?“, Foto, „Darf ich so losfahren?“) bzw. Reifenfotos und freiwillige Bemerkung.
function Zusatz({ p, a, onChange, ordner, reifenFaellig, zusatzOffen, onZusatz, ohneLink }: Props) {
  const mangel = istMangel(p, a.antwortJa);
  const reifenPflicht = p.monatliche_fotos && reifenFaellig;
  const fotos = (
    <FotoAufnahme
      ordner={ordner}
      praefix={`antwort-${p.reihenfolge}`}
      pfade={a.fotoPfade}
      onChange={(fotoPfade) => onChange({ fotoPfade })}
      pflicht={fotoPflicht(p, a.antwortJa, reifenFaellig)}
      beschriftung={reifenPflicht ? "Reifen fotografieren" : mangel ? (p.foto_bei_mangel ? "Foto vom Mangel (Pflicht)" : "Foto hinzufügen") : "Foto hinzufügen"}
    />
  );

  if (mangel) {
    return (
      <div className="flex flex-col gap-3 rounded-xl bg-mangel/5 p-3">
        <label className="flex flex-col gap-1 text-sm font-semibold text-mangel">
          Was ist defekt?
          <textarea
            value={a.bemerkung}
            onChange={(e) => onChange({ bemerkung: e.target.value })}
            rows={2}
            placeholder="z. B. Blinker hinten links ohne Funktion"
            className={`rounded-xl border bg-white p-3 text-base font-normal text-marke-blau-dunkel ${a.bemerkung.trim() ? "border-gray-300" : "border-mangel"}`}
          />
        </label>
        {fotos}
        {p.mangel_stoppt ? (
          <p className="rounded-xl bg-mangel p-3 font-semibold text-white">Mit diesem Mangel darfst du nicht losfahren.</p>
        ) : (
          <div className="flex flex-col gap-2">
            <p className="text-sm font-semibold text-mangel">Darf ich so losfahren?</p>
            <div role="radiogroup" aria-label="Darf ich so losfahren?" className="grid grid-cols-2 gap-2">
              <button
                type="button"
                role="radio"
                aria-checked={a.losfahren === true}
                onClick={() => onChange({ losfahren: true })}
                className={`min-h-12 rounded-xl border-2 px-2 font-semibold ${a.losfahren === true ? "border-marke-blau bg-marke-blau text-white" : "border-gray-300 bg-white"}`}
              >
                Ja, geringer Mangel
              </button>
              <button
                type="button"
                role="radio"
                aria-checked={a.losfahren === false}
                onClick={() => onChange({ losfahren: false })}
                className={`min-h-12 rounded-xl border-2 px-2 font-semibold ${a.losfahren === false ? "border-mangel bg-mangel text-white" : "border-mangel/60 bg-white text-mangel"}`}
              >
                Nein – Stopp
              </button>
            </div>
          </div>
        )}
        <p className="text-sm text-mangel">Verkehrsleiter wird sofort benachrichtigt.</p>
      </div>
    );
  }

  if (reifenPflicht || zusatzOffen) {
    return (
      <div className="flex flex-col gap-3">
        {reifenPflicht && <p className="text-sm text-warnung">Diesen Monat bitte Fotos aller Reifen machen.</p>}
        <label className="flex flex-col gap-1 text-sm text-gray-700">
          Bemerkung (freiwillig)
          <textarea
            value={a.bemerkung}
            onChange={(e) => onChange({ bemerkung: e.target.value })}
            rows={2}
            className="rounded-xl border border-gray-300 bg-white p-3 text-base"
          />
        </label>
        {fotos}
      </div>
    );
  }

  if (ohneLink) return null;
  return (
    <button type="button" onClick={onZusatz} className="h-11 self-start text-sm text-marke-blau underline">
      Bemerkung oder Foto hinzufügen
    </button>
  );
}
