import Link from "next/link";
import { Kopfleiste } from "@/components/Kopfleiste";
import { Feld, Karte, Knopf } from "@/components/ui";
import { holeNutzer, istVerwalter } from "@/lib/daten";
import { firmaAnlegen } from "./actions";

export default async function Verwaltung() {
  const { supabase, user, mitgliedschaften } = await holeNutzer();
  const firmen = mitgliedschaften.filter((m) => istVerwalter(m.rolle));
  // Wer selbst als Fahrer eingetragen ist, kommt von hier zur eigenen Kontrolle.
  const { count: alsFahrer } = await supabase
    .from("fahrer")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .eq("aktiv", true);

  return (
    <main className="flex flex-1 flex-col">
      <Kopfleiste titel="Verkehrsleiter" untertitel="Deine Firmen" />
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-5 p-5">
        {(alsFahrer ?? 0) > 0 && (
          <Link
            href="/fahrer/kontrolle"
            className="flex h-12 items-center justify-center rounded-xl bg-marke-gelb font-semibold text-marke-blau"
          >
            Eigene Abfahrtskontrolle starten
          </Link>
        )}
        {firmen.length > 0 && (
          <Karte titel="Firmen">
            <ul className="flex flex-col gap-2">
              {firmen.map((f) => (
                <li key={f.firma_id}>
                  <Link
                    href={`/verwaltung/${f.firma_id}`}
                    className="flex min-h-12 items-center justify-between rounded-xl border border-gray-200 px-4 font-semibold"
                  >
                    {f.firmen?.name}
                    <span className="text-sm font-normal text-gray-600">{f.rolle === "verkehrsleiter" ? "Verkehrsleiter" : "Unternehmer"}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </Karte>
        )}
        <Karte titel="Neue Firma anlegen">
          <form action={firmaAnlegen} className="flex flex-col gap-3">
            <Feld label="Name" name="name" required />
            <Feld label="Adresse" name="adresse" />
            <div>
              <Knopf>Firma anlegen</Knopf>
            </div>
          </form>
        </Karte>
      </div>
    </main>
  );
}
