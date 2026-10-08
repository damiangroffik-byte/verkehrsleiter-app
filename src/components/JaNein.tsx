"use client";

// Zwei große Knöpfe Ja/Nein. Die Antwort, die ein Mangel ist, wird rot umrandet.
export function JaNein({
  wert,
  mangelBeiJa,
  onChange,
  name,
}: {
  wert: boolean | null;
  mangelBeiJa: boolean;
  onChange: (ja: boolean) => void;
  name: string;
}) {
  return (
    <div role="radiogroup" aria-label={name} className="grid grid-cols-2 gap-2">
      {[true, false].map((ja) => {
        const gewaehlt = wert === ja;
        const mangel = ja === mangelBeiJa;
        const farbe = gewaehlt
          ? mangel
            ? "border-mangel bg-mangel text-white"
            : "border-ok bg-ok text-white"
          : mangel
            ? "border-mangel/60 bg-white"
            : "border-gray-300 bg-white";
        return (
          <button
            key={String(ja)}
            type="button"
            role="radio"
            aria-checked={gewaehlt}
            onClick={() => onChange(ja)}
            className={`h-12 rounded-xl border-2 text-base font-semibold ${farbe}`}
          >
            {ja ? "Ja" : "Nein"}
          </button>
        );
      })}
    </div>
  );
}
