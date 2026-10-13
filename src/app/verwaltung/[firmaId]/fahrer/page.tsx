import Link from "next/link";
import { notFound } from "next/navigation";
import { StatusZeile } from "@/components/StatusZeile";
import { Seitenkopf } from "@/components/verwaltung/Seitenkopf";
import { Feld, Karte, Knopf } from "@/components/ui";
import { holeNutzer, istVerwalter, jetzt } from "@/lib/daten";
import { datumDe, fuehrerscheinStatus, type Pruefung } from "@/lib/fuehrerschein/regeln";
import { fahrerAnlegen } from "../../actions";
import { nachrichtSenden } from "./actions";

type Fahrer = { id: string; vorname: string; nachname: string; email: string | null; user_id: string | null; aktiv: boolean };
type Gesendet = { id: string; betreff: string; gesendet_am: string; gelesen_am: string | null; fehler: string | null; an: string | null; fahrer: { vorname: string; nachname: string } | null };

const zeit = (d: string) => new Date(d).toLocaleString("de-DE", { timeZone: "Europe/Berlin", dateStyle: "short", timeStyle: "short" });
type FsPruefung = Pruefung & { id: string; fahrer_id: string };

export default async function FahrerListe({ params, searchParams }: PageProps<"/verwaltung/[firmaId]/fahrer">) {
  const { firmaId } = await params;
  const { gesendet, ohne_mail, fehler } = await searchParams;
  const { supabase, mitgliedschaften } = await holeNutzer();
  const firma = mitgliedschaften.find((m) => m.firma_id === firmaId && istVerwalter(m.rolle));
  if (!firma) notFound();
  const heute = jetzt();

  const [{ data: fahrer }, { data: pruefungen }, { data: einstellung }, { data: nachrichten }] = await Promise.all([
    supabase.from("fahrer").select("id, vorname, nachname, email, user_id, aktiv").eq("firma_id", firmaId).order("nachname").returns<Fahrer[]>(),
    supabase
      .from("fuehrerschein_pruefungen")
      .select("id, fahrer_id, status, eingereicht_am, geprueft_am, gueltig_bis, code95_bis, vermerk")
      .eq("firma_id", firmaId)
      .order("eingereicht_am", { ascending: false })
      .returns<FsPruefung[]>(),
    supabase.from("firma_einstellungen").select("fuehrerschein_intervall_monate, fuehrerschein_vorwarnung_tage").eq("firma_id", firmaId).maybeSingle(),
    supabase
      .from("mangel_nachrichten")
      .select("id, betreff, gesendet_am, gelesen_am, fehler, an, fahrer(vorname, nachname)")
      .eq("firma_id", firmaId)
      .neq("art", "werkstatt")
      .order("gesendet_am", { ascending: false })
      .limit(20)
      .returns<Gesendet[]>(),
  ]);
  const aktive = (fahrer ?? []).filter((f) => f.aktiv);
  const intervall = einstellung?.fuehrerschein_intervall_monate ?? 6;
  const reihenfolge = { wartet: 0, rot: 1, orange: 2, ok: 3 };
  const liste = (fahrer ?? [])
    .map((f) => {
      const eigene = (pruefungen ?? []).filter((p) => p.fahrer_id === f.id);
      return {
        f,
        status: fuehrerscheinStatus(eigene, intervall, new Date(heute), einstellung?.fuehrerschein_vorwarnung_tage),
        offenId: eigene.find((p) => p.status === "eingereicht")?.id,
      };
    })
    .sort((a, b) => reihenfolge[a.status.stufe] - reihenfolge[b.status.stufe]);

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-5 p-4 sm:p-6">
      <Seitenkopf titel="Fahrer" untertitel={`${liste.length} Fahrer · Führerscheinkontrolle alle ${intervall} Monate`} />
      <Karte>
        {liste.length > 0 ? (
          <ul className="divide-y divide-gray-200">
            {liste.map(({ f, status, offenId }) => (
              <li key={f.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <Link href={`/verwaltung/${firmaId}/fahrer/${f.id}`} className="flex min-h-11 min-w-0 flex-1 flex-col justify-center">
                  <span className="font-semibold text-marke-blau underline">
                    {f.vorname} {f.nachname}
                  </span>
                  <span className="text-sm text-gray-600">
                    {f.email ?? "keine E-Mail"} · {f.user_id ? "angemeldet" : "noch nicht angemeldet"}
                  </span>
                </Link>
                <span className="flex flex-col text-sm">
                  <StatusZeile stufe={status.stufe} text={status.text} />
                  {status.bestaetigt && (
                    <span className="text-gray-600">
                      Fahrerlaubnis bis {datumDe(status.bestaetigt.gueltig_bis)}
                      {status.bestaetigt.code95_bis ? ` · Code 95 bis ${datumDe(status.bestaetigt.code95_bis)}` : ""}
                    </span>
                  )}
                </span>
                {offenId && (
                  <Link href={`/verwaltung/${firmaId}/fuehrerschein/${offenId}`} className="flex h-11 items-center rounded-xl bg-marke-gelb px-4 font-semibold text-marke-blau">
                    Führerschein prüfen
                  </Link>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-gray-600">Noch keine Fahrer angelegt.</p>
        )}
      </Karte>
      <div id="nachricht" className="scroll-mt-4">
        <Karte titel="Nachricht an Fahrer">
          {typeof gesendet === "string" && (
            <p role="status" className="rounded-xl border-2 border-ok bg-white p-3 font-semibold text-ok">
              {gesendet === "1" ? "Nachricht gesendet." : `Nachricht an ${gesendet} Fahrer gesendet.`}
              {ohne_mail && ohne_mail !== "0" ? ` ${ohne_mail === "1" ? "Ein Fahrer bekommt" : `${ohne_mail} Fahrer bekommen`} sie nur in der App (keine E-Mail-Adresse oder Versand fehlgeschlagen).` : ""}
            </p>
          )}
          {typeof fehler === "string" && (
            <p role="alert" className="rounded-xl border-2 border-mangel bg-white p-3 font-semibold text-mangel">
              {fehler}
            </p>
          )}
          <p className="text-sm text-gray-600">Die Nachricht erscheint oben in der App des Fahrers. Du siehst unten, ob er sie gelesen hat.</p>
          <form action={nachrichtSenden.bind(null, firmaId)} className="flex flex-col gap-3">
            <fieldset className="flex flex-col gap-1">
              <legend className="pb-1 text-sm text-gray-700">An wen?</legend>
              <label className="flex min-h-11 items-center gap-2 font-semibold">
                <input type="checkbox" name="alle" className="h-5 w-5" />
                Alle Fahrer ({aktive.length})
              </label>
              <div className="grid gap-x-4 sm:grid-cols-2 lg:grid-cols-3">
                {aktive.map((f) => (
                  <label key={f.id} className="flex min-h-11 items-center gap-2">
                    <input type="checkbox" name="fahrer" value={f.id} className="h-5 w-5" />
                    {f.vorname} {f.nachname}
                  </label>
                ))}
              </div>
            </fieldset>
            <Feld label="Betreff" name="betreff" maxLength={150} placeholder="z. B. Betriebsversammlung am Freitag" required />
            <label className="flex flex-col gap-1 text-sm text-gray-700">
              Nachricht
              <textarea name="text" rows={6} maxLength={5000} required className="rounded-xl border border-gray-300 bg-white p-3 text-base text-marke-blau-dunkel" />
            </label>
            <label className="flex min-h-11 items-center gap-2">
              <input type="checkbox" name="mail" defaultChecked className="h-5 w-5" />
              Zusätzlich per E-Mail senden
            </label>
            <div>
              <Knopf>Nachricht senden</Knopf>
            </div>
          </form>
          {nachrichten && nachrichten.length > 0 && (
            <details className="rounded-xl bg-grund p-3">
              <summary className="min-h-11 cursor-pointer content-center font-semibold">Gesendete Nachrichten</summary>
              <ul className="divide-y divide-gray-200 text-sm">
                {nachrichten.map((n) => (
                  <li key={n.id} className="flex flex-wrap justify-between gap-2 py-2">
                    <span>
                      <span className="font-semibold">{n.betreff}</span> · {n.fahrer ? `${n.fahrer.vorname} ${n.fahrer.nachname}` : "Fahrer"} · {zeit(n.gesendet_am)} Uhr
                    </span>
                    <span className={n.gelesen_am ? "text-ok" : "text-gray-600"}>
                      {n.gelesen_am ? `gelesen ${zeit(n.gelesen_am)} ✓` : "noch nicht gelesen"}
                      {n.fehler ? " · Mail nicht angekommen" : ""}
                    </span>
                  </li>
                ))}
              </ul>
            </details>
          )}
        </Karte>
      </div>
      <Karte titel="Fahrer hinzufügen">
        <form action={fahrerAnlegen.bind(null, firmaId)} className="grid gap-3 sm:grid-cols-2">
          <Feld label="Vorname" name="vorname" required />
          <Feld label="Nachname" name="nachname" required />
          <Feld label="E-Mail (für die Anmeldung)" name="email" type="email" />
          <Feld label="Telefon" name="telefon" type="tel" />
          <div>
            <Knopf>Fahrer hinzufügen</Knopf>
          </div>
        </form>
      </Karte>
    </main>
  );
}
