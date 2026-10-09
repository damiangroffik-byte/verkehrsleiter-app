// Texterkennung direkt auf dem Handy (tesseract.js). Die Fotos verlassen dabei das Gerät nicht;
// Programm und Sprachdaten kommen von unserer eigenen Adresse (public/tesseract).

import { verkleinern } from "@/lib/kontrolle/bild";
import { auswerten } from "./auswertung";
import type { Erkannt } from "./erkennung";

type Grad = 0 | 90 | 180 | 270;

// Bild um 90°-Schritte drehen (Fahrer halten das Handy oft hochkant, die Karte liegt dann quer im Bild).
async function drehen(blob: Blob, grad: Grad): Promise<Blob> {
  if (grad === 0) return blob;
  const bild = await createImageBitmap(blob);
  const quer = grad === 90 || grad === 270;
  const canvas = document.createElement("canvas");
  canvas.width = quer ? bild.height : bild.width;
  canvas.height = quer ? bild.width : bild.height;
  const ctx = canvas.getContext("2d")!;
  ctx.translate(canvas.width / 2, canvas.height / 2);
  ctx.rotate((grad * Math.PI) / 180);
  ctx.drawImage(bild, -bild.width / 2, -bild.height / 2);
  bild.close();
  return new Promise((ok, fehler) =>
    canvas.toBlob((b) => (b ? ok(b) : fehler(new Error("Foto konnte nicht gedreht werden"))), "image/jpeg", 0.92),
  );
}

// Reihenfolge der Versuche: Hochkant-Fotos zuerst gedreht, Querformat zuerst gerade.
async function richtungen(blob: Blob): Promise<Grad[]> {
  const bild = await createImageBitmap(blob);
  const hochkant = bild.height > bild.width;
  bild.close();
  return hochkant ? [90, 270, 0, 180] : [0, 180, 90, 270];
}

export async function fotosLesen(vorne: File, hinten: File): Promise<Erkannt> {
  const { createWorker, OEM } = await import("tesseract.js");
  // Volle Adressen: der Worker läuft aus einer blob:-Adresse, dort lassen sich "/…"-Pfade nicht überall auflösen.
  const ordner = new URL("/tesseract", location.origin).href;
  const worker = await createWorker("deu", OEM.LSTM_ONLY, {
    workerPath: `${ordner}/worker.min.js`,
    corePath: ordner,
    langPath: ordner,
  });
  try {
    // Etwas größer als fürs Hochladen, damit die kleine Schrift der Rückseite lesbar bleibt.
    const lesen = async (blob: Blob, grad: Grad) => (await worker.recognize(await drehen(blob, grad))).data.text;

    // Rückseite: so lange drehen, bis Klassen erkannt werden.
    const bildHinten = await verkleinern(hinten, 2400, 0.92);
    let ergebnis = auswerten("", "");
    let treffer: Grad | null = null;
    for (const grad of await richtungen(bildHinten)) {
      ergebnis = auswerten("", await lesen(bildHinten, grad));
      if (ergebnis.klassen.length > 0) {
        treffer = grad;
        break;
      }
    }
    if (ergebnis.gueltigBis) return ergebnis;

    // Vorderseite nur für Feld 4b, wenn die Rückseite kein Ablaufdatum liefert.
    const bildVorne = await verkleinern(vorne, 2400, 0.92);
    const reihenfolge = await richtungen(bildVorne);
    if (treffer !== null) reihenfolge.sort((a, b) => Number(b === treffer) - Number(a === treffer));
    for (const grad of reihenfolge) {
      const mitVorne = auswerten(await lesen(bildVorne, grad), "");
      if (mitVorne.gueltigBis) return { ...ergebnis, gueltigBis: mitVorne.gueltigBis };
    }
    return ergebnis;
  } finally {
    await worker.terminate();
  }
}
