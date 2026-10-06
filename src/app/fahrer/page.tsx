import { Kopfleiste } from "@/components/Kopfleiste";
import { Karte } from "@/components/ui";
import { holeNutzer } from "@/lib/daten";

type FahrerDaten = { vorname: string; firmen: { name: string } | null };

export default async function FahrerStart() {
  const { supabase, user } = await holeNutzer();
  const { data } = await supabase
    .from("fahrer")
    .select("vorname, firmen(name)")
    .eq("user_id", user.id)
    .limit(1)
    .returns<FahrerDaten[]>();
  const ich = data?.[0];

  return (
    <main className="flex flex-1 flex-col">
      <Kopfleiste titel={`Hallo ${ich?.vorname ?? ""}`.trim()} untertitel={ich?.firmen?.name} />
      <div className="mx-auto flex w-full max-w-md flex-col gap-4 p-5">
        <Karte titel="Deine Aufgaben">
          <p className="text-gray-600">
            Hier erscheinen bald Abfahrtskontrolle, Führerscheinkontrolle und Unterweisungen.
          </p>
        </Karte>
      </div>
    </main>
  );
}
