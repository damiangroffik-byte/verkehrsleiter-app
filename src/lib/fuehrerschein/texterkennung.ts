// Texterkennung direkt auf dem Handy (tesseract.js). Die Fotos verlassen dabei das Gerät nicht;
// Programm und Sprachdaten kommen von unserer eigenen Adresse (public/tesseract).

import { verkleinern } from "@/lib/kontrolle/bild";
import { auswerten } from "./auswertung";
import type { Erkannt } from "./erkennung";

export async function fotosLesen(vorne: File, hinten: File): Promise<Erkannt> {
  const { createWorker, OEM } = await import("tesseract.js");
  const worker = await createWorker("deu", OEM.LSTM_ONLY, {
    workerPath: "/tesseract/worker.min.js",
    corePath: "/tesseract",
    langPath: "/tesseract",
  });
  try {
    // Etwas größer als fürs Hochladen, damit die kleine Schrift der Rückseite lesbar bleibt.
    const lesen = async (datei: File) => (await worker.recognize(await verkleinern(datei, 2400, 0.92))).data.text;
    const textVorne = await lesen(vorne);
    const textHinten = await lesen(hinten);
    return auswerten(textVorne, textHinten);
  } finally {
    await worker.terminate();
  }
}
