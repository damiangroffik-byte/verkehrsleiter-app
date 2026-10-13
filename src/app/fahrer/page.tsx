import Link from "next/link";
import { Kopfleiste } from "@/components/Kopfleiste";
import { PdfKnopf } from "@/components/PdfKnopf";
import { Karte } from "@/components/ui";
import { StatusZeile } from "@/components/StatusZeile";
import { holeNutzer, jetzt } from "@/lib/daten";
import { einreichenNoetig, fuehrerscheinStatus, type Pruefung } from "@/lib/fuehrerschein/regeln";
import { blockStatus } from "@/lib/unterweisung/regeln";
import { unterweisungenLaden } from "./unterweisungen/daten";
import { tag } from "@/lib/fuehrerschein/regeln";
import { grussText, tageBisGeburtstag } from "@/lib/geburtstag";

type FahrerDaten = {
  id: string;
  vorname: string;
  geburtsdatum: string | null;
  firmen: {
    name: string;
    firma_einstellungen: {
      fuehrerschein_intervall_monate: number;
      fuehrerschein_vorwarnung_tage: number;
      geburtstag_aktiv: boolean;
      geburtstag_text: string | null;
    } | null;
  } | null;
};
type LetzteKontrolle = {
  id: string;
  durchgefuehrt_am: string;
  hat_mangel: boolean;
  fahrzeug: { kennzeichen: string } | null;
};

export default async function FahrerStart() {
  const { supabase, user } = await holeNutzer();
  const [{ data }, { data: kontrollen }, unterweisungen] = await Promise.all([
    supabase
      .from("fahrer")
      .select("id, vorname, geburtsdatum, firmen(name, firma_einstellungen(fuehrerschein_intervall_monate, fuehrerschein_vorwarnung_tage, geburtstag_aktiv, geburtstag_text))")
      .eq("user_id", user.id)
      .limit(1)
      .returns<FahrerDaten[]>(),
    // RLS liefert dem Fahrer nur seine eigenen Kontrollen.
    supabase
      .from("kontrollen")
      .select("id, durchgefuehrt_am, hat_mangel, fahrzeug:fahrzeuge!kontrollen_fahrzeug_id_fkey(kennzeichen)")
      .order("durchgefuehrt_am", { ascending: false })
      .limit(1)
      .returns<LetzteKontrolle[]>(),
    unterweisungenLaden(supabase, user.id),
  ]);
  const heuteTag = tag(new Date(jetzt()));
  const ich = data?.[0];
  const { data: pruefungen } = ich
    ? await supabase
        .from("fuehrerschein_pruefungen")
        .select("status, eingereicht_am, geprueft_am, gueltig_bis, code95_bis, vermerk")
        .eq("fahrer_id", ich.id)
        .order("eingereicht_am", { ascending: false })
        .limit(20)
        .returns<Pruefung[]>()
    : { data: null };
  const einstellung = ich?.firmen?.firma_einstellungen;
  const gruss =
    ich?.geburtsdatum && einstellung?.geburtstag_aktiv && tageBisGeburtstag(ich.geburtsdatum, heuteTag) === 0
      ? grussText(einstellung.geburtstag_text, { vorname: ich.vorname, firma: ich.firmen?.name ?? "" })
      : null;
  const uwFaellig = (unterweisungen
    ? unterweisungen.bloecke.filter((b) => blockStatus(unterweisungen.teilnahmen.filter((t) => t.unterweisung === b.schluessel), new Date(jetzt())).faellig).length
    : 0) + (unterweisungen?.infosOffen ? 1 : 0);
  const fs = fuehrerscheinStatus(
    pruefungen ?? [],
    einstellung?.fuehrerschein_intervall_monate ?? 6,
    new Date(jetzt()),
    einstellung?.fuehrerschein_vorwarnung_tage,
  );

  return (
    <main className="flex flex-1 flex-col">
      <Kopfleiste titel={`Hallo ${ich?.vorname ?? ""}`.trim()} untertitel={ich?.firmen?.name} />
      <div className="mx-auto flex w-full max-w-md flex-col gap-4 p-5">
        {gruss && (
          <section className="flex flex-col gap-2 rounded-2xl bg-marke-blau p-5 text-white shadow-sm">
            <p aria-hidden className="text-4xl">
              🎂
            </p>
            <p className="font-titel text-xl font-semibold text-marke-gelb">Alles Gute zum Geburtstag!</p>
            <p className="whitespace-pre-line">{gruss}</p>
          </section>
        )}
        <Link
          href="/fahrer/kontrolle"
          className="flex h-14 items-center justify-center rounded-xl bg-marke-gelb text-lg font-semibold text-marke-blau"
        >
          Abfahrtskontrolle starten
        </Link>
        <Karte titel="Deine letzte Kontrolle">
          {kontrollen && kontrollen.length > 0 ? (
            <ul className="divide-y divide-gray-200">
              {kontrollen.map((k) => (
                <li key={k.id} className="flex items-center justify-between gap-2 py-3">
                  <span>
                    <span className="font-semibold">{k.fahrzeug?.kennzeichen}</span>
                    <span className="block text-sm text-gray-600">
                      {new Date(k.durchgefuehrt_am).toLocaleString("de-DE", {
                        timeZone: "Europe/Berlin",
                        dateStyle: "short",
                        timeStyle: "short",
                      })}{" "}
                      Uhr
                    </span>
                  </span>
                  <span className="flex flex-col items-end gap-1">
                    <span className={`text-sm font-semibold ${k.hat_mangel ? "text-mangel" : "text-ok"}`}>
                      {k.hat_mangel ? "Mangel gemeldet" : "Ohne Mangel"}
                    </span>
                    <PdfKnopf href={`/kontrolle/${k.id}/pdf`} className="flex min-h-11 items-center text-sm font-semibold text-marke-blau underline">
                      PDF
                    </PdfKnopf>
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-gray-600">Noch keine Kontrolle eingereicht.</p>
          )}
        </Karte>
        <Karte titel="Führerschein">
          <StatusZeile stufe={fs.stufe} text={fs.text} />
          <Link
            href="/fahrer/fuehrerschein"
            className={`flex h-12 items-center justify-center rounded-xl font-semibold ${einreichenNoetig(fs) ? "bg-marke-gelb text-marke-blau" : "border-2 border-marke-blau text-marke-blau"}`}
          >
            {einreichenNoetig(fs) ? "Führerschein fotografieren" : "Führerschein ansehen"}
          </Link>
        </Karte>
        {unterweisungen && (
          <Karte titel="Unterweisungen">
            <StatusZeile
              stufe={uwFaellig > 0 ? "rot" : "ok"}
              text={uwFaellig === 0 ? "Alle Unterweisungen erledigt" : uwFaellig === 1 ? "1 Aufgabe ist offen" : `${uwFaellig} Aufgaben sind offen`}
            />
            <Link
              href="/fahrer/unterweisungen"
              className={`flex h-12 items-center justify-center rounded-xl font-semibold ${uwFaellig > 0 ? "bg-marke-gelb text-marke-blau" : "border-2 border-marke-blau text-marke-blau"}`}
            >
              {uwFaellig > 0 ? "Unterweisungen machen" : "Unterweisungen ansehen"}
            </Link>
          </Karte>
        )}
      </div>
    </main>
  );
}
