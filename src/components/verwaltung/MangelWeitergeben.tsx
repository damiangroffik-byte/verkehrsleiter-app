"use client";

import { useState } from "react";
import { fahrerText, werkstattBetreff, werkstattText, type Werkstatt } from "@/lib/mangelWeitergeben";

type Fahrer = { id: string; vorname: string; nachname: string; email: string | null };

type Props = {
  mangel: { kennzeichen: string; frage: string; bemerkung: string | null; festgestellt: string | null; melderId: string | null; fotos: number };
  firma: string;
  werkstaetten: Werkstatt[];
  fahrer: Fahrer[];
  letzteWerkstattId: string | null;
  werkstattAktion: (formData: FormData) => Promise<void>;
  fahrerAktion: (formData: FormData) => Promise<void>;
};

const feld = "h-11 rounded-xl border border-gray-300 bg-white px-3 text-base text-marke-blau-dunkel";
const textfeld = "rounded-xl border border-gray-300 bg-white p-3 text-base text-marke-blau-dunkel";
const knopf = "h-12 w-full rounded-xl bg-marke-gelb px-5 font-semibold text-marke-blau";
const zusammenfassung = "flex h-12 w-full cursor-pointer list-none items-center justify-center rounded-xl border-2 border-marke-blau px-4 font-semibold text-marke-blau [&::-webkit-details-marker]:hidden group-open:bg-marke-blau group-open:text-white";

// Unter einem offenen Mangel: Werkstatt anschreiben und den Fahrer mit Termin zur Werkstatt schicken.
export function MangelWeitergeben({ mangel, firma, werkstaetten, fahrer, letzteWerkstattId, werkstattAktion, fahrerAktion }: Props) {
  const mitMail = werkstaetten.filter((w) => w.email);
  const [mailWerkstatt, setMailWerkstatt] = useState(mitMail[0]?.id ?? "");

  const startFahrer = fahrer.find((f) => f.id === mangel.melderId)?.id ?? fahrer[0]?.id ?? "";
  const [fahrerId, setFahrerId] = useState(startFahrer);
  const [datum, setDatum] = useState("");
  const [uhrzeit, setUhrzeit] = useState("");
  const [zielWerkstatt, setZielWerkstatt] = useState(letzteWerkstattId && werkstaetten.some((w) => w.id === letzteWerkstattId) ? letzteWerkstattId : (werkstaetten[0]?.id ?? ""));
  const [eigenerText, setEigenerText] = useState<string | null>(null);

  const gewaehlt = fahrer.find((f) => f.id === fahrerId);
  const vorschlag = fahrerText({
    vorname: gewaehlt?.vorname ?? "",
    datum,
    uhrzeit,
    kennzeichen: mangel.kennzeichen,
    frage: mangel.frage,
    werkstatt: werkstaetten.find((w) => w.id === zielWerkstatt) ?? null,
    firma,
  });

  return (
    <div className="flex flex-col gap-2">
      <details className="group">
        <summary className={zusammenfassung}>✉ Mail an Werkstatt</summary>
        <form action={werkstattAktion} className="mt-3 flex flex-col gap-3 rounded-xl bg-grund p-3">
          <label className="flex flex-col gap-1 text-sm text-gray-700">
            Werkstatt
            <select name="werkstatt_id" value={mailWerkstatt} onChange={(e) => setMailWerkstatt(e.target.value)} className={feld}>
              {mitMail.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name} ({w.email})
                </option>
              ))}
              <option value="">Andere E-Mail-Adresse</option>
            </select>
          </label>
          {mailWerkstatt === "" && (
            <label className="flex flex-col gap-1 text-sm text-gray-700">
              E-Mail der Werkstatt
              <input name="email" type="email" required placeholder="werkstatt@beispiel.de" className={feld} />
            </label>
          )}
          <label className="flex flex-col gap-1 text-sm text-gray-700">
            Betreff
            <input name="betreff" defaultValue={werkstattBetreff(mangel)} maxLength={200} required className={feld} />
          </label>
          <label className="flex flex-col gap-1 text-sm text-gray-700">
            Text
            <textarea name="text" rows={10} maxLength={5000} required defaultValue={werkstattText({ ...mangel, firma })} className={textfeld} />
          </label>
          {mangel.fotos > 0 && (
            <label className="flex min-h-11 items-center gap-2 text-base">
              <input type="checkbox" name="fotos" defaultChecked className="h-5 w-5" />
              {mangel.fotos === 1 ? "Foto der Beschädigung anhängen" : `${Math.min(mangel.fotos, 5)} Fotos der Beschädigung anhängen`}
            </label>
          )}
          <p className="text-sm text-gray-600">Der Kontrollbericht hängt als PDF an. Antwortet die Werkstatt, landet die Antwort in deinem E-Mail-Postfach.</p>
          <div>
            <button type="submit" className={knopf}>
              Mail senden
            </button>
          </div>
        </form>
      </details>

      <details className="group">
        <summary className={zusammenfassung}>🚚 Fahrer zur Werkstatt schicken</summary>
        <form action={fahrerAktion} className="mt-3 flex flex-col gap-3 rounded-xl bg-grund p-3">
          <label className="flex flex-col gap-1 text-sm text-gray-700">
            Fahrer
            <select name="fahrer_id" value={fahrerId} onChange={(e) => setFahrerId(e.target.value)} required className={feld}>
              {fahrer.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.vorname} {f.nachname}
                </option>
              ))}
            </select>
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1 text-sm text-gray-700">
              Datum
              <input name="datum" type="date" value={datum} onChange={(e) => setDatum(e.target.value)} className={feld} />
            </label>
            <label className="flex flex-col gap-1 text-sm text-gray-700">
              Uhrzeit
              <input name="uhrzeit" type="time" value={uhrzeit} onChange={(e) => setUhrzeit(e.target.value)} className={feld} />
            </label>
          </div>
          <label className="flex flex-col gap-1 text-sm text-gray-700">
            Werkstatt
            <select name="werkstatt_id" value={zielWerkstatt} onChange={(e) => setZielWerkstatt(e.target.value)} className={feld}>
              {werkstaetten.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name}
                </option>
              ))}
              <option value="">Keine (im Text angeben)</option>
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm text-gray-700">
            Text (kannst du frei ändern)
            <textarea
              name="text"
              rows={10}
              maxLength={5000}
              required
              value={eigenerText ?? vorschlag}
              onChange={(e) => setEigenerText(e.target.value)}
              className={textfeld}
            />
          </label>
          {eigenerText !== null && (
            <button type="button" onClick={() => setEigenerText(null)} className="min-h-11 self-start text-sm font-semibold text-marke-blau underline">
              Text wieder automatisch ausfüllen
            </button>
          )}
          <p className="text-sm text-gray-600">
            {gewaehlt?.email
              ? `${gewaehlt.vorname} bekommt die Nachricht in der App und per E-Mail.`
              : `${gewaehlt?.vorname ?? "Der Fahrer"} hat keine E-Mail-Adresse hinterlegt und bekommt die Nachricht nur in der App.`}
          </p>
          <div>
            <button type="submit" className={knopf}>
              An Fahrer senden
            </button>
          </div>
        </form>
      </details>
    </div>
  );
}
