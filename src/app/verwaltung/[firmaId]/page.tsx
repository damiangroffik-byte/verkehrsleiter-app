import { notFound } from "next/navigation";
import { Kopfleiste } from "@/components/Kopfleiste";
import { Feld, Frist, Haken, Karte, Knopf } from "@/components/ui";
import { holeNutzer, istVerwalter, jetzt } from "@/lib/daten";
import { fahrerAnlegen, fahrzeugAnlegen } from "../actions";

type Fahrer = { id: string; vorname: string; nachname: string; email: string | null; user_id: string | null };
type Fahrzeug = {
  id: string;
  kennzeichen: string;
  ist_anhaenger: boolean;
  adr: boolean;
  hu_faellig: string | null;
  sp_faellig: string | null;
  tacho_faellig: string | null;
};

export default async function FirmaSeite({ params }: PageProps<"/verwaltung/[firmaId]">) {
  const { firmaId } = await params;
  const { supabase, mitgliedschaften } = await holeNutzer();
  const firma = mitgliedschaften.find((m) => m.firma_id === firmaId && istVerwalter(m.rolle));
  if (!firma) notFound();
  const heute = jetzt();

  const [{ data: fahrer }, { data: fahrzeuge }] = await Promise.all([
    supabase.from("fahrer").select("id, vorname, nachname, email, user_id").eq("firma_id", firmaId).order("nachname").returns<Fahrer[]>(),
    supabase
      .from("fahrzeuge")
      .select("id, kennzeichen, ist_anhaenger, adr, hu_faellig, sp_faellig, tacho_faellig")
      .eq("firma_id", firmaId)
      .order("kennzeichen")
      .returns<Fahrzeug[]>(),
  ]);

  return (
    <main className="flex flex-1 flex-col">
      <Kopfleiste titel={firma.firmen?.name ?? "Firma"} untertitel="Fahrer und Fahrzeuge" zurueck="/verwaltung" />
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-5 p-5">
        <Karte titel={`Fahrer (${fahrer?.length ?? 0})`}>
          {fahrer && fahrer.length > 0 ? (
            <ul className="divide-y divide-gray-200">
              {fahrer.map((f) => (
                <li key={f.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
                  <span className="font-semibold">
                    {f.vorname} {f.nachname}
                  </span>
                  <span className="text-sm text-gray-600">
                    {f.email ?? "keine E-Mail"} · {f.user_id ? "angemeldet" : "noch nicht angemeldet"}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-gray-600">Noch keine Fahrer angelegt.</p>
          )}
          <form action={fahrerAnlegen.bind(null, firmaId)} className="grid gap-3 border-t border-gray-200 pt-4 sm:grid-cols-2">
            <Feld label="Vorname" name="vorname" required />
            <Feld label="Nachname" name="nachname" required />
            <Feld label="E-Mail (für die Anmeldung)" name="email" type="email" />
            <Feld label="Telefon" name="telefon" type="tel" />
            <div>
              <Knopf>Fahrer hinzufügen</Knopf>
            </div>
          </form>
        </Karte>

        <Karte titel={`Fahrzeuge (${fahrzeuge?.length ?? 0})`}>
          {fahrzeuge && fahrzeuge.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="text-gray-600">
                  <tr>
                    <th className="py-2 pr-3 font-semibold">Kennzeichen</th>
                    <th className="py-2 pr-3 font-semibold">Art</th>
                    <th className="py-2 pr-3 font-semibold">HU</th>
                    <th className="py-2 pr-3 font-semibold">SP</th>
                    <th className="py-2 pr-3 font-semibold">Tacho</th>
                  </tr>
                </thead>
                <tbody>
                  {fahrzeuge.map((z) => (
                    <tr key={z.id} className="border-t border-gray-200">
                      <td className="py-2 pr-3 font-semibold">{z.kennzeichen}</td>
                      <td className="py-2 pr-3">
                        {z.ist_anhaenger ? "Anhänger" : "Zugmaschine/LKW"}
                        {z.adr ? " · ADR" : ""}
                      </td>
                      <td className="py-2 pr-3"><Frist heute={heute} datum={z.hu_faellig} /></td>
                      <td className="py-2 pr-3"><Frist heute={heute} datum={z.sp_faellig} /></td>
                      <td className="py-2 pr-3"><Frist heute={heute} datum={z.tacho_faellig} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-gray-600">Noch keine Fahrzeuge angelegt.</p>
          )}
          <form action={fahrzeugAnlegen.bind(null, firmaId)} className="grid gap-3 border-t border-gray-200 pt-4 sm:grid-cols-3">
            <Feld label="Kennzeichen" name="kennzeichen" required />
            <Feld label="HU fällig" name="hu_faellig" type="date" />
            <Feld label="SP fällig" name="sp_faellig" type="date" />
            <Feld label="Tacho-Prüfung fällig" name="tacho_faellig" type="date" />
            <Haken label="Anhänger/Auflieger" name="ist_anhaenger" />
            <Haken label="ADR-Fahrzeug" name="adr" />
            <div>
              <Knopf>Fahrzeug hinzufügen</Knopf>
            </div>
          </form>
        </Karte>
      </div>
    </main>
  );
}
