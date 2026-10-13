import { notFound } from "next/navigation";
import { Seitenkopf } from "@/components/verwaltung/Seitenkopf";
import { FristZelle } from "@/components/verwaltung/FristZelle";
import { Karte, Knopf } from "@/components/ui";
import { holeNutzer, istVerwalter, jetzt } from "@/lib/daten";
import { ART_INFO, datumVon, geltendeArten, standardRegel, stufe, type Art, type FristFahrzeug } from "@/lib/fahrzeugfristen";
import { tag } from "@/lib/fuehrerschein/regeln";
import { empfaenger } from "@/lib/fristMail";
import { MANGEL_SPALTEN, MangelEintrag, weitergabeLaden, type Mangel } from "@/components/verwaltung/MangelEintrag";
import { Gesendet } from "@/components/verwaltung/Gesendet";
import { fahrzeugSpeichern, mailJetztSenden } from "../actions";

type Fahrzeug = FristFahrzeug & { adr: boolean };
type Beleg = { art: Art; datum: string; foto_pfad: string | null; erfasst_am: string };
type Mail = { art: Art; faellig_am: string; an: string; automatisch: boolean; gesendet_am: string; fehler: string | null };

const zeit = (d: string) => new Date(d).toLocaleString("de-DE", { timeZone: "Europe/Berlin", dateStyle: "short", timeStyle: "short" });

