import Link from "next/link";
import { notFound } from "next/navigation";
import { PdfKnopf } from "@/components/PdfKnopf";
import { Seitenkopf } from "@/components/verwaltung/Seitenkopf";
import { Karte } from "@/components/ui";
import { holeNutzer, istVerwalter, jetzt } from "@/lib/daten";
import { tag } from "@/lib/fuehrerschein/regeln";
import { fristenListe, type FristFahrer, type FristFahrzeug } from "@/lib/fristen";
import { tageBisGeburtstag, wirdAlt } from "@/lib/geburtstag";

type Fahrer = FristFahrer & { geburtsdatum: string | null };
type Kontrolle = {
  id: string;
  durchgefuehrt_am: string;
  hat_mangel: boolean;
  abfahrt_freigegeben: boolean;
  fahrer: { vorname: string; nachname: string } | null;
  fahrzeug: { kennzeichen: string } | null;
};

function Kachel({ href, zahl, titel, warnung }: { href: string; zahl: number; titel: string; warnung: boolean }) {
  return (
    <Link href={href} className={`flex flex-col gap-1 rounded-2xl p-4 shadow-sm ${warnung ? "bg-marke-gelb/50" : "bg-white"}`}>
      <span className={`font-titel text-3xl font-extrabold ${warnung ? "text-marke-blau" : "text-marke-blau-dunkel"}`}>{zahl}</span>
      <span className="text-sm font-semibold">{titel}</span>
    </Link>
  );
}

