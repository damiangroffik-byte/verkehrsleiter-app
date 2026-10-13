"use client";

import { useRef, useState } from "react";

export type FahrerNachricht = { id: string; titel: string; text: string; gesendet: string; gelesen: boolean };

// Kleine Leiste oben auf der Startseite. Antippen öffnet die Nachricht im Fenster.
export function NachrichtenLeiste({ nachrichten, gelesen }: { nachrichten: FahrerNachricht[]; gelesen: (id: string) => Promise<void> }) {
  const fenster = useRef<HTMLDialogElement>(null);
  const [offen, setOffen] = useState<FahrerNachricht | null>(null);
  const neu = nachrichten.filter((n) => !n.gelesen).length;

  function oeffnen(n: FahrerNachricht) {
    setOffen(n);
    fenster.current?.showModal();
  }

  return (
    <section aria-label="Nachrichten" className="flex flex-col overflow-hidden rounded-2xl bg-white shadow-sm">
      <p className="flex items-center gap-2 px-4 pt-3 text-sm font-semibold text-gray-600">
        Nachrichten
        {neu > 0 && <span className="rounded-full bg-mangel px-2 text-xs text-white">{neu} neu</span>}
      </p>
      <ul className="divide-y divide-gray-200">
        {nachrichten.map((n) => (
          <li key={n.id}>
            <button type="button" onClick={() => oeffnen(n)} className="flex min-h-12 w-full items-center gap-3 px-4 py-2 text-left">
              <span aria-hidden className={`h-2.5 w-2.5 shrink-0 rounded-full ${n.gelesen ? "bg-gray-300" : "bg-marke-blau"}`} />
              <span className="min-w-0 flex-1">
                <span className={`block truncate ${n.gelesen ? "text-gray-700" : "font-semibold text-marke-blau-dunkel"}`}>{n.titel}</span>
                <span className="block text-xs text-gray-500">{n.gesendet}</span>
              </span>
              <span aria-hidden className="text-marke-blau">›</span>
            </button>
          </li>
        ))}
      </ul>
      <dialog
        ref={fenster}
        onClose={() => setOffen(null)}
        className="m-auto w-[calc(100%-2rem)] max-w-md rounded-2xl p-0 backdrop:bg-black/50"
      >
        {offen && (
          <div className="flex flex-col gap-3 p-5">
            <h2 className="font-titel text-lg font-semibold text-marke-blau-dunkel">{offen.titel}</h2>
            <p className="text-xs text-gray-500">{offen.gesendet}</p>
            <p className="whitespace-pre-line break-words text-marke-blau-dunkel">{offen.text}</p>
            {offen.gelesen ? (
              <button type="button" onClick={() => fenster.current?.close()} className="h-12 rounded-xl border-2 border-marke-blau font-semibold text-marke-blau">
                Schließen
              </button>
            ) : (
              <form action={gelesen.bind(null, offen.id)} onSubmit={() => fenster.current?.close()}>
                <button type="submit" className="h-12 w-full rounded-xl bg-marke-gelb font-semibold text-marke-blau">
                  Gelesen
                </button>
                <button type="button" onClick={() => fenster.current?.close()} className="mt-2 h-11 w-full text-sm font-semibold text-marke-blau underline">
                  Später lesen
                </button>
              </form>
            )}
          </div>
        )}
      </dialog>
    </section>
  );
}