export default async function FahrzeugSeite({ params, searchParams }: PageProps<"/verwaltung/[firmaId]/fahrzeuge/[fahrzeugId]">) {
  const { firmaId, fahrzeugId } = await params;
  const { gespeichert, fehler, gesendet } = await searchParams;
  const { supabase, mitgliedschaften } = await holeNutzer();
  const firma = mitgliedschaften.find((m) => m.firma_id === firmaId && istVerwalter(m.rolle));
  if (!firma) notFound();
  const heute = tag(new Date(jetzt()));

  const [{ data: z }, { data: regeln }, { data: belege }, { data: mails }, { data: maengel }] = await Promise.all([
    supabase.from("fahrzeuge").select("*").eq("id", fahrzeugId).eq("firma_id", firmaId).maybeSingle<Fahrzeug>(),
    supabase.from("frist_regeln").select("art, vorwarnung_tage, mail_an").eq("firma_id", firmaId).returns<{ art: Art; vorwarnung_tage: number; mail_an: string | null }[]>(),
    supabase
      .from("fahrzeug_frist_belege")
      .select("art, datum, foto_pfad, erfasst_am")
      .eq("fahrzeug_id", fahrzeugId)
      .order("erfasst_am", { ascending: false })
      .returns<Beleg[]>(),
    supabase
      .from("frist_mails")
      .select("art, faellig_am, an, automatisch, gesendet_am, fehler")
      .eq("fahrzeug_id", fahrzeugId)
      .order("gesendet_am", { ascending: false })
      .limit(20)
      .returns<Mail[]>(),
    supabase.from("maengel").select(MANGEL_SPALTEN).eq("firma_id", firmaId).eq("fahrzeug_id", fahrzeugId).order("id").limit(100).returns<Mangel[]>(),
  ]);
  if (!z) notFound();
  const regel = (a: Art) => regeln?.find((r) => r.art === a);
  const mListe = (maengel ?? []).sort((a, b) => (b.kontrolle?.durchgefuehrt_am ?? "").localeCompare(a.kontrolle?.durchgefuehrt_am ?? ""));
  const mOffen = mListe.filter((m) => m.status === "offen");
  const mErledigt = mListe.filter((m) => m.status === "behoben").slice(0, 10);
  const zurueck = `/verwaltung/${firmaId}/fahrzeuge/${fahrzeugId}`;
  const weitergabe = await weitergabeLaden(supabase, firmaId, firma.firmen?.name ?? "", [...mOffen, ...mErledigt].map((m) => m.id));
  const arten = geltendeArten(z);

  // Neuestes Foto je Prüfart als kurzlebiger Link.
  const fotos: Partial<Record<Art, { url: string; am: string }>> = {};
  for (const a of arten) {
    const b = (belege ?? []).find((x) => x.art === a && x.foto_pfad);
    if (!b?.foto_pfad) continue;
    const { data } = await supabase.storage.from("fahrzeugfristen").createSignedUrl(b.foto_pfad, 600);
    if (data) fotos[a] = { url: data.signedUrl, am: b.erfasst_am };
  }

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-5 p-4 sm:p-6">
      <Seitenkopf pfad={[{ titel: "Fahrzeuge", href: `/verwaltung/${firmaId}/fahrzeuge` }, { titel: z.kennzeichen }]} titel={z.kennzeichen} />
      {gespeichert && (
        <p role="status" className="rounded-xl border-2 border-ok bg-white p-3 font-semibold text-ok">
          {gespeichert === "mail" ? "Mail gesendet." : "Gespeichert."}
        </p>
      )}
      {typeof gesendet === "string" && <Gesendet art={gesendet} />}
      {typeof fehler === "string" && (
        <p role="alert" className="rounded-xl border-2 border-mangel bg-white p-3 font-semibold text-mangel">
          {fehler}
        </p>
      )}

      <Karte titel={mOffen.length > 0 ? `Mängel (${mOffen.length} offen)` : "Mängel"}>
        {mOffen.length === 0 && <p className="text-gray-600">Keine offenen Mängel.</p>}
        {mOffen.length > 0 && (
          <ul className="divide-y divide-gray-200">
            {mOffen.map((m) => (
              <MangelEintrag key={m.id} m={m} firmaId={firmaId} zurueck={zurueck} mitKennzeichen={false} weitergabe={weitergabe} />
            ))}
          </ul>
        )}
        {mErledigt.length > 0 && (
          <details className="rounded-xl bg-grund p-3">
            <summary className="min-h-11 cursor-pointer content-center font-semibold">Erledigte Mängel ({mErledigt.length})</summary>
            <ul className="divide-y divide-gray-200">
              {mErledigt.map((m) => (
                <MangelEintrag key={m.id} m={m} firmaId={firmaId} zurueck={zurueck} mitKennzeichen={false} weitergabe={weitergabe} />
              ))}
            </ul>
          </details>
        )}
      </Karte>

      <div className="grid gap-5 lg:grid-cols-[1fr_20rem]">
        <Karte titel="Prüftermine">
          <form action={fahrzeugSpeichern.bind(null, firmaId, fahrzeugId)} className="flex flex-col gap-4">
            <ul className="flex flex-col divide-y divide-gray-200">
              {arten.map((a) => {
                const d = datumVon(z, a);
                const foto = fotos[a];
                return (
                  <li key={a} className="flex flex-wrap items-end gap-3 py-3">
                    <label className="flex min-w-48 flex-1 flex-col gap-1 text-sm text-gray-700">
                      <span className="flex items-center gap-2">
                        <span className="font-semibold text-marke-blau-dunkel">{ART_INFO[a].titel}</span>
                        <FristZelle datum={d} stufe={stufe(d, heute, regel(a)?.vorwarnung_tage ?? standardRegel(a).vorwarnung_tage)} />
                      </span>
                      <input
                        type="date"
                        name={`frist_${a}`}
                        defaultValue={d ?? ""}
                        className="h-11 rounded-xl border border-gray-300 bg-white px-3 text-base text-marke-blau-dunkel"
                      />
                    </label>
                    {foto && (
                      <a href={foto.url} target="_blank" rel="noreferrer" className="flex min-h-11 items-center gap-2 text-sm font-semibold text-marke-blau underline">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={foto.url} alt={`Foto ${ART_INFO[a].titel}`} className="h-11 w-11 rounded-lg object-cover" />
                        Foto vom {zeit(foto.am)}
                      </a>
                    )}
                  </li>
                );
              })}
            </ul>
            <fieldset className="grid gap-1 border-t border-gray-200 pt-3 sm:grid-cols-2">
              <legend className="pb-1 font-semibold">Ausstattung</legend>
              {(
                [
                  ["ist_anhaenger", "Anhänger/Auflieger", z.ist_anhaenger],
                  ["adr", "ADR-Fahrzeug", z.adr],
                  ["ladebordwand", "Ladebordwand / Hubladebühne", z.ladebordwand],
                  ["ameise", "Ameise / Stapler an Bord", z.ameise],
                ] as const
              ).map(([name, text, an]) => (
                <label key={name} className="flex min-h-11 items-center gap-2">
                  <input type="checkbox" name={name} defaultChecked={an} className="h-5 w-5" />
                  {text}
                </label>
              ))}
            </fieldset>
            <div>
              <Knopf>Speichern</Knopf>
            </div>
          </form>
        </Karte>

        <aside className="flex flex-col gap-4">
          <Karte titel="Mail an Werkstatt">
            <p className="text-sm text-gray-600">Sendet sofort die eingestellte Mail für diese Prüfung.</p>
            <ul className="flex flex-col gap-2">
              {arten.map((a) => {
                const an = empfaenger(regel(a)?.mail_an ?? null);
                const d = datumVon(z, a);
                return (
                  <li key={a}>
                    {an.length > 0 && d ? (
                      <form action={mailJetztSenden.bind(null, firmaId, fahrzeugId, a)}>
                        <button type="submit" className="flex min-h-11 w-full items-center justify-between gap-2 rounded-xl border-2 border-marke-blau px-3 text-left text-sm font-semibold text-marke-blau">
                          {ART_INFO[a].kurz}: Mail senden
                          <span className="truncate text-xs font-normal text-gray-600">{an[0]}</span>
                        </button>
                      </form>
                    ) : (
                      <span className="flex min-h-11 items-center text-sm text-gray-500">
                        {ART_INFO[a].kurz}: {d ? "keine Werkstatt-Adresse eingestellt" : "kein Datum"}
                      </span>
                    )}
                  </li>
                );
              })}
            </ul>
          </Karte>
          <Karte titel="Gesendete Mails">
            {mails && mails.length > 0 ? (
              <ul className="flex flex-col gap-2 text-sm">
                {mails.map((m, i) => (
                  <li key={i}>
                    <span className="font-semibold">{ART_INFO[m.art as Art]?.kurz ?? m.art}</span> · {zeit(m.gesendet_am)} · {m.automatisch ? "automatisch" : "von Hand"}
                    <span className={`block ${m.fehler ? "text-mangel" : "text-gray-600"}`}>{m.fehler ? "Fehlgeschlagen" : `an ${m.an}`}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-gray-600">Noch keine.</p>
            )}
          </Karte>
        </aside>
      </div>
    </main>
  );
}
