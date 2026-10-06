import type { ComponentProps, ReactNode } from "react";

export function Karte({ titel, children }: { titel?: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-3 rounded-2xl bg-white p-5 shadow-sm">
      {titel && <h2 className="font-titel text-lg font-semibold">{titel}</h2>}
      {children}
    </section>
  );
}

export function Feld({ label, ...props }: { label: string } & ComponentProps<"input">) {
  return (
    <label className="flex flex-col gap-1 text-sm text-gray-700">
      {label}
      <input {...props} className="h-11 rounded-xl border border-gray-300 bg-white px-3 text-base text-marke-blau-dunkel" />
    </label>
  );
}

export function Haken({ label, name }: { label: string; name: string }) {
  return (
    <label className="flex min-h-11 items-center gap-2 text-base">
      <input type="checkbox" name={name} className="h-5 w-5" />
      {label}
    </label>
  );
}

export function Knopf({ children }: { children: ReactNode }) {
  return (
    <button type="submit" className="h-12 rounded-xl bg-marke-gelb px-5 font-semibold text-marke-blau">
      {children}
    </button>
  );
}

// Datum als TT.MM.JJJJ, rot wenn abgelaufen, orange wenn in den nächsten 60 Tagen fällig.
export function Frist({ datum, heute }: { datum: string | null; heute: number }) {
  if (!datum) return <span className="text-gray-500">–</span>;
  const tage = Math.ceil((new Date(datum).getTime() - heute) / 86_400_000);
  const farbe = tage < 0 ? "text-mangel font-semibold" : tage <= 60 ? "text-warnung font-semibold" : "";
  return <span className={farbe}>{new Date(datum).toLocaleDateString("de-DE")}</span>;
}
