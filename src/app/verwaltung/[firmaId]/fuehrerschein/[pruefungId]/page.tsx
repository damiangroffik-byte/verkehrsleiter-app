import { notFound } from "next/navigation";
import { Kopfleiste } from "@/components/Kopfleiste";
import { Karte, Knopf } from "@/components/ui";
import { holeNutzer, istVerwalter } from "@/lib/daten";
import { datumDe } from "@/lib/fuehrerschein/regeln";
import { fuehrerscheinAblehnen, fuehrerscheinBestaetigen } from "./actions";

type Pruefung = {
  id: string;
  status: "eingereicht" | "bestaetigt" | "abgelehnt" | "ersetzt";
  eingereicht_am: string;
  geprueft_am: string | null;
  geprueft_von_name: string | null;
  foto_vorne: string;
  foto_hinten: string;
  klassen: string[];
  gueltig_bis: string;
  code95_bis: string | null;
  vermerk: string | null;
  fahrer: { vorname: string; nachname: string } | null;
};

const statusText = { eingereicht: "Wartet auf Prüfung", bestaetigt: "Bestätigt", abgelehnt: "Abgelehnt", ersetzt: "Ersetzt durch neuere Einreichung" };

function zeit(t: string) {
  return new Date(t).toLocaleString("de-DE", { timeZone: "Europe/Berlin", dateStyle: "short", timeStyle: "short" }) + " Uhr";
}

export default async function FuehrerscheinPruefen({ params, searchParams }: PageProps<"/verwaltung/[firmaId]/fuehrerschein/[pruefungId]">) {
  const { firmaId, pruefungId } = await params;
  const { fehler } = await searchParams;
  const { supabase, mitgliedschaften } = await holeNutzer();
  const firma = mitgliedschaften.find((m) => m.firma_id === firmaId && istVerwalter(m.rolle));
  if (!firma) notFound();

  const { data: p } = await supabase
    .from("fuehrerschein_pruefungen")
    .select("id, status, eingereicht_am, geprueft_am, geprueft_von_name, foto_vorne, foto_hinten, klassen, gueltig_bis, code95_bis, vermerk, fahrer(vorname, nachname)")
    .eq("id", pruefungId)
    .eq("firma_id", firmaId)
    .maybeSingle<Pruefung>();
  if (!p) notFound();

  const { data: links } = await supabase.storage.from("fuehrerscheine").createSignedUrls([p.foto_vorne, p.foto_hinten], 3600);
  const fotos = [
    { titel: "Vorderseite", url: links?.[0]?.signedUrl ?? null },
    { titel: "Rückseite", url: links?.[1]?.signedUrl ?? null },
  ];
  const name = p.fahrer ? `${p.fahrer.vorname} ${p.fahrer.nachname}` : "Fahrer";

  return (
    <main className="flex flex-1 flex-col">
      <Kopfleiste titel="Führerschein prüfen" untertitel={name} zurueck={`/verwaltung/${firmaId}`} />
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-5 p-5">
        <Karte titel={statusText[p.status]}>
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1">
            <dt className="text-gray-600">Eingereicht</dt>
            <dd>{zeit(p.eingereicht_am)}</dd>
            <dt className="text-gray-600">Klassen</dt>
            <dd className="font-semibold">{p.klassen.join(", ")}</dd>
            <dt className="text-gray-600">Gültig bis</dt>
            <dd className="font-semibold">{datumDe(p.gueltig_bis)}</dd>
            <dt className="text-gray-600">Code 95 bis</dt>
            <dd>{p.code95_bis ? datumDe(p.code95_bis) : "–"}</dd>
            {p.geprueft_am && (
              <>
                <dt className="text-gray-600">Geprüft</dt>
                <dd>
                  {zeit(p.geprueft_am)} von {p.geprueft_von_name ?? "–"}
                </dd>
              </>
            )}
            {p.vermerk && (
              <>
                <dt className="text-gray-600">Grund</dt>
                <dd>{p.vermerk}</dd>
              </>
            )}
          </dl>
        </Karte>

        <div className="grid gap-4 sm:grid-cols-2">
          {fotos.map(({ titel, url }) => (
            <Karte key={titel} titel={titel}>
              {url ? (
                <a href={url} target="_blank" rel="noreferrer">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={url} alt={`Führerschein ${titel}`} className="w-full rounded-lg" />
                </a>
              ) : (
                <p className="text-gray-600">Foto nicht verfügbar.</p>
              )}
            </Karte>
          ))}
        </div>

        {p.status === "eingereicht" && (
          <Karte titel="Entscheidung">
            <p className="text-sm text-gray-600">
              Prüfe: Name stimmt, Foto passt zum Fahrer, Klassen und Datum wie eingetragen, keine Beschränkungen, die gegen den Einsatz sprechen.
            </p>
            {fehler && <p className="font-semibold text-mangel">{String(fehler)}</p>}
            <form action={fuehrerscheinBestaetigen.bind(null, firmaId, p.id)}>
              <Knopf>Führerschein bestätigen</Knopf>
            </form>
            <form action={fuehrerscheinAblehnen.bind(null, firmaId, p.id)} className="flex flex-col gap-2 border-t border-gray-200 pt-4">
              <label className="flex flex-col gap-1 text-sm text-gray-700">
                Grund für die Ablehnung
                <input name="vermerk" required className="h-11 rounded-xl border border-gray-300 bg-white px-3 text-base" placeholder="z. B. Foto unscharf" />
              </label>
              <button type="submit" className="h-12 rounded-xl border-2 border-mangel px-5 font-semibold text-mangel">
                Ablehnen
              </button>
            </form>
          </Karte>
        )}
      </div>
    </main>
  );
}
