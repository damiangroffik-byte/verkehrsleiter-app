import Link from "next/link";
import { notFound } from "next/navigation";
import { Seitenkopf } from "@/components/verwaltung/Seitenkopf";
import { StatusZeile } from "@/components/StatusZeile";
import { Feld, Frist, Karte, Knopf } from "@/components/ui";
import { holeNutzer, istVerwalter, jetzt } from "@/lib/daten";
import { fuehrerscheinStatus, tag, type Pruefung } from "@/lib/fuehrerschein/regeln";
import { tageBisGeburtstag, wirdAlt } from "@/lib/geburtstag";
import { blockAktiv, type Auswahl, type Unterweisung } from "@/lib/unterweisung/regeln";
import { fahrerSpeichern, fahrerUnterweisungSchalten } from "./actions";

type Fahrer = {
  id: string;
  vorname: string;
  nachname: string;
  email: string | null;
  telefon: string | null;
  user_id: string | null;
  geburtsdatum: string | null;
  fqn_gueltig_bis: string | null;
  adr_gueltig_bis: string | null;
  fahrerkarte_gueltig_bis: string | null;
};
type FsPruefung = Pruefung & { id: string; klassen: string[] };

export default async function FahrerSeite({ params, searchParams }: PageProps<"/verwaltung/[firmaId]/fahrer/[fahrerId]">) {
  const { firmaId, fahrerId } = await params;
  const { gespeichert, fehler } = await searchParams;
  const { supabase, mitgliedschaften } = await holeNutzer();
  const firma = mitgliedschaften.find((m) => m.firma_id === firmaId && istVerwalter(m.rolle));
  if (!firma) notFound();
  const heute = jetzt();

  const [{ data: f }, { data: pruefungen }, { data: einstellung }, { data: bloecke }, { data: auswahl }, { data: zuordnung }] = await Promise.all([
    supabase
      .from("fahrer")
      .select("id, vorname, nachname, email, telefon, user_id, geburtsdatum, fqn_gueltig_bis, adr_gueltig_bis, fahrerkarte_gueltig_bis")
      .eq("id", fahrerId)
      .eq("firma_id", firmaId)
      .maybeSingle<Fahrer>(),
    supabase
      .from("fuehrerschein_pruefungen")
      .select("id, status, eingereicht_am, geprueft_am, gueltig_bis, code95_bis, vermerk, klassen")
      .eq("fahrer_id", fahrerId)
      .order("eingereicht_am", { ascending: false })
      .returns<FsPruefung[]>(),
    supabase.from("firma_einstellungen").select("fuehrerschein_intervall_monate, fuehrerschein_vorwarnung_tage").eq("firma_id", firmaId).maybeSingle(),
    supabase.from("unterweisungen").select("schluessel, titel, kurz, symbol, dauer_min").order("reihenfolge").returns<Unterweisung[]>(),
    supabase.from("firma_unterweisungen").select("unterweisung, aktiv").eq("firma_id", firmaId).returns<Auswahl[]>(),
    supabase.from("fahrer_unterweisungen").select("unterweisung, aktiv").eq("fahrer_id", fahrerId).returns<Auswahl[]>(),
  ]);
  if (!f) notFound();

  const status = fuehrerscheinStatus(
    pruefungen ?? [],
    einstellung?.fuehrerschein_intervall_monate ?? 6,
    new Date(heute),
    einstellung?.fuehrerschein_vorwarnung_tage,
  );
  const fs = status.bestaetigt as FsPruefung | null;
  const offen = status.offen as FsPruefung | null;
  const heuteTag = tag(new Date(heute));
  const bisGeburtstag = f.geburtsdatum ? tageBisGeburtstag(f.geburtsdatum, heuteTag) : null;

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-5 p-4 sm:p-6">
      <Seitenkopf pfad={[{ titel: "Fahrer", href: `/verwaltung/${firmaId}/fahrer` }, { titel: `${f.vorname} ${f.nachname}` }]} titel={`${f.vorname} ${f.nachname}`} />
      <div className="flex w-full max-w-xl flex-col gap-5">
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
        {bisGeburtstag !== null && bisGeburtstag <= 5 && f.geburtsdatum && (
          <p className="rounded-xl border-2 border-marke-gelb bg-white p-3 font-semibold">
            {bisGeburtstag === 0 ? "Heute" : bisGeburtstag === 1 ? "Morgen" : `In ${bisGeburtstag} Tagen`} hat {f.vorname} Geburtstag (
            {wirdAlt(f.geburtsdatum, heuteTag)} Jahre).
          </p>
        )}

        <Karte titel="Nachweise und Fristen">
          <dl className="grid grid-cols-[1fr_auto] gap-x-3 gap-y-2">
            <dt className="text-gray-600">Fahrerlaubnis gültig bis</dt>
            <dd className="text-right">
              <Frist datum={fs?.gueltig_bis ?? null} heute={heute} />
            </dd>
            <dt className="text-gray-600">Klassen</dt>
            <dd className="text-right">{fs?.klassen.join(", ") ?? "–"}</dd>
            <dt className="text-gray-600">Code 95 (Führerschein)</dt>
            <dd className="text-right">
              <Frist datum={fs?.code95_bis ?? null} heute={heute} />
            </dd>
            <dt className="text-gray-600">Fahrerqualifikationskarte</dt>
            <dd className="text-right">
              <Frist datum={f.fqn_gueltig_bis} heute={heute} />
            </dd>
            <dt className="text-gray-600">ADR-Schein</dt>
            <dd className="text-right">
              <Frist datum={f.adr_gueltig_bis} heute={heute} />
            </dd>
            <dt className="text-gray-600">Fahrerkarte (Tacho)</dt>
            <dd className="text-right">
              <Frist datum={f.fahrerkarte_gueltig_bis} heute={heute} />
            </dd>
          </dl>
          <p className="text-sm text-gray-600">
            Fahrerlaubnis, Klassen und Code 95 kommen aus der Führerscheinkontrolle. Die anderen Daten trägst du unten ein.
          </p>
        </Karte>

        <Karte titel="Führerscheinkontrolle">
          <StatusZeile stufe={status.stufe} text={status.text} />
          {offen && (
            <Link
              href={`/verwaltung/${firmaId}/fuehrerschein/${offen.id}`}
              className="flex h-12 items-center justify-center rounded-xl bg-marke-gelb font-semibold text-marke-blau"
            >
              Jetzt prüfen
            </Link>
          )}
          {!offen && fs && (
            <Link href={`/verwaltung/${firmaId}/fuehrerschein/${fs.id}`} className="flex h-11 items-center text-marke-blau underline">
              Letzte Prüfung ansehen
            </Link>
          )}
        </Karte>

        <section id="unterweisungen" className="scroll-mt-4">
          <Karte titel="Unterweisungen">
            <p className="text-sm text-gray-600">
              Welche Unterweisungen braucht {f.vorname}? Ausgeschaltete erscheinen nicht in der Fahrer-App. Ohne Änderung gilt der Standard der Firma.
            </p>
            <ul className="flex flex-col divide-y divide-gray-200">
              {(bloecke ?? []).map((b) => {
                const standard = blockAktiv(b.schluessel, auswahl ?? [], []);
                const an = blockAktiv(b.schluessel, auswahl ?? [], zuordnung ?? []);
                return (
                  <li key={b.schluessel} className="flex items-center justify-between gap-3 py-1">
                    <span className="flex flex-col">
                      <span className="font-semibold">{b.titel}</span>
                      <span className={`text-sm ${an === standard ? "text-gray-600" : "font-semibold text-marke-blau"}`}>
                        {an === standard ? "wie Standard der Firma" : "nur für diesen Fahrer geändert"}
                      </span>
                    </span>
                    <form action={fahrerUnterweisungSchalten.bind(null, firmaId, fahrerId, b.schluessel, !an, standard)}>
                      <button
                        type="submit"
                        role="switch"
                        aria-checked={an}
                        aria-label={`${b.titel} für ${f.vorname} ${an ? "ausschalten" : "einschalten"}`}
                        className="flex h-11 items-center"
                      >
                        <span className={`flex h-7 w-12 items-center rounded-full p-1 ${an ? "justify-end bg-ok" : "justify-start bg-gray-300"}`}>
                          <span className="h-5 w-5 rounded-full bg-white shadow" />
                        </span>
                      </button>
                    </form>
                  </li>
                );
              })}
            </ul>
          </Karte>
        </section>

        <Karte titel="Angaben">
          <form action={fahrerSpeichern.bind(null, firmaId, fahrerId)} className="flex flex-col gap-3">
            <Feld label="Vorname" name="vorname" defaultValue={f.vorname} required />
            <Feld label="Nachname" name="nachname" defaultValue={f.nachname} required />
            <Feld label="Geburtsdatum" name="geburtsdatum" type="date" defaultValue={f.geburtsdatum ?? ""} />
            <Feld label="Telefon" name="telefon" type="tel" defaultValue={f.telefon ?? ""} />
            <p className="text-sm text-gray-600">
              E-Mail für die Anmeldung: {f.email ?? "keine"} · {f.user_id ? "angemeldet" : "noch nicht angemeldet"}
            </p>
            <Feld label="Fahrerqualifikationskarte gültig bis" name="fqn_gueltig_bis" type="date" defaultValue={f.fqn_gueltig_bis ?? ""} />
            <Feld label="ADR-Schein gültig bis" name="adr_gueltig_bis" type="date" defaultValue={f.adr_gueltig_bis ?? ""} />
            <Feld label="Fahrerkarte gültig bis" name="fahrerkarte_gueltig_bis" type="date" defaultValue={f.fahrerkarte_gueltig_bis ?? ""} />
            <Knopf>Speichern</Knopf>
          </form>
        </Karte>
      </div>
    </main>
  );
}
