"use client";

import { useRef, useState } from "react";
import { FotoAufnahme } from "@/components/FotoAufnahme";
import { Karte } from "@/components/ui";
import type { Erkannt } from "@/lib/fuehrerschein/erkennung";
import { KLASSEN } from "@/lib/fuehrerschein/regeln";
import { fotosLesen } from "@/lib/fuehrerschein/texterkennung";
import { fuehrerscheinAuslesen, fuehrerscheinEinreichen } from "./actions";

export type Vorlage = { klassen: string[]; gueltigBis: string; code95Bis: string | null };

export function FuehrerscheinFormular({ firmaId, wartet, vorlage }: { firmaId: string; wartet: boolean; vorlage: Vorlage | null }) {
  const [pruefungId] = useState(() => crypto.randomUUID());
  const [vorne, setVorne] = useState<string[]>([]);
  const [hinten, setHinten] = useState<string[]>([]);
  // Klassen und Fristen ändern sich selten: Werte der letzten Prüfung vorausfüllen.
  const [klassen, setKlassen] = useState<string[]>(vorlage?.klassen ?? []);
  const [gueltigBis, setGueltigBis] = useState(vorlage?.gueltigBis ?? "");
  const [code95Bis, setCode95Bis] = useState(vorlage?.code95Bis ?? "");
  const [fehler, setFehler] = useState<string | null>(null);
  const [sendet, setSendet] = useState(false);
  const [fertig, setFertig] = useState(false);
  const [offen, setOffen] = useState(!wartet);

  const [liest, setLiest] = useState(false);
  // Ergebnis des automatischen Lesens, damit der Fahrer sieht, was passiert ist.
  const [lesen, setLesen] = useState<{ art: "gelesen" | "leer" | "fehler"; text?: string } | null>(null);

  const ordner = `${firmaId}/${pruefungId}`;

  const lauf = useRef(0);
  const dateien = useRef<{ vorne?: File; hinten?: File }>({});

  // Sobald beide Seiten fotografiert sind, liest die App Klassen und Daten vor.
  // Schon eingetragene Werte werden nicht überschrieben.
  // Erst die KI (nur wenn ein Schlüssel eingerichtet ist), sonst Texterkennung auf dem Handy.
  // Erkannte Werte ersetzen die Vorlage, leere Ergebnisse lassen alles, wie es ist.
  async function auslesen(v: string[], h: string[]) {
    const { vorne: dv, hinten: dh } = dateien.current;
    if (!v[0] || !h[0] || !dv || !dh) return;
    const nr = ++lauf.current;
    setLiest(true);
    setLesen(null);
    try {
      const ki = await fuehrerscheinAuslesen(firmaId, v[0], h[0]).catch(() => ({ ok: false as const }));
      const werte: Erkannt = ki.ok ? ki.werte : await fotosLesen(dv, dh);
      if (nr !== lauf.current) return;
      const { klassen: k, gueltigBis: g, code95Bis: c } = werte;
      if (k.length > 0) setKlassen(k);
      if (g) setGueltigBis(g);
      if (c) setCode95Bis(c);
      setLesen({ art: k.length > 0 || g || c ? "gelesen" : "leer" });
    } catch (e) {
      // Ohne Erkennung füllt der Fahrer selbst aus.
      console.error("Texterkennung fehlgeschlagen", e);
      if (nr === lauf.current) setLesen({ art: "fehler", text: e instanceof Error ? e.message : String(e) });
    } finally {
      if (nr === lauf.current) setLiest(false);
    }
  }

  function umschalten(k: string) {
    setKlassen((alt) => (alt.includes(k) ? alt.filter((x) => x !== k) : [...alt, k]));
  }

  async function absenden() {
    const fehlt =
      vorne.length === 0
        ? "Bitte fotografiere die Vorderseite."
        : hinten.length === 0
          ? "Bitte fotografiere die Rückseite."
          : klassen.length === 0
            ? "Bitte wähle deine Führerscheinklassen."
            : !gueltigBis
              ? "Bitte trage ein, bis wann deine Fahrerlaubnis gilt."
              : null;
    if (fehlt) {
      setFehler(fehlt);
      return;
    }
    setSendet(true);
    setFehler(null);
    const erg = await fuehrerscheinEinreichen({
      pruefungId,
      firmaId,
      fotoVorne: vorne[0],
      fotoHinten: hinten[0],
      klassen,
      gueltigBis,
      code95Bis,
    });
    setSendet(false);
    if (erg.ok) setFertig(true);
    else setFehler(erg.fehler);
  }

  if (fertig) {
    return (
      <Karte titel="Eingereicht">
        <p>Danke! Dein Verkehrsleiter prüft jetzt die Fotos. Den Stand siehst du auf deiner Startseite.</p>
      </Karte>
    );
  }

  if (!offen) {
    return (
      <button
        type="button"
        onClick={() => setOffen(true)}
        className="h-12 rounded-xl border-2 border-marke-blau px-4 font-semibold text-marke-blau"
      >
        Neue Fotos einreichen
      </button>
    );
  }

  return (
    <Karte titel="Führerschein einreichen">
      <p className="text-sm text-gray-600">Lege den Führerschein auf einen hellen Tisch und fotografiere ihn gerade von oben, ohne Spiegelung.</p>

      <div className="flex flex-col gap-2">
        <h3 className="font-semibold">1. Vorderseite</h3>
        <FotoAufnahme
          bucket="fuehrerscheine"
          ordner={ordner}
          praefix="vorne"
          pfade={vorne}
          onFoto={(d) => {
            dateien.current.vorne = d;
          }}
          onChange={(p) => {
            setVorne(p);
            void auslesen(p, hinten);
          }}
          mehrere={false}
          pflicht
          beschriftung={vorne.length ? "Neu fotografieren" : "Vorderseite fotografieren"}
        />
      </div>

      <div className="flex flex-col gap-2">
        <h3 className="font-semibold">2. Rückseite</h3>
        <FotoAufnahme
          bucket="fuehrerscheine"
          ordner={ordner}
          praefix="hinten"
          pfade={hinten}
          onFoto={(d) => {
            dateien.current.hinten = d;
          }}
          onChange={(p) => {
            setHinten(p);
            void auslesen(vorne, p);
          }}
          mehrere={false}
          pflicht
          beschriftung={hinten.length ? "Neu fotografieren" : "Rückseite fotografieren"}
        />
      </div>

      {vorlage && (
        <p className="rounded-xl bg-grund p-3 text-sm">
          Klassen und Daten sind von deiner letzten Prüfung übernommen. Ändere sie nur, wenn sich etwas geändert hat.
        </p>
      )}
      {liest && <p className="rounded-xl bg-grund p-3 text-sm font-semibold">Ich lese deinen Führerschein … das dauert ein paar Sekunden.</p>}
      {lesen?.art === "gelesen" && !liest && (
        <p className="rounded-xl bg-marke-gelb/30 p-3 text-sm font-semibold">
          Klassen und Daten wurden aus den Fotos gelesen. Bitte vergleiche sie kurz mit deinem Führerschein und korrigiere, wenn etwas nicht stimmt.
        </p>
      )}
      {lesen?.art === "leer" && !liest && (
        <p className="rounded-xl bg-grund p-3 text-sm">
          Auf den Fotos konnte ich keine Klassen und Daten erkennen. Fotografiere die Rückseite am besten noch einmal gerade, nah und ohne Spiegelung, oder trage die Werte selbst ein.
        </p>
      )}
      {lesen?.art === "fehler" && !liest && (
        <p className="rounded-xl bg-grund p-3 text-sm">
          Das automatische Lesen hat auf diesem Handy nicht geklappt. Bitte trage die Werte selbst ein.
          <span className="mt-1 block text-xs text-gray-600">Fehler: {lesen.text}</span>
        </p>
      )}

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 font-semibold">3. Deine Klassen</legend>
        <div className="grid grid-cols-4 gap-2">
          {KLASSEN.map((k) => {
            const an = klassen.includes(k);
            return (
              <button
                key={k}
                type="button"
                aria-pressed={an}
                onClick={() => umschalten(k)}
                className={`h-11 rounded-xl border-2 font-semibold ${an ? "border-marke-blau bg-marke-blau text-white" : "border-gray-300 bg-white"}`}
              >
                {k}
              </button>
            );
          })}
        </div>
      </fieldset>

      <label className="flex flex-col gap-1">
        <span className="font-semibold">4. Gültig bis</span>
        <span className="text-sm text-gray-600">Bei C/CE: Rückseite, Spalte 11. Sonst: Vorderseite, Feld 4b.</span>
        <input
          type="date"
          value={gueltigBis}
          onChange={(e) => setGueltigBis(e.target.value)}
          className="h-11 rounded-xl border border-gray-300 bg-white px-3 text-base"
        />
      </label>

      <label className="flex flex-col gap-1">
        <span className="font-semibold">5. Code 95 gültig bis (falls vorhanden)</span>
        <span className="text-sm text-gray-600">Rückseite, Spalte 12, Schlüsselzahl 95 mit Datum.</span>
        <input
          type="date"
          value={code95Bis}
          onChange={(e) => setCode95Bis(e.target.value)}
          className="h-11 rounded-xl border border-gray-300 bg-white px-3 text-base"
        />
      </label>

      {fehler && <p className="font-semibold text-mangel">{fehler}</p>}

      <button
        type="button"
        onClick={absenden}
        disabled={sendet}
        className="h-14 rounded-xl bg-marke-gelb text-lg font-semibold text-marke-blau disabled:opacity-60"
      >
        {sendet ? "Wird gesendet …" : "Zur Prüfung senden"}
      </button>
    </Karte>
  );
}
