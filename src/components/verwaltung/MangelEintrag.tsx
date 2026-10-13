import { mangelStatus } from "@/app/verwaltung/[firmaId]/maengel/actions";
import { PdfKnopf } from "@/components/PdfKnopf";

export type Mangel = {
  id: string;
  status: "offen" | "behoben";
  behoben_am: string | null;
  vermerk: string | null;
  antwort: { abschnitt: string; frage: string; bemerkung: string | null } | null;
  kontrolle: { id: string; durchgefuehrt_am: string; abfahrt_freigegeben: boolean; fahrer: { vorname: string; nachname: string } | null } | null;
  fahrzeug: { kennzeichen: string } | null;
};

export const MANGEL_SPALTEN =
  "id, status, behoben_am, vermerk, antwort:antworten(abschnitt, frage, bemerkung), kontrolle:kontrollen(id, durchgefuehrt_am, abfahrt_freigegeben, fahrer(vorname, nachname)), fahrzeug:fahrzeuge(kennzeichen)";

const zeit = (d: string) => new Date(d).toLocaleString("de-DE", { timeZone: "Europe/Berlin", dateStyle: "short", timeStyle: "short" });

// Ein Mangel: Antippen öffnet den Kontrollbericht als PDF, darunter Status offen/erledigt.
export function MangelEintrag({ m, firmaId, zurueck, mitKennzeichen = true }: { m: Mangel; firmaId: string; zurueck: string; mitKennzeichen?: boolean }) {
  const offen = m.status === "offen";
  const titel = (
    <span className="flex flex-col gap-0.5 text-left">
      <span className="font-semibold text-marke-blau-dunkel">
        {mitKennzeichen && m.fahrzeug ? `${m.fahrzeug.kennzeichen} · ` : ""}
        {m.antwort?.frage}
      </span>
      <span className="text-sm font-normal text-gray-600">
        {m.antwort?.abschnitt} · {m.kontrolle ? `${zeit(m.kontrolle.durchgefuehrt_am)} Uhr` : ""}
        {m.kontrolle?.fahrer ? ` · ${m.kontrolle.fahrer.vorname} ${m.kontrolle.fahrer.nachname}` : ""}
      </span>
      {m.antwort?.bemerkung && <span className="text-sm font-normal text-gray-800">„{m.antwort.bemerkung}“</span>}
      {m.kontrolle && <span className="text-sm font-semibold text-marke-blau underline">Bericht als PDF öffnen</span>}
    </span>
  );
  return (
    <li className="flex flex-col gap-3 py-3">
      {m.kontrolle ? (
        <PdfKnopf href={`/kontrolle/${m.kontrolle.id}/pdf`} className="flex min-h-11 w-full items-start">
          {titel}
        </PdfKnopf>
      ) : (
        titel
      )}
      <div className="flex flex-wrap items-center gap-2">
        <span
          className={`rounded-md px-2 py-1 text-sm font-semibold ${offen ? "bg-mangel/10 text-mangel" : "bg-ok/10 text-ok"}`}
        >
          Status: {offen ? "offen" : "erledigt"}
        </span>
        {offen && m.kontrolle && !m.kontrolle.abfahrt_freigegeben && <span className="text-sm font-semibold text-mangel">Fahrt gestoppt</span>}
        {!offen && (
          <span className="text-sm text-gray-600">
            {m.behoben_am ? `am ${new Date(m.behoben_am).toLocaleDateString("de-DE", { timeZone: "Europe/Berlin" })}` : ""}
            {m.vermerk ? ` · ${m.vermerk}` : ""}
          </span>
        )}
      </div>
      {offen ? (
        <form action={mangelStatus.bind(null, firmaId, m.id, true, zurueck)} className="flex flex-wrap gap-2">
          <input
            name="vermerk"
            maxLength={500}
            placeholder="Notiz (freiwillig), z. B. Reifen gewechselt"
            aria-label="Notiz zum Erledigen"
            className="h-11 min-w-0 flex-1 rounded-xl border border-gray-300 bg-white px-3 text-base"
          />
          <button type="submit" className="h-11 rounded-xl bg-marke-gelb px-4 font-semibold text-marke-blau">
            Als erledigt markieren
          </button>
        </form>
      ) : (
        <form action={mangelStatus.bind(null, firmaId, m.id, false, zurueck)}>
          <button type="submit" className="h-11 text-sm font-semibold text-marke-blau underline">
            Wieder auf offen setzen
          </button>
        </form>
      )}
    </li>
  );
}
