import Link from "next/link";
import { Kopfleiste } from "@/components/Kopfleiste";
import { Karte } from "@/components/ui";
import { holeNutzer, jetzt } from "@/lib/daten";
import { FAHRZEUG_SPALTEN, type Art } from "@/lib/fahrzeugfristen";
import type { NachweisFahrer } from "@/lib/fahrerNachweise";
import { istWinter } from "@/lib/kontrolle/regeln";
import { KontrollAblauf } from "./KontrollAblauf";
import type { KontrollFahrzeug, KontrollPruefpunkt } from "./typen";

type ReifenZuletzt = { fahrzeug_id: string; zuletzt: string };
type EigenerFahrer = NachweisFahrer & {
  id: string;
  firma_id: string;
  vorname: string;
  firmen: { name: string; firma_einstellungen: { fuehrerschein_vorwarnung_tage: number } | null } | null;
};

export default async function KontrolleSeite({ searchParams }: PageProps<"/fahrer/kontrolle">) {
  const { firma } = await searchParams;
  const { supabase, user } = await holeNutzer();

  const { data: ich } = await supabase
    .from("fahrer")
    .select("id, firma_id, vorname, fqn_gueltig_bis, fahrerkarte_gueltig_bis, adr_gueltig_bis, firmen(name, firma_einstellungen(fuehrerschein_vorwarnung_tage))")
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

  const firmaId = aktuell.firma_id;
  const [{ data: fahrzeuge }, { data: arten }, { data: pruefpunkte }, { data: reifen }, { data: regeln }, { data: fsPruefungen }] = await Promise.all([
    supabase
      .from("fahrzeuge")
      .select(`${FAHRZEUG_SPALTEN}, adr, fahrzeugart_id`)
      .eq("firma_id", firmaId)
      .eq("aktiv", true)
      .order("kennzeichen")
      .returns<KontrollFahrzeug[]>(),
    supabase.from("fahrzeugarten").select("id, name").eq("firma_id", firmaId).returns<{ id: string; name: string }[]>(),
    supabase
      .from("pruefpunkte")
      .select("id, fahrzeugart_id, abschnitt, reihenfolge, frage, mangel_bei_ja, bedingung, monatliche_fotos, pflicht, foto_bei_mangel, mangel_stoppt")
      .eq("firma_id", firmaId)
      .eq("aktiv", true)
      .eq("veraltet", false)
      .order("reihenfolge")
      .returns<KontrollPruefpunkt[]>(),
    supabase.rpc("reifenfotos_zuletzt", { f: firmaId }),
    supabase.from("frist_regeln").select("art, vorwarnung_tage").eq("firma_id", firmaId).returns<{ art: Art; vorwarnung_tage: number }[]>(),
    supabase
      .from("fuehrerschein_pruefungen")
      .select("status, code95_bis")
      .eq("fahrer_id", aktuell.id)
      .neq("status", "abgelehnt")
      .order("eingereicht_am", { ascending: false })
      .returns<{ status: string; code95_bis: string | null }[]>(),
  ]);

  const zugmaschinen = (fahrzeuge ?? []).filter((f) => !f.ist_anhaenger);
  const heute = jetzt();
  return (
    <Rahmen untertitel={aktuell.firmen?.name}>
      {fahrerIn.length > 1 && (
        <nav className="flex flex-wrap gap-2">
          {fahrerIn.map((f) => (
            <Link
              key={f.firma_id}
              href={`/fahrer/kontrolle?firma=${f.firma_id}`}
              className={`flex h-11 items-center rounded-xl px-4 text-sm font-semibold ${f.firma_id === firmaId ? "bg-marke-blau text-white" : "bg-white"}`}
            >
              {f.firmen?.name}
            </Link>
          ))}
        </nav>
      )}
      <KontrollAblauf
        key={firmaId}
        firmaId={firmaId}
        vorname={aktuell.vorname}
        fahrzeuge={zugmaschinen}
        anhaenger={(fahrzeuge ?? []).filter((f) => f.ist_anhaenger)}
        pruefpunkte={pruefpunkte ?? []}
        standardArtId={arten?.find((a) => a.name === "Standard")?.id ?? null}
        reifenZuletzt={Object.fromEntries(((reifen ?? []) as ReifenZuletzt[]).map((r) => [r.fahrzeug_id, r.zuletzt]))}
        fahrerId={aktuell.id}
        nachweise={aktuell}
        fuehrerscheinDa={(fsPruefungen ?? []).length > 0}
        code95Bis={(fsPruefungen ?? []).find((p) => p.status === "bestaetigt")?.code95_bis ?? null}
        nachweisVorwarnung={aktuell.firmen?.firma_einstellungen?.fuehrerschein_vorwarnung_tage ?? 30}
        vorwarnung={Object.fromEntries((regeln ?? []).map((r) => [r.art, r.vorwarnung_tage]))}
        heute={heute}
        winter={istWinter(new Date(heute))}
      />
    </Rahmen>
  );
}

function Rahmen({ untertitel, children }: { untertitel?: string; children: React.ReactNode }) {
  return (
    <main className="flex flex-1 flex-col">
      <Kopfleiste titel="Abfahrtskontrolle" untertitel={untertitel} zurueck="/fahrer" />
      <div className="mx-auto flex w-full max-w-md flex-col gap-4 p-5">{children}</div>
    </main>
  );
}