export default async function Uebersicht({ params }: PageProps<"/verwaltung/[firmaId]">) {
  const { firmaId } = await params;
  const { supabase, mitgliedschaften } = await holeNutzer();
  const firma = mitgliedschaften.find((m) => m.firma_id === firmaId && istVerwalter(m.rolle));
  if (!firma) notFound();
  const heuteTag = tag(new Date(jetzt()));
  const b = `/verwaltung/${firmaId}`;

  const seit = new Date(jetzt() - 36 * 3_600_000).toISOString();
  const [{ data: fahrer }, { data: fahrzeuge }, { count: maengel }, { count: fsOffen }, { data: kontrollen }, { data: juengste }, { data: einstellung }] = await Promise.all([
    supabase
      .from("fahrer")
      .select("id, vorname, nachname, geburtsdatum, fqn_gueltig_bis, adr_gueltig_bis, fahrerkarte_gueltig_bis")
      .eq("firma_id", firmaId)
      .eq("aktiv", true)
      .returns<Fahrer[]>(),
    supabase
      .from("fahrzeuge")
      .select("id, kennzeichen, hu_faellig, sp_faellig, tacho_faellig, feuerloescher_bis, ladebordwand_uvv_bis, ameise_uvv_bis")
      .eq("firma_id", firmaId)
      .eq("aktiv", true)
      .returns<FristFahrzeug[]>(),
    supabase.from("maengel").select("id", { count: "exact", head: true }).eq("firma_id", firmaId).eq("status", "offen"),
    supabase.from("fuehrerschein_pruefungen").select("id", { count: "exact", head: true }).eq("firma_id", firmaId).eq("status", "eingereicht"),
    supabase
      .from("kontrollen")
      .select("id, durchgefuehrt_am, hat_mangel, abfahrt_freigegeben, fahrer(vorname, nachname), fahrzeug:fahrzeuge!kontrollen_fahrzeug_id_fkey(kennzeichen)")
      .eq("firma_id", firmaId)
      .order("durchgefuehrt_am", { ascending: false })
      .limit(5)
      .returns<Kontrolle[]>(),
    supabase.from("kontrollen").select("durchgefuehrt_am").eq("firma_id", firmaId).gte("durchgefuehrt_am", seit).returns<{ durchgefuehrt_am: string }[]>(),
    supabase.from("firma_einstellungen").select("geburtstag_aktiv, geburtstag_vorlauf_tage").eq("firma_id", firmaId).maybeSingle(),
  ]);
  const heuteKontrollen = (juengste ?? []).filter((k) => tag(new Date(k.durchgefuehrt_am)) === heuteTag).length;
  const fristen = fristenListe(fahrzeuge ?? [], fahrer ?? [], heuteTag).filter((f) => f.tage <= 60);
  const geburtstage = (fahrer ?? [])
    .flatMap((f) => (f.geburtsdatum ? [{ f, tage: tageBisGeburtstag(f.geburtsdatum, heuteTag), alt: wirdAlt(f.geburtsdatum, heuteTag) }] : []))
    // Mit eingeschalteten Geburtstagen so früh wie eingestellt, sonst die letzten 5 Tage vorher.
    .filter((g) => g.tage <= (einstellung?.geburtstag_aktiv ? einstellung.geburtstag_vorlauf_tage : 5))
    .sort((a, b) => a.tage - b.tage);

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-5 p-4 sm:p-6">
      <Seitenkopf titel="Übersicht" untertitel={`${fahrer?.length ?? 0} Fahrer · ${fahrzeuge?.length ?? 0} Fahrzeuge`} />

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4" aria-label="Auf einen Blick">
        <Kachel href={`${b}/maengel`} zahl={maengel ?? 0} titel="Offene Mängel" warnung={(maengel ?? 0) > 0} />
        <Kachel href={`${b}/fristen`} zahl={fristen.length} titel="Fristen in 60 Tagen" warnung={fristen.length > 0} />
        <Kachel href={`${b}/fahrer`} zahl={fsOffen ?? 0} titel="Führerscheine zu prüfen" warnung={(fsOffen ?? 0) > 0} />
        <Kachel href={`${b}/abfahrtskontrolle`} zahl={heuteKontrollen} titel="Kontrollen heute" warnung={false} />
      </section>

      <div className="grid gap-5 lg:grid-cols-[1fr_20rem]">
        <Karte titel="Letzte Abfahrtskontrollen">
          {kontrollen && kontrollen.length > 0 ? (
            <ul className="divide-y divide-gray-200">
              {kontrollen.map((k) => (
                <li key={k.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                  <span className="flex flex-col">
                    <span className="font-semibold">
                      {k.fahrzeug?.kennzeichen} · {k.fahrer ? `${k.fahrer.vorname} ${k.fahrer.nachname}` : ""}
                    </span>
                    <span className="text-sm text-gray-600">
                      {new Date(k.durchgefuehrt_am).toLocaleString("de-DE", { timeZone: "Europe/Berlin", dateStyle: "short", timeStyle: "short" })} Uhr ·{" "}
                      <span className={k.hat_mangel ? "font-semibold text-mangel" : "text-ok"}>
                        {k.hat_mangel ? (k.abfahrt_freigegeben ? "Mangel" : "Mangel · Fahrt gestoppt") : "ohne Mangel"}
                      </span>
                    </span>
                  </span>
                  <PdfKnopf href={`/kontrolle/${k.id}/pdf`} className="flex h-11 items-center rounded-xl border-2 border-marke-blau px-4 font-semibold text-marke-blau">
                    PDF
                  </PdfKnopf>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-gray-600">Noch keine Kontrolle eingereicht.</p>
          )}
          <Link href={`${b}/abfahrtskontrolle`} className="flex min-h-11 items-center font-semibold text-marke-blau underline">
            Alle Kontrollen ansehen
          </Link>
        </Karte>

        <aside className="flex flex-col gap-4">
          {geburtstage.length > 0 && (
            <Karte titel="Geburtstage">
              <ul className="flex flex-col gap-1">
                {geburtstage.map(({ f, tage, alt }) => (
                  <li key={f.id}>
                    <Link href={`${b}/fahrer/${f.id}`} className="flex min-h-11 items-center font-semibold">
                      {tage === 0 ? "Heute" : tage === 1 ? "Morgen" : `In ${tage} Tagen`}: {f.vorname} {f.nachname} wird {alt}
                    </Link>
                  </li>
                ))}
              </ul>
            </Karte>
          )}
          <Karte titel="Schnellzugriff">
            <div className="flex flex-col gap-2">
              <Link href={`${b}/pruefpunkte`} className="flex h-12 items-center justify-center rounded-xl bg-marke-gelb font-semibold text-marke-blau">
                Prüfpunkte festlegen
              </Link>
              <Link href={`${b}/fahrer`} className="flex h-12 items-center justify-center rounded-xl border-2 border-marke-blau font-semibold text-marke-blau">
                Fahrer hinzufügen
              </Link>
              <Link href={`${b}/fahrzeuge`} className="flex h-12 items-center justify-center rounded-xl border-2 border-marke-blau font-semibold text-marke-blau">
                Fahrzeug hinzufügen
              </Link>
            </div>
          </Karte>
        </aside>
      </div>
    </main>
  );
}
