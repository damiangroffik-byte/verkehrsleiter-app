"use client";

import { useRef, useState } from "react";
import { verkleinern } from "@/lib/kontrolle/bild";
import { createClient } from "@/lib/supabase/browser";

// Kamera öffnet sich erst beim Antippen. Fotos werden verkleinert und sofort
// in den Ordner der Kontrolle hochgeladen; zurückgegeben werden die Pfade.
export function FotoAufnahme({
  ordner,
  praefix,
  pfade,
  onChange,
  beschriftung,
  pflicht,
  bucket = "kontrollen",
  mehrere = true,
  onFoto,
}: {
  ordner: string;
  praefix: string;
  pfade: string[];
  onChange: (pfade: string[]) => void;
  beschriftung: string;
  pflicht: boolean;
  bucket?: string;
  // Nur ein Foto: ein neues ersetzt das alte.
  mehrere?: boolean;
  // Originaldatei nach erfolgreichem Hochladen (z. B. für die Texterkennung).
  onFoto?: (datei: File) => void;
}) {
  const eingabe = useRef<HTMLInputElement>(null);
  const zaehler = useRef(0);
  const [vorschau, setVorschau] = useState<Record<string, string>>({});
  const [laedt, setLaedt] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);

  async function aufgenommen(e: React.ChangeEvent<HTMLInputElement>) {
    const dateien = Array.from(e.target.files ?? []);
    e.target.value = "";
    if (dateien.length === 0) return;
    setLaedt(true);
    setFehler(null);
    const supabase = createClient();
    const neu: string[] = [];
    try {
      for (const datei of dateien) {
        const blob = await verkleinern(datei);
        zaehler.current += 1;
        const pfad = `${ordner}/${praefix}-${Date.now()}-${zaehler.current}.jpg`;
        const { error } = await supabase.storage
          .from(bucket)
          .upload(pfad, blob, { contentType: "image/jpeg", upsert: false });
        if (error) throw error;
        neu.push(pfad);
        onFoto?.(datei);
        setVorschau((v) => ({ ...v, [pfad]: URL.createObjectURL(blob) }));
      }
    } catch {
      setFehler("Foto konnte nicht hochgeladen werden. Bitte prüfe die Verbindung und versuche es noch einmal.");
    } finally {
      if (neu.length > 0) onChange(mehrere ? [...pfade, ...neu] : neu.slice(-1));
      setLaedt(false);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      {pfade.length > 0 && (
        <ul className="flex flex-wrap gap-2">
          {pfade.map((p) => (
            <li key={p} className="relative">
              {vorschau[p] ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={vorschau[p]} alt="Foto" className="h-20 w-20 rounded-lg object-cover" />
              ) : (
                <span className="flex h-20 w-20 items-center justify-center rounded-lg bg-gray-200 text-xs">Foto</span>
              )}
              <button
                type="button"
                aria-label="Foto entfernen"
                onClick={() => onChange(pfade.filter((x) => x !== p))}
                className="absolute -right-2 -top-2 h-8 w-8 rounded-full bg-marke-blau text-white"
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}
      <input
        ref={eingabe}
        type="file"
        accept="image/*"
        capture="environment"
        multiple={mehrere}
        onChange={aufgenommen}
        className="hidden"
      />
      <button
        type="button"
        onClick={() => eingabe.current?.click()}
        disabled={laedt}
        className={`h-12 rounded-xl border-2 px-4 font-semibold ${pflicht && pfade.length === 0 ? "border-mangel text-mangel" : "border-marke-blau text-marke-blau"}`}
      >
        {laedt ? "Lädt hoch …" : beschriftung}
      </button>
      {fehler && <p className="text-sm text-mangel">{fehler}</p>}
    </div>
  );
}
