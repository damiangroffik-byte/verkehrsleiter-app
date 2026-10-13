import { notFound } from "next/navigation";
import { PdfKnopf } from "@/components/PdfKnopf";
import { Seitenkopf } from "@/components/verwaltung/Seitenkopf";
import { Karte } from "@/components/ui";
import { holeNutzer, istVerwalter } from "@/lib/daten";

type Mangel = {
  id: string;
  status: "offen" | "behoben";
  behoben_am: string | null;
  vermerk: string | null;
  antwort: { abschnitt: string; frage: string; bemerkung: string | null } | null;
  kontrolle: { id: string; durchgefuehrt_am: string; abfahrt_freigegeben: boolean; fahrer: { vorname: string; nachname: string } | null } | null;
  fahrzeug: { kennzeichen: string } | null;
};

const zeit = (d: string) => new Date(d).toLocaleString("de-DE", { timeZone: "Europe/Berlin", dateStyle: "short", timeStyle: "short" });

function Eintrag({ m }: { m: Mangel }) {
  return (
    <li className="flex flex-wrap items-start justify-between gap-3 py-3">
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="font-semibold">
          {m.fahrzeug?.kennzeichen} · {m.antwort?.frage}
        </span>
        <span className="text-sm text-gray-600">
          {m.antwort?.abschnitt} · {m.kontrolle ? zeit(m.kontrolle.durchgefuehrt_am) : ""} Uhr
          {m.kontrolle?.fahrer ? ` · ${m.kontrolle.fahrer.vorname} ${m.kontrolle.fahrer.nachname}` : ""}
        </span>
        {m.antwort?.bemerkung && <span className="text-sm">„{m.antwort.bemerkung}“</span>}
        {m.status === "offen" && m.kontrolle && !m.kontrolle.abfahrt_freigegeben && (
          <span className="text-sm font-semibold text-mangel">Fahrt gestoppt</span>
        )}
        {m.status === "behoben" && (
          <span className="text-sm text-ok">
            Behoben {m.behoben_am ? `am ${new Date(m.behoben_am).toLocaleDateString("de-DE")}` : ""}
            {m.vermerk ? `: ${m.vermerk}` : ""}
          </span>
        )}
      </span>
      {m.kontrolle && (
        <PdfKnopf href={`/kontrolle/${m.kontrolle.id}/pdf`} className="flex h-11 items-center rounded-xl border-2 border-marke-blau px-4 font-semibold text-marke-blau">
          Bericht
        </PdfKnopf>
      )}
    </li>
  );
}

export default async function MaengelSeite({ params }: PageProps<"/verwaltung/[firmaId]/maengel">) {
  const { firmaId } = await params;
  const { supabase, mitgliedschaften } = await holeNutzer();
  const firma = mitgliedschaften.find((m) => m.firma_id === firmaId && istVerwalter(m.rolle));
  if (!firma) notFound();

  const { data } = await supabase
    .from("maengel")
    .select(
      "id, status, behoben_am, vermerk, antwort:antworten(abschnitt, frage, bemerkung), kontrolle:kontrollen(id, durchgefuehrt_am, abfahrt_freigegeben, fahrer(vorname, nachname)), fahrzeug:fahrzeuge(kennzeichen)",
    )
    .eq("firma_id", firmaId)
    .order("id")
    .limit(200)
    .returns<Mangel[]>();
  const alle = (data ?? []).sort((a, b) => (b.kontrolle?.durchgefuehrt_am ?? "").localeCompare(a.kontrolle?.durchgefuehrt_am ?? ""));
  const offen = alle.filter((m) => m.status === "offen");
  const behoben = alle.filter((m) => m.status === "behoben").slice(0, 20);

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-5 p-4 sm:p-6">
      <Seitenkopf titel="Mängelmeldungen" untertitel={offen.length === 0 ? "Keine offenen Mängel" : `${offen.length} offen`} />
      <Karte titel="Offen">
        {offen.length > 0 ? <ul className="divide-y divide-gray-200">{offen.map((m) => <Eintrag key={m.id} m={m} />)}</ul> : <p className="text-gray-600">Alles in Ordnung.</p>}
      </Karte>
      {behoben.length > 0 && (
        <Karte titel="Zuletzt behoben">
          <ul className="divide-y divide-gray-200">
            {behoben.map((m) => (
              <Eintrag key={m.id} m={m} />
            ))}
          </ul>
        </Karte>
      )}
    </main>
  );
}
