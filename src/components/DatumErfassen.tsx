"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { FotoAufnahme } from "@/components/FotoAufnahme";
import { datumDe, type Stufe } from "@/lib/fahrzeugfristen";

const FARBE: Record<Stufe, string> = {
  fehlt: "border-mangel bg-mangel/5",
  rot: "border-mangel bg-mangel/5",
  orange: "border-warnung bg-marke-gelb/20",
  ok: "border-gray-200 bg-white",
};

function statusText(stufe: Stufe, datum: string | null) {
  if (!datum) return stufe === "ok" ? "Noch nicht erfasst" : "Noch nicht erfasst – bitte Foto machen";
  if (stufe === "rot") return `Abgelaufen am ${datumDe(datum)}`;
  if (stufe === "orange") return `Bald fällig: ${datumDe(datum)}`;
  return `Gültig bis ${datumDe(datum)}`;
}

export type Speichern = (datum: string, foto: string | null) => Promise<{ ok: true } | { ok: false; fehler: string }>;

// Ein Ablaufdatum per Foto: Foto machen, Datum wird erkannt, Fahrer prüft und speichert.
export function DatumErfassen({
  titel,
  fotoText,
  bucket,
  ordner,
  praefix,
  datum,
  stufe,
  auslesen,
  speichern: sichern,
  onGespeichert,
  zusatz,
}: {
  titel: string;
  fotoText: string;
  bucket: string;
  ordner: string;
  praefix: string;
  datum: string | null;
  stufe: Stufe;
  auslesen: (pfad: string) => Promise<string | null>;
  speichern: Speichern;
  onGespeichert?: (datum: string) => void;
  // Kurzer Hinweis unter dem Status, z. B. „freiwillig“.
  zusatz?: string;
}) {
  const router = useRouter();
  const [offen, setOffen] = useState(stufe !== "ok");
  const [fotos, setFotos] = useState<string[]>([]);
  const [wert, setWert] = useState("");
  const [liest, setLiest] = useState(false);
  const [hinweis, setHinweis] = useState<string | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);
  const [speichert, setSpeichert] = useState(false);

  async function foto(pfade: string[]) {
    setFotos(pfade);
    setFehler(null);
    if (!pfade[0]) return;
    setLiest(true);
    setHinweis(null);
    const erkannt = await auslesen(pfade[0]).catch(() => null);
    setLiest(false);
    if (erkannt) {
      setWert(erkannt);
      setHinweis("Datum vom Foto erkannt. Bitte prüfen und speichern.");
    } else {
      setHinweis("Das Datum konnte nicht erkannt werden. Bitte trage es selbst ein.");
    }
  }

  async function speichern() {
    if (!wert) {
      setFehler("Bitte trage das Datum ein.");
      return;
    }
    setSpeichert(true);
    const r = await sichern(wert, fotos[0] ?? null);
    setSpeichert(false);
    if (!r.ok) {
      setFehler(r.fehler);
      return;
    }
    onGespeichert?.(wert);
    setOffen(false);
    setFotos([]);
    setWert("");
    setHinweis(null);
    router.refresh();
  }

  return (
    <li className={`flex flex-col gap-3 rounded-xl border-2 p-3 ${FARBE[stufe]}`}>
      <div className="flex items-start justify-between gap-2">
        <span className="flex flex-col">
          <span className="font-semibold">{titel}</span>
          <span className={`text-sm ${stufe === "ok" ? (datum ? "text-ok" : "text-gray-600") : stufe === "orange" ? "text-warnung" : "font-semibold text-mangel"}`}>
            {statusText(stufe, datum)}
          </span>
          {zusatz && <span className="text-sm text-gray-600">{zusatz}</span>}
        </span>
        {!offen && (
          <button type="button" onClick={() => setOffen(true)} className="min-h-11 shrink-0 px-2 text-sm font-semibold text-marke-blau underline">
            {datum ? "Neu erfassen" : "Erfassen"}
          </button>
        )}
      </div>
      {offen && (
        <div className="flex flex-col gap-3">
          <p className="text-sm text-gray-700">Fotografiere: {fotoText}.</p>
          <FotoAufnahme
            ordner={ordner}
            praefix={praefix}
            pfade={fotos}
            onChange={(p) => void foto(p)}
            beschriftung={fotos.length ? "Neues Foto machen" : "Foto machen"}
            pflicht={false}
            bucket={bucket}
            mehrere={false}
          />
          {liest && <p className="text-sm font-semibold text-marke-blau">Datum wird erkannt …</p>}
          {hinweis && <p className="text-sm text-gray-700">{hinweis}</p>}
          <label className="flex flex-col gap-1 text-sm text-gray-700">
            Gültig bis / fällig am
            <input
              type="date"
              value={wert}
              onChange={(e) => setWert(e.target.value)}
              className="h-12 rounded-xl border border-gray-300 bg-white px-3 text-base text-marke-blau-dunkel"
            />
          </label>
          {fehler && <p className="text-sm font-semibold text-mangel">{fehler}</p>}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => void speichern()}
              disabled={speichert || liest}
              className="h-12 flex-1 rounded-xl bg-marke-gelb font-semibold text-marke-blau disabled:opacity-60"
            >
              {speichert ? "Speichert …" : "Speichern"}
            </button>
            {datum && (
              <button type="button" onClick={() => setOffen(false)} className="h-12 rounded-xl px-4 text-sm underline">
                Abbrechen
              </button>
            )}
          </div>
        </div>
      )}
    </li>
  );
}
