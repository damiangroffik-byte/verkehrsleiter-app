import type { Stufe } from "@/lib/fuehrerschein/regeln";

const farbe: Record<Stufe, string> = {
  rot: "bg-mangel",
  orange: "bg-warnung",
  wartet: "bg-marke-blau",
  ok: "bg-ok",
};

export function StatusZeile({ stufe, text }: { stufe: Stufe; text: string }) {
  return (
    <p className="flex items-center gap-2 font-semibold">
      <span className={`inline-block h-3 w-3 shrink-0 rounded-full ${farbe[stufe]}`} aria-hidden />
      {text}
    </p>
  );
}
