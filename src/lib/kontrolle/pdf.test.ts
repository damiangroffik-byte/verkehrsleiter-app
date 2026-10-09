import { PDFDocument } from "pdf-lib";
import { describe, expect, it } from "vitest";
import { kontrollePdf, type BerichtDaten } from "./pdf";

const daten = (antworten: BerichtDaten["antworten"]): BerichtDaten => ({
  firma: "Testfirma",
  kennzeichen: "AB-CD 123",
  anhaenger: null,
  fahrer: "Test Fahrer",
  durchgefuehrtAm: "2026-10-09T05:00:00Z",
  eingegangenAm: "2026-10-09T05:01:00Z",
  fristen: { hu_faellig: "2027-01-31" },
  antworten,
  unterschrift: null,
});

describe("kontrollePdf", () => {
  it("erzeugt ein PDF mit Umlauten und ersetzt unbekannte Zeichen", async () => {
    const bytes = await kontrollePdf(
      daten([{ abschnitt: "Fahrerhaus", frage: "Spiegel in Ordnung?", antwortJa: false, istMangel: true, bemerkung: "Gehäuse lose 👍", fotos: [] }]),
    );
    expect(new TextDecoder().decode(bytes.slice(0, 5))).toBe("%PDF-");
    expect((await PDFDocument.load(bytes)).getPageCount()).toBe(1);
  });

  it("bricht bei vielen Prüfpunkten auf weitere Seiten um", async () => {
    const viele = Array.from({ length: 80 }, (_, i) => ({
      abschnitt: `Abschnitt ${Math.floor(i / 10)}`,
      frage: `Prüfpunkt ${i} mit einem etwas längeren Fragetext, der umgebrochen werden muss, damit er passt?`,
      antwortJa: true,
      istMangel: false,
      bemerkung: null,
      fotos: [],
    }));
    expect((await PDFDocument.load(await kontrollePdf(daten(viele)))).getPageCount()).toBeGreaterThan(1);
  });
});
