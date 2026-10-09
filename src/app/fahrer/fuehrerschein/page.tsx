import Link from "next/link";
import { Kopfleiste } from "@/components/Kopfleiste";
import { Karte } from "@/components/ui";
import { holeNutzer, jetzt } from "@/lib/daten";
import { datumDe, fuehrerscheinStatus, type Pruefung } from "@/lib/fuehrerschein/regeln";
import { FuehrerscheinFormular } from "./FuehrerscheinFormular";
import { StatusZeile } from "@/components/StatusZeile";

type EigenerFahrer = {
  id: string;
  firma_id: string;
  firmen: { name: string; firma_einstellungen: { fuehrerschein_intervall_monate: number } | null } | null;
};

export default async function FuehrerscheinSeite({ searchParams }: PageProps<"/fahrer/fuehrerschein">) {
  const { firma } = await searchParams;
  const { supabase, user } = await holeNutzer();

  const { data: ich } = await supabase
    .from("fahrer")
    .select("id, firma_id, firmen(name, firma_einstellungen(fuehrerschein_intervall_monate))")
    .eq("user_id", user.id)
    .eq("aktiv", true)
    .returns<EigenerFahrer[]>();
  const fahrerIn = ich ?? [];
  const aktuell = fahrerIn.find((f) => f.firma_id === firma) ?? fahrerIn[0];

  if (!aktuell) {
    return (
      <Rahmen>
        <Karte titel="Keine Firma">
          <p className="text-gray-600">
            Du bist noch bei keiner Firma als Fahrer eingetragen. Bitte wende dich an deinen Verkehrsleiter.
          </p>
        </Karte>
      </Rahmen>
    );
  }

  const { data: pruefungen } = await supabase
    .from("fuehrerschein_pruefungen")
    .select("status, eingereicht_am, geprueft_am, gueltig_bis, code95_bis, vermerk, klassen")
    .eq("fahrer_id", aktuell.id)
    .order("eingereicht_am", { ascending: false })
    .limit(20)
    .returns<(Pruefung & { klassen: string[] })[]>();

  const intervall = aktuell.firmen?.firma_einstellungen?.fuehrerschein_intervall_monate ?? 6;
  const status = fuehrerscheinStatus(pruefungen ?? [], intervall, new Date(jetzt()));
  const letzte = status.offen ?? status.bestaetigt;

  return (
    <Rahmen untertitel={aktuell.firmen?.name}>
      {fahrerIn.length > 1 && (
        <nav className="flex flex-wrap gap-2">
          {fahrerIn.map((f) => (
            <Link
              key={f.firma_id}
              href={`/fahrer/fuehrerschein?firma=${f.firma_id}`}
              className={`flex h-11 items-center rounded-xl px-4 text-sm font-semibold ${f.firma_id === aktuell.firma_id ? "bg-marke-blau text-white" : "bg-white"}`}
            >
              {f.firmen?.name}
            </Link>
          ))}
        </nav>
      )}
      <Karte titel="Stand">
        <StatusZeile stufe={status.stufe} text={status.text} />
        {status.abgelehnt?.vermerk && (
          <p className="text-sm">
            Grund der Ablehnung: <span className="font-semibold">{status.abgelehnt.vermerk}</span>
          </p>
        )}
        {letzte && (
          <p className="text-sm text-gray-600">
            Klassen {(letzte as Pruefung & { klassen: string[] }).klassen.join(", ")} · gültig bis {datumDe(letzte.gueltig_bis)}
            {letzte.code95_bis ? ` · Code 95 bis ${datumDe(letzte.code95_bis)}` : ""}
          </p>
        )}
      </Karte>
      <FuehrerscheinFormular
        key={aktuell.firma_id}
        firmaId={aktuell.firma_id}
        wartet={status.stufe === "wartet"}
        vorlage={
          letzte
            ? { klassen: (letzte as Pruefung & { klassen: string[] }).klassen, gueltigBis: letzte.gueltig_bis, code95Bis: letzte.code95_bis }
            : null
        }
      />
    </Rahmen>
  );
}

function Rahmen({ untertitel, children }: { untertitel?: string; children: React.ReactNode }) {
  return (
    <main className="flex flex-1 flex-col">
      <Kopfleiste titel="Führerschein" untertitel={untertitel} zurueck="/fahrer" />
      <div className="mx-auto flex w-full max-w-md flex-col gap-4 p-5">{children}</div>
    </main>
  );
}
