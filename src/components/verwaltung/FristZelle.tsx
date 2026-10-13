import { datumDe, type Stufe } from "@/lib/fahrzeugfristen";

const FARBE: Record<Stufe, string> = {
  rot: "bg-mangel text-white",
  orange: "bg-marke-gelb text-marke-blau",
  ok: "text-ok",
  fehlt: "text-mangel",
};

export function FristZelle({ datum, stufe, foto }: { datum: string | null; stufe: Stufe; foto?: boolean }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-sm font-semibold whitespace-nowrap ${FARBE[stufe]}`}>
      {datum ? datumDe(datum) : "fehlt"}
      {foto && <span aria-label="mit Foto">📷</span>}
    </span>
  );
}
