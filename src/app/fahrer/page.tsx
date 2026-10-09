import Link from "next/link";
import { Kopfleiste } from "@/components/Kopfleiste";
import { Karte } from "@/components/ui";
import { StatusZeile } from "@/components/StatusZeile";
import { holeNutzer, jetzt } from "@/lib/daten";
import { einreichenNoetig, fuehrerscheinStatus, type Pruefung } from "@/lib/fuehrerschein/regeln";

type FahrerDaten = {
  id: string;
  vorname: string;
  firmen: { name: string; firma_einstellungen: { fuehrerschein_intervall_monate: number } | null } | null;
};
type LetzteKontrolle = {
  id: string;
  durchgefuehrt_am: string;
  hat_mangel: boolean;
  fahrzeug: { kennzeichen: string } | null;
};

export default async function FahrerStart() {
  const { supabase, user } = await holeNutzer();
  const [{ data }, { data: kontrollen }] = await Promise.all([
    supabase
      .from("fahrer")
      .select("id, vorname, firmen(name, firma_einstellungen(fuehrerschein_intervall_monate))")
      .eq("user_id", user.id)
      .limit(1)
      .returns<FahrerDaten[]>(),
    // RLS liefert dem Fahrer nur seine eigenen Kontrollen.
    supabase
      .from("kontrollen")
      .select("id, durchgefuehrt_am, hat_mangel, fahrzeug:fahrzeuge!kontrollen_fahrzeug_id_fkey(kennzeichen)")
      .order("durchgefuehrt_am", { ascending: false })
      .limit(5)
      .returns<LetzteKontrolle[]>(),
  ]);
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
  const fs = fuehrerscheinStatus(pruefungen ?? [], ich?.firmen?.firma_einstellungen?.fuehrerschein_intervall_monate ?? 6, new Date(jetzt()));

  return (
    <main className="flex flex-1 flex-col">
      <Kopfleiste titel={`Hallo ${ich?.vorname ?? ""}`.trim()} untertitel={ich?.firmen?.name} />
      <div className="mx-auto flex w-full max-w-md flex-col gap-4 p-5">
        <Link
          href="/fahrer/kontrolle"
          className="flex h-14 items-center justify-center rounded-xl bg-marke-gelb text-lg font-semibold text-marke-blau"
        >
          Abfahrtskontrolle starten
        </Link>
        <Karte titel="Deine letzten Kontrollen">
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
                    <a href={`/kontrolle/${k.id}/pdf`} target="_blank" className="flex min-h-11 items-center text-sm font-semibold text-marke-blau underline">
                      PDF
                    </a>
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
        <Karte titel="Bald verfügbar">
          <p className="text-gray-600">Unterweisungen folgen.</p>
        </Karte>
      </div>
    </main>
  );
}
