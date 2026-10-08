// Foto vor dem Hochladen verkleinern: lange Kante max. 1600 px, JPEG 0,8.
export async function verkleinern(datei: File, maxKante = 1600, qualitaet = 0.8): Promise<Blob> {
  const bild = await createImageBitmap(datei, { imageOrientation: "from-image" });
  const faktor = Math.min(1, maxKante / Math.max(bild.width, bild.height));
  const breite = Math.round(bild.width * faktor);
  const hoehe = Math.round(bild.height * faktor);

  const canvas = document.createElement("canvas");
  canvas.width = breite;
  canvas.height = hoehe;
  canvas.getContext("2d")!.drawImage(bild, 0, 0, breite, hoehe);
  bild.close();

  return new Promise((ok, fehler) =>
    canvas.toBlob((b) => (b ? ok(b) : fehler(new Error("Foto konnte nicht verarbeitet werden"))), "image/jpeg", qualitaet),
  );
}
