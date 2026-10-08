import Link from "next/link";
import { Kopfleiste } from "@/components/Kopfleiste";
import { Karte } from "@/components/ui";
import { holeNutzer, jetzt } from "@/lib/daten";
import { KontrollAblauf } from "./KontrollAblauf";
import type { KontrollFahrzeug, KontrollPruefpunkt } from "./typen";

type ReifenZuletzt = { fahrzeug_id: string; zuletzt: string };
type EigenerFahrer = { id: string; firma_id: string; firmen: { name: string } | null };

export default async function KontrolleSeite({ searchParams }: PageProps<"/fahrer/kontrolle">) {
  const { firma } = await searchParams;
  const { supabase, user } = await holeNutzer();

  const { data: ich } = await supabase
    .from("fahrer")
    .select("id, firma_id, firmen(name)")
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
  const [{ data: fahrzeuge }, { data: arten }, { data: pruefpunkte }, { data: reifen }] = await Promise.all([
    supabase
      .from("fahrzeuge")
      .select("id, kennzeichen, ist_anhaenger, adr, hu_faellig, sp_faellig, tacho_faellig, fahrzeugart_id")
      .eq("firma_id", firmaId)
      .eq("aktiv", true)
      .order("kennzeichen")
      .returns<KontrollFahrzeug[]>(),
    supabase.from("fahrzeugarten").select("id, name").eq("firma_id", firmaId).returns<{ id: string; name: string }[]>(),
    supabase
      .from("pruefpunkte")
      .select("id, fahrzeugart_id, abschnitt, reihenfolge, frage, mangel_bei_ja, bedingung, monatliche_fotos")
      .eq("firma_id", firmaId)
      .eq("aktiv", true)
      .order("reihenfolge")
      .returns<KontrollPruefpunkt[]>(),
    supabase.rpc("reifenfotos_zuletzt", { f: firmaId }),
  ]);

  const zugmaschinen = (fahrzeuge ?? []).filter((f) => !f.ist_anhaenger);
  if (zugmaschinen.length === 0) {
    return (
      <Rahmen untertitel={aktuell.firmen?.name}>
        <Karte titel="Kein Fahrzeug">
          <p className="text-gray-600">
            Für deine Firma ist noch kein Fahrzeug angelegt. Bitte wende dich an deinen Verkehrsleiter.
          </p>
        </Karte>
      </Rahmen>
    );
  }

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
        fahrzeuge={zugmaschinen}
        anhaenger={(fahrzeuge ?? []).filter((f) => f.ist_anhaenger)}
        pruefpunkte={pruefpunkte ?? []}
        standardArtId={arten?.find((a) => a.name === "Standard")?.id ?? null}
        reifenZuletzt={Object.fromEntries(((reifen ?? []) as ReifenZuletzt[]).map((r) => [r.fahrzeug_id, r.zuletzt]))}
        heute={jetzt()}
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
