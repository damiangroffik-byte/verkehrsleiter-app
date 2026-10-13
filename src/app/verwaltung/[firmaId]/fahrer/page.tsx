import Link from "next/link";
import { notFound } from "next/navigation";
import { StatusZeile } from "@/components/StatusZeile";
import { Seitenkopf } from "@/components/verwaltung/Seitenkopf";
import { Feld, Karte, Knopf } from "@/components/ui";
import { holeNutzer, istVerwalter, jetzt } from "@/lib/daten";
import { datumDe, fuehrerscheinStatus, type Pruefung } from "@/lib/fuehrerschein/regeln";
import { fahrerAnlegen } from "../../actions";

type Fahrer = { id: string; vorname: string; nachname: string; email: string | null; user_id: string | null };
type FsPruefung = Pruefung & { id: string; fahrer_id: string };

export default async function FahrerListe({ params }: PageProps<"/verwaltung/[firmaId]/fahrer">) {
  const { firmaId } = await params;
  const { supabase, mitgliedschaften } = await holeNutzer();
  const firma = mitgliedschaften.find((m) => m.firma_id === firmaId && istVerwalter(m.rolle));
  if (!firma) notFound();
  const heute = jetzt();

  const [{ data: fahrer }, { data: pruefungen }, { data: einstellung }] = await Promise.all([
    supabase.from("fahrer").select("id, vorname, nachname, email, user_id").eq("firma_id", firmaId).order("nachname").returns<Fahrer[]>(),
    supabase
      .from("fuehrerschein_pruefungen")
      .select("id, fahrer_id, status, eingereicht_am, geprueft_am, gueltig_bis, code95_bis, vermerk")
      .eq("firma_id", firmaId)
      .order("eingereicht_am", { ascending: false })
      .returns<FsPruefung[]>(),
    supabase.from("firma_einstellungen").select("fuehrerschein_intervall_monate, fuehrerschein_vorwarnung_tage").eq("firma_id", firmaId).maybeSingle(),
  ]);
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
