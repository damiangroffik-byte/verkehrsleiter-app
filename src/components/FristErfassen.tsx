"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { fristAuslesen, fristSpeichern } from "@/app/fahrer/pruefungen/actions";
import { FotoAufnahme } from "@/components/FotoAufnahme";
import { ART_INFO, datumDe, type Art, type Stufe } from "@/lib/fahrzeugfristen";

const FARBE: Record<Stufe, string> = {
  fehlt: "border-mangel bg-mangel/5",
  rot: "border-mangel bg-mangel/5",
  orange: "border-warnung bg-marke-gelb/20",
  ok: "border-gray-200 bg-white",
};

function statusText(stufe: Stufe, datum: string | null) {
  if (!datum) return "Noch nicht erfasst – bitte Foto machen";
  if (stufe === "rot") return `Abgelaufen am ${datumDe(datum)}`;
  if (stufe === "orange") return `Bald fällig: ${datumDe(datum)}`;
  return `Gültig bis ${datumDe(datum)}`;
}

// Eine Prüffrist: Foto machen, Datum wird erkannt, Fahrer prüft und speichert.
export function FristErfassen({
  firmaId,
  fahrzeugId,
  art,
  datum,
  stufe,
}: {
  firmaId: string;
  fahrzeugId: string;
  art: Art;
  datum: string | null;
  stufe: Stufe;
}) {
  const router = useRouter();
  const info = ART_INFO[art];
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
    const erkannt = await fristAuslesen(firmaId, fahrzeugId, art, pfade[0]).catch(() => null);
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
    const r = await fristSpeichern(fahrzeugId, art, wert, fotos[0] ?? null);
    setSpeichert(false);
    if (!r.ok) {
      setFehler(r.fehler);
      return;
    }
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
          <span className="font-semibold">{info.titel}</span>
          <span className={`text-sm ${stufe === "ok" ? "text-ok" : stufe === "orange" ? "text-warnung" : "font-semibold text-mangel"}`}>
            {statusText(stufe, datum)}
          </span>
        </span>
        {!offen && (
          <button type="button" onClick={() => setOffen(true)} className="min-h-11 shrink-0 px-2 text-sm font-semibold text-marke-blau underline">
            Neu erfassen
          </button>
        )}
      </div>
      {offen && (
        <div className="flex flex-col gap-3">
          <p className="text-sm text-gray-700">Fotografiere: {info.foto}.</p>
          <FotoAufnahme
            ordner={`${firmaId}/${fahrzeugId}`}
            praefix={art}
            pfade={fotos}
            onChange={(p) => void foto(p)}
            beschriftung={fotos.length ? "Neues Foto machen" : "Foto machen"}
            pflicht={false}
            bucket="fahrzeugfristen"
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
