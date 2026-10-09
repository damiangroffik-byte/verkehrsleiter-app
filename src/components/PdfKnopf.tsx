"use client";

import { useState } from "react";

// Öffnet das PDF, ohne die App zu verlassen: Auf dem Handy erscheint das Teilen-Menü
// (Vorschau, „In Dateien sichern“, Mail), sonst wird die Datei heruntergeladen.
// Ein normaler Link würde in der installierten App die Seite ersetzen, ohne Weg zurück.
export function PdfKnopf({ href, className, children }: { href: string; className?: string; children: React.ReactNode }) {
  const [datei, setDatei] = useState<File | null>(null);
  const [laedt, setLaedt] = useState(false);
  const [fehler, setFehler] = useState(false);

  async function zeigen(f: File) {
    if (navigator.canShare?.({ files: [f] })) {
      try {
        await navigator.share({ files: [f], title: f.name });
        return;
      } catch (e) {
        const name = (e as Error).name;
        if (name === "AbortError") return; // im Teilen-Menü abgebrochen
        // iPhone erlaubt Teilen nur direkt nach dem Antippen: dann einfach noch einmal tippen lassen.
        if (name === "NotAllowedError") {
          setDatei(f);
          return;
        }
      }
    }
    const url = URL.createObjectURL(f);
    const a = document.createElement("a");
    a.href = url;
    a.download = f.name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  }

  async function antippen() {
    if (datei) {
      await zeigen(datei);
      return;
    }
    setLaedt(true);
    setFehler(false);
    try {
      const antwort = await fetch(href);
      if (!antwort.ok) throw new Error(String(antwort.status));
      const name = /filename="([^"]+)"/.exec(antwort.headers.get("Content-Disposition") ?? "")?.[1] ?? "Abfahrtskontrolle.pdf";
      await zeigen(new File([await antwort.blob()], name, { type: "application/pdf" }));
    } catch {
      setFehler(true);
    } finally {
      setLaedt(false);
    }
  }

  return (
    <span className="flex flex-col items-end">
      <button type="button" onClick={antippen} disabled={laedt} className={className}>
        {laedt ? "Lädt …" : datei ? "PDF öffnen" : children}
      </button>
      {fehler && <span className="text-xs text-mangel">PDF konnte nicht geladen werden.</span>}
    </span>
  );
}
