import Link from "next/link";
import type { SupabaseClient } from "@supabase/supabase-js";
import { fahrerInformieren, mailAnWerkstatt, mangelStatus } from "@/app/verwaltung/[firmaId]/maengel/actions";
import { PdfKnopf } from "@/components/PdfKnopf";
import { MangelWeitergeben } from "@/components/verwaltung/MangelWeitergeben";
import { terminText, type Werkstatt } from "@/lib/mangelWeitergeben";

export type Mangel = {
  id: string;
  status: "offen" | "behoben";
  behoben_am: string | null;
  vermerk: string | null;
  antwort: { abschnitt: string; frage: string; bemerkung: string | null; foto_pfade: string[] } | null;
  kontrolle: { id: string; durchgefuehrt_am: string; abfahrt_freigegeben: boolean; fahrer: { id: string; vorname: string; nachname: string } | null } | null;
  fahrzeug: { kennzeichen: string } | null;
};

export const MANGEL_SPALTEN =
  "id, status, behoben_am, vermerk, antwort:antworten(abschnitt, frage, bemerkung, foto_pfade), kontrolle:kontrollen(id, durchgefuehrt_am, abfahrt_freigegeben, fahrer(id, vorname, nachname)), fahrzeug:fahrzeuge(kennzeichen)";

export type Nachricht = {
  id: string;
  mangel_id: string;
  art: "werkstatt" | "fahrer";
  werkstatt_id: string | null;
  werkstatt_name: string | null;
  an: string | null;
  termin: string | null;
  gesendet_am: string;
  fehler: string | null;
  gelesen_am: string | null;
  fahrer: { vorname: string; nachname: string } | null;
};

export type Weitergabe = {
  firma: string;
  werkstaetten: Werkstatt[];
  fahrer: { id: string; vorname: string; nachname: string; email: string | null }[];
  nachrichten: Nachricht[];
};

// Werkstätten, Fahrer und bisherige Nachrichten für die angezeigten Mängel.
export async function weitergabeLaden(supabase: SupabaseClient, firmaId: string, firma: string, mangelIds: string[]): Promise<Weitergabe> {
  const [{ data: werkstaetten }, { data: fahrer }, { data: nachrichten }] = await Promise.all([
    supabase.from("werkstaetten").select("id, name, email, adresse, telefon").eq("firma_id", firmaId).order("name").returns<Werkstatt[]>(),
    supabase.from("fahrer").select("id, vorname, nachname, email").eq("firma_id", firmaId).eq("aktiv", true).order("vorname").returns<Weitergabe["fahrer"]>(),
    mangelIds.length > 0
      ? supabase
          .from("mangel_nachrichten")
          .select("id, mangel_id, art, werkstatt_id, werkstatt_name, an, termin, gesendet_am, fehler, gelesen_am, fahrer(vorname, nachname)")
          .eq("firma_id", firmaId)
          .in("mangel_id", mangelIds)
          .order("gesendet_am")
          .returns<Nachricht[]>()
      : Promise.resolve({ data: [] as Nachricht[] }),
  ]);
  return { firma, werkstaetten: werkstaetten ?? [], fahrer: fahrer ?? [], nachrichten: nachrichten ?? [] };
}

const zeit = (d: string) => new Date(d).toLocaleString("de-DE", { timeZone: "Europe/Berlin", dateStyle: "short", timeStyle: "short" });

