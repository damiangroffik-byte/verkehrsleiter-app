import Link from "next/link";
import { notFound } from "next/navigation";
import { abmelden } from "@/app/login/actions";
import { MenueHandy, MenueLeiste, type MenuePunkt } from "@/components/verwaltung/Menue";
import { holeNutzer, istVerwalter } from "@/lib/daten";

export default async function VerwaltungRahmen({ children, params }: LayoutProps<"/verwaltung/[firmaId]">) {
  const { firmaId } = await params;
  const { supabase, mitgliedschaften } = await holeNutzer();
  const firma = mitgliedschaften.find((m) => m.firma_id === firmaId && istVerwalter(m.rolle));
  if (!firma) notFound();
  const mehrereFirmen = mitgliedschaften.filter((m) => istVerwalter(m.rolle)).length > 1;

  const { count: offeneMaengel } = await supabase
    .from("maengel")
    .select("id", { count: "exact", head: true })
    .eq("firma_id", firmaId)
    .eq("status", "offen");

  const b = `/verwaltung/${firmaId}`;
  const punkte: MenuePunkt[] = [
    { href: b, titel: "Übersicht", genau: true },
    { href: `${b}/fahrzeuge`, titel: "Fahrzeuge" },
    { href: `${b}/fahrer`, titel: "Fahrer", auch: [`${b}/fuehrerschein`] },
    { href: `${b}/abfahrtskontrolle`, titel: "Abfahrtskontrolle", auch: [`${b}/pruefpunkte`] },
    { href: `${b}/maengel`, titel: "Mängelmeldungen", zahl: offeneMaengel ?? 0 },
    { href: `${b}/fristen`, titel: "Fristen" },
    { href: `${b}/unterweisungen`, titel: "Unterweisungen" },
    { href: `${b}/einstellungen`, titel: "Einstellungen" },
  ];
  const name = firma.firmen?.name ?? "Firma";

  return (
    <div className="flex flex-1 flex-col lg:flex-row">
      <aside className="hidden w-60 shrink-0 flex-col gap-6 bg-marke-blau-dunkel px-3 py-5 text-white lg:sticky lg:top-0 lg:flex lg:h-screen">
        <div className="flex flex-col gap-0.5 px-3">
          <span className="font-titel text-lg leading-tight font-extrabold">{name}</span>
          <span className="text-sm text-white/70">{firma.rolle === "verkehrsleiter" ? "Verkehrsleiter" : "Unternehmer"}</span>
        </div>
        <nav aria-label="Verwaltung" className="flex-1 overflow-y-auto">
          <MenueLeiste punkte={punkte} />
        </nav>
        <div className="flex flex-col gap-1 border-t border-white/15 pt-3">
          {mehrereFirmen && (
            <Link href="/verwaltung" className="flex min-h-11 items-center rounded-lg px-3 text-sm text-white/80 hover:bg-white/8">
              Firma wechseln
            </Link>
          )}
          <form action={abmelden}>
            <button type="submit" className="flex min-h-11 w-full items-center rounded-lg px-3 text-left text-sm text-white/80 hover:bg-white/8">
              Abmelden
            </button>
          </form>
        </div>
      </aside>

      <header className="flex flex-col gap-2 border-b-4 border-marke-gelb bg-marke-blau-dunkel pt-3 text-white lg:hidden">
        <div className="flex items-center justify-between gap-3 px-4">
          <Link href={mehrereFirmen ? "/verwaltung" : b} className="flex min-h-11 min-w-0 flex-col justify-center">
            <span className="truncate font-titel text-lg font-extrabold">{name}</span>
          </Link>
          <form action={abmelden}>
            <button type="submit" className="h-11 px-2 text-sm underline">
              Abmelden
            </button>
          </form>
        </div>
        <nav aria-label="Verwaltung">
          <MenueHandy punkte={punkte} />
        </nav>
      </header>

      <div className="flex min-w-0 flex-1 flex-col">{children}</div>
    </div>
  );
}
