import Link from "next/link";
import { notFound } from "next/navigation";
import { Kopfleiste } from "@/components/Kopfleiste";
import { Karte, Knopf } from "@/components/ui";
import { holeNutzer, istVerwalter } from "@/lib/daten";
import { EIGENE_KATEGORIEN, kategorie } from "@/lib/kontrolle/kategorien";
import { fahrzeugZuordnen, gruppeAnlegen, pruefpunktAnlegen, pruefpunktLoeschen, pruefpunktSchalten } from "./actions";

type Punkt = {
  id: string;
  fahrzeugart_id: string;
  abschnitt: string;
  reihenfolge: number;
  frage: string;
  bedingung: string;
  aktiv: boolean;
  pflicht: boolean;
  eigen: boolean;
  foto_bei_mangel: boolean;
  mangel_stoppt: boolean;
};

const HINWEIS: Record<string, string> = {
  "UVV Ladebordwand": "Pflicht bei Fahrzeugen mit Ladebordwand",
  "UVV Elektro-Niederhubwagen": "Pflicht wenn Ameise an Bord",
  "Winterliche Verhältnisse": "saisonal · automatisch aktiv von 01.11. bis 31.03.",
  "Gefahrgut (ADR)": "nur bei ADR-Fahrzeugen",
};

export default async function PruefpunkteSeite({ params, searchParams }: PageProps<"/verwaltung/[firmaId]/pruefpunkte">) {
  const { firmaId } = await params;
  const { gruppe: gruppeParam, gespeichert, fehler } = await searchParams;
  const { supabase, mitgliedschaften } = await holeNutzer();
  const firma = mitgliedschaften.find((m) => m.firma_id === firmaId && istVerwalter(m.rolle));
  if (!firma) notFound();
  const darfAendern = firma.rolle === "verkehrsleiter";

  const [{ data: gruppen }, { data: punkte }, { data: fahrzeuge }] = await Promise.all([
    supabase.from("fahrzeugarten").select("id, name").eq("firma_id", firmaId).order("name").returns<{ id: string; name: string }[]>(),
    supabase
      .from("pruefpunkte")
      .select("id, fahrzeugart_id, abschnitt, reihenfolge, frage, bedingung, aktiv, pflicht, eigen, foto_bei_mangel, mangel_stoppt")
      .eq("firma_id", firmaId)
      .eq("veraltet", false)
      .order("reihenfolge")
      .returns<Punkt[]>(),
    supabase
      .from("fahrzeuge")
      .select("id, kennzeichen, fahrzeugart_id, ladebordwand, ameise")
      .eq("firma_id", firmaId)
      .eq("aktiv", true)
      .eq("ist_anhaenger", false)
      .order("kennzeichen")
      .returns<{ id: string; kennzeichen: string; fahrzeugart_id: string | null; ladebordwand: boolean; ameise: boolean }[]>(),
  ]);
  const liste = gruppen ?? [];
  const standard = liste.find((g) => g.name === "Standard") ?? liste[0];
  const gruppe = liste.find((g) => g.id === gruppeParam) ?? standard;
  if (!gruppe) notFound();

  const gruppeVon = (f: { fahrzeugart_id: string | null }) => f.fahrzeugart_id ?? standard?.id;
  const anzahl = (id: string) => (fahrzeuge ?? []).filter((f) => gruppeVon(f) === id).length;

  const eigene = (punkte ?? []).filter((p) => p.fahrzeugart_id === gruppe.id);
  const abschnitte = new Map<string, Punkt[]>();
  for (const p of eigene) abschnitte.set(p.abschnitt, [...(abschnitte.get(p.abschnitt) ?? []), p]);

  // Vorschau: was ein Fahrer dieser Gruppe heute ungefähr beantwortet (ohne ADR, Anhänger, UVV, Winter).
  const alltag = eigene.filter((p) => p.aktiv && p.bedingung === "immer");
  const pflichtZahl = alltag.filter((p) => p.pflicht).length;
  const zusatzZahl = alltag.length - pflichtZahl;
  const minuten = Math.max(1, Math.round((alltag.length * 15) / 60));

  return (
    <main className="flex flex-1 flex-col">
      <Kopfleiste titel="Prüfpunkte festlegen" untertitel={`${firma.firmen?.name ?? ""} · Abfahrtskontrolle`} zurueck={`/verwaltung/${firmaId}`} />
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-5 p-5">
        {gespeichert && (
          <p role="status" className="rounded-xl border-2 border-ok bg-white p-3 font-semibold text-ok">
            Gespeichert.
          </p>
        )}
        {typeof fehler === "string" && (
          <p role="alert" className="rounded-xl border-2 border-mangel bg-white p-3 font-semibold text-mangel">
            {fehler}
          </p>
        )}

        <nav className="flex flex-wrap items-center gap-2" aria-label="Fahrzeuggruppe">
          <span className="text-sm text-gray-600">Gilt für:</span>
          {liste.map((g) => (
            <Link
              key={g.id}
              href={`/verwaltung/${firmaId}/pruefpunkte?gruppe=${g.id}`}
              aria-current={g.id === gruppe.id ? "page" : undefined}
              className={`flex h-11 items-center rounded-full border-2 px-4 text-sm font-semibold ${g.id === gruppe.id ? "border-marke-blau bg-marke-blau text-white" : "border-gray-300 bg-white"}`}
            >
              {g.name === "Standard" && liste.length === 1 ? "Alle Fahrzeuge" : g.name} ({anzahl(g.id)})
            </Link>
          ))}
          {darfAendern && (
            <details className="relative">
              <summary className="flex h-11 cursor-pointer list-none items-center rounded-full border-2 border-dashed border-gray-400 px-4 text-sm font-semibold">
                + Gruppe
              </summary>
              <form
                action={gruppeAnlegen.bind(null, firmaId, gruppe.id)}
                className="absolute z-10 mt-2 flex w-72 flex-col gap-2 rounded-2xl bg-white p-4 shadow-lg"
              >
                <label className="flex flex-col gap-1 text-sm text-gray-700">
                  Name der Gruppe
                  <input name="name" required minLength={2} maxLength={40} placeholder="z. B. 7,5 t mit Ladebordwand" className="h-11 rounded-xl border border-gray-300 px-3 text-base" />
                </label>
                <p className="text-xs text-gray-600">Die Prüfpunkte von „{gruppe.name}“ werden übernommen.</p>
                <Knopf>Gruppe anlegen</Knopf>
              </form>
            </details>
          )}
        </nav>

        <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
          <div className="flex flex-col gap-4">
            <p className="flex gap-2 rounded-xl bg-marke-blau/10 p-3 text-sm text-marke-blau-dunkel">
              <span aria-hidden>🔒</span>
              <span>
                Pflichtpunkte (BG Verkehr / gesetzlich) sind gesperrt und immer aktiv. Zusatzpunkte kannst du je Fahrzeuggruppe ein- und
                ausschalten. Änderungen gelten sofort für die nächste Kontrolle.
              </span>
            </p>

            {[...abschnitte.entries()].map(([name, ps]) => {
              const pflicht = ps.filter((p) => p.pflicht).length;
              const zusatz = ps.filter((p) => !p.pflicht);
              const hinweis = HINWEIS[name] ?? `${pflicht} Pflicht · ${zusatz.filter((p) => p.aktiv).length} von ${zusatz.length} Zusatz aktiv`;
              return (
                <section key={name} className="overflow-hidden rounded-2xl bg-white shadow-sm">
                  <header
                    className={`flex flex-wrap items-baseline justify-between gap-2 border-b border-gray-200 px-5 py-3 ${kategorie(name).uvv ? "bg-marke-gelb/20" : ""}`}
                  >
                    <h2 className="font-titel text-lg font-semibold">{name}</h2>
                    <span className="text-sm text-gray-600">{hinweis}</span>
                  </header>
                  <ul className="divide-y divide-gray-100">
                    {ps.map((p) => (
                      <li key={p.id} className="flex min-h-12 items-center justify-between gap-3 px-5 py-2">
                        <span className="flex flex-col">
                          <span className={p.aktiv ? "" : "text-gray-500"}>{p.frage}</span>
                          {(p.eigen || p.mangel_stoppt) && (
                            <span className="text-xs text-gray-600">
                              {[p.eigen && "eigener Punkt", p.mangel_stoppt && "Mangel stoppt die Abfahrt", p.eigen && p.foto_bei_mangel && "Foto bei Mangel"]
                                .filter(Boolean)
                                .join(" · ")}
                            </span>
                          )}
                        </span>
                        {p.pflicht ? (
                          <span className="shrink-0 rounded-md bg-marke-blau/10 px-2 py-0.5 text-xs font-semibold text-marke-blau">🔒 Pflicht</span>
                        ) : (
                          <span className="flex shrink-0 items-center gap-1">
                            {p.eigen && darfAendern && (
                              <form action={pruefpunktLoeschen.bind(null, firmaId, gruppe.id, p.id)}>
                                <button type="submit" className="h-11 px-2 text-sm text-mangel underline">
                                  Löschen
                                </button>
                              </form>
                            )}
                            <form action={pruefpunktSchalten.bind(null, firmaId, gruppe.id, p.id, !p.aktiv)}>
                              <button
                                type="submit"
                                role="switch"
                                aria-checked={p.aktiv}
                                aria-label={`${p.frage} ${p.aktiv ? "ausschalten" : "einschalten"}`}
                                disabled={!darfAendern}
                                className="flex h-11 items-center disabled:opacity-60"
                              >
                                <span className={`flex h-7 w-12 items-center rounded-full p-1 ${p.aktiv ? "justify-end bg-ok" : "justify-start bg-gray-300"}`}>
                                  <span className="h-5 w-5 rounded-full bg-white shadow" />
                                </span>
                              </button>
                            </form>
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>
                </section>
              );
            })}
          </div>

          <aside className="flex flex-col gap-4">
            <Karte titel="Vorschau Fahrer-App">
              <div className="grid grid-cols-2 gap-2">
                <div className="flex flex-col rounded-xl bg-marke-blau/10 p-3">
                  <span className="font-titel text-3xl font-semibold text-marke-blau">{pflichtZahl}</span>
                  <span className="text-sm">Pflichtpunkte</span>
                </div>
                <div className="flex flex-col rounded-xl bg-marke-gelb/40 p-3">
                  <span className="font-titel text-3xl font-semibold text-marke-blau">{zusatzZahl}</span>
                  <span className="text-sm">Zusatzpunkte</span>
                </div>
              </div>
              <p className="text-sm text-gray-600">
                Geschätzte Dauer: ca. {minuten} Minuten. Dazu kommen je nach Fahrzeug Anhänger, ADR, UVV und im Winter die Winterpunkte.
              </p>
            </Karte>

            {darfAendern && (
              <Karte titel="Eigenen Prüfpunkt hinzufügen">
                <form action={pruefpunktAnlegen.bind(null, firmaId, gruppe.id)} className="flex flex-col gap-3">
                  <label className="flex flex-col gap-1 text-sm text-gray-700">
                    Frage an den Fahrer
                    <input
                      name="frage"
                      required
                      minLength={3}
                      maxLength={200}
                      placeholder="Firmenbeschriftung vollständig und sauber?"
                      className="h-11 rounded-xl border border-gray-300 bg-white px-3 text-base"
                    />
                  </label>
                  <label className="flex flex-col gap-1 text-sm text-gray-700">
                    Kategorie
                    <select name="kategorie" className="h-11 rounded-xl border border-gray-300 bg-white px-3 text-base">
                      {EIGENE_KATEGORIEN.map((k) => (
                        <option key={k}>{k}</option>
                      ))}
                    </select>
                  </label>
                  <label className="flex min-h-11 items-center gap-2">
                    <input type="checkbox" name="foto_bei_mangel" defaultChecked className="h-5 w-5" />
                    Foto bei Mangel verpflichtend
                  </label>
                  <label className="flex min-h-11 items-center gap-2">
                    <input type="checkbox" name="mangel_stoppt" className="h-5 w-5" />
                    Mangel stoppt die Abfahrt
                  </label>
                  <p className="text-xs text-gray-600">Formuliere die Frage so, dass „In Ordnung“ die gute Antwort ist.</p>
                  <button type="submit" className="h-12 rounded-xl border-2 border-marke-blau font-semibold text-marke-blau">
                    Hinzufügen
                  </button>
                </form>
              </Karte>
            )}

            <Karte titel={`Fahrzeuge in „${gruppe.name}“`}>
              {(fahrzeuge ?? []).length === 0 ? (
                <p className="text-sm text-gray-600">Noch keine Fahrzeuge angelegt.</p>
              ) : (
                <ul className="flex flex-col divide-y divide-gray-100">
                  {(fahrzeuge ?? []).map((f) => (
                    <li key={f.id} className="py-2">
                      <form action={fahrzeugZuordnen.bind(null, firmaId, gruppe.id)} className="flex flex-wrap items-center gap-2">
                        <input type="hidden" name="fahrzeug" value={f.id} />
                        <span className={`flex-1 font-semibold ${gruppeVon(f) === gruppe.id ? "" : "text-gray-500"}`}>
                          {f.kennzeichen}
                          {(f.ladebordwand || f.ameise) && (
                            <span className="block text-xs font-normal text-gray-600">
                              {[f.ladebordwand && "Ladebordwand", f.ameise && "Elektro-Ameise"].filter(Boolean).join(" · ")}
                            </span>
                          )}
                        </span>
                        {liste.length > 1 && darfAendern ? (
                          <>
                            <select name="gruppe" defaultValue={gruppeVon(f)} className="h-11 rounded-xl border border-gray-300 bg-white px-2 text-sm">
                              {liste.map((g) => (
                                <option key={g.id} value={g.id}>
                                  {g.name}
                                </option>
                              ))}
                            </select>
                            <button type="submit" className="h-11 rounded-xl border-2 border-marke-blau px-3 text-sm font-semibold text-marke-blau">
                              OK
                            </button>
                          </>
                        ) : (
                          <span className="text-sm text-gray-600">{liste.find((g) => g.id === gruppeVon(f))?.name}</span>
                        )}
                      </form>
                    </li>
                  ))}
                </ul>
              )}
              <p className="text-xs text-gray-600">Ladebordwand und Elektro-Ameise stellt der Fahrer bei der Kontrolle ein.</p>
            </Karte>

            <Karte titel="Benachrichtigung bei Mangel">
              <p className="text-sm text-gray-700">
                Bei jedem Mangel geht sofort eine E-Mail mit Foto und PDF-Bericht an den Verkehrsleiter. Sagt der Fahrer „Nein – Stopp“, steht
                im Betreff „STOPP“.
              </p>
            </Karte>
          </aside>
        </div>
      </div>
    </main>
  );
}