// Ein Mangel: Antippen öffnet den Kontrollbericht als PDF, darunter Status offen/erledigt.
export function MangelEintrag({
  m,
  firmaId,
  zurueck,
  mitKennzeichen = true,
  weitergabe,
  nummer,
}: {
  m: Mangel;
  firmaId: string;
  zurueck: string;
  mitKennzeichen?: boolean;
  weitergabe?: Weitergabe;
  nummer?: number;
}) {
  const offen = m.status === "offen";
  const nachrichten = (weitergabe?.nachrichten ?? []).filter((n) => n.mangel_id === m.id);
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
    <li className={`flex flex-col gap-3 rounded-2xl border-2 border-l-8 border-gray-200 bg-white p-4 ${offen ? "border-l-mangel" : "border-l-ok"}`}>
      <div className="flex items-start gap-3">
        {nummer !== undefined && (
          <span aria-hidden className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full font-semibold text-white ${offen ? "bg-mangel" : "bg-ok"}`}>
            {nummer}
          </span>
        )}
        {m.kontrolle ? (
          <PdfKnopf href={`/kontrolle/${m.kontrolle.id}/pdf`} className="flex min-h-11 min-w-0 flex-1 items-start">
            {titel}
          </PdfKnopf>
        ) : (
          titel
        )}
      </div>
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
      {nachrichten.length > 0 && (
        <ul className="flex flex-col gap-1 text-sm">
          {nachrichten.map((n) => (
            <li key={n.id} className={n.fehler ? "text-mangel" : "text-gray-700"}>
              {n.art === "werkstatt"
                ? `Mail an ${n.werkstatt_name ?? n.an} am ${zeit(n.gesendet_am)} Uhr`
                : `${n.fahrer ? `${n.fahrer.vorname} ${n.fahrer.nachname}` : "Fahrer"} informiert am ${zeit(n.gesendet_am)} Uhr${n.termin ? `, Termin ${terminText(n.termin)} Uhr` : ""}${n.werkstatt_name ? ` bei ${n.werkstatt_name}` : ""}`}
              {n.fehler ? " · Mail nicht angekommen" : n.art === "fahrer" ? (n.gelesen_am ? " · gelesen ✓" : " · noch nicht gelesen") : ""}
            </li>
          ))}
        </ul>
      )}
      {offen && weitergabe && m.fahrzeug && m.antwort && (
        <div className="flex flex-col gap-2 border-t border-gray-200 pt-3">
          {weitergabe.werkstaetten.length === 0 && (
            <p className="text-sm text-gray-600">
              Tipp: Unter{" "}
              <Link href={`/verwaltung/${firmaId}/einstellungen#werkstaetten`} className="font-semibold text-marke-blau underline">
                Einstellungen › Werkstätten
              </Link>{" "}
              kannst du deine Werkstätten speichern.
            </p>
          )}
          <MangelWeitergeben
            mangel={{
              kennzeichen: m.fahrzeug.kennzeichen,
              frage: m.antwort.frage,
              bemerkung: m.antwort.bemerkung,
              festgestellt: m.kontrolle?.durchgefuehrt_am ?? null,
              melderId: m.kontrolle?.fahrer?.id ?? null,
              fotos: m.antwort.foto_pfade.length,
            }}
            firma={weitergabe.firma}
            werkstaetten={weitergabe.werkstaetten}
            fahrer={weitergabe.fahrer}
            letzteWerkstattId={nachrichten.findLast((n) => n.art === "werkstatt" && n.werkstatt_id)?.werkstatt_id ?? null}
            werkstattAktion={mailAnWerkstatt.bind(null, firmaId, m.id, zurueck)}
            fahrerAktion={fahrerInformieren.bind(null, firmaId, m.id, zurueck)}
          />
        </div>
      )}
      {offen ? (
        <form action={mangelStatus.bind(null, firmaId, m.id, true, zurueck)} className="flex flex-col gap-2 border-t border-gray-200 pt-3">
          <input
            name="vermerk"
            maxLength={500}
            placeholder="Notiz (freiwillig)"
            aria-label="Notiz zum Erledigen"
            className="h-12 w-full rounded-xl border border-gray-300 bg-white px-3 text-base"
          />
          <button type="submit" className="h-12 w-full rounded-xl bg-marke-gelb px-4 font-semibold text-marke-blau">
            Als erledigt markieren
          </button>
        </form>
      ) : (
        <form action={mangelStatus.bind(null, firmaId, m.id, false, zurueck)}>
          <button type="submit" className="h-12 w-full rounded-xl border-2 border-marke-blau px-4 font-semibold text-marke-blau">
            Wieder auf offen setzen
          </button>
        </form>
      )}
    </li>
  );
}
