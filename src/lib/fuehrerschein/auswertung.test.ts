import { describe, expect, it } from "vitest";
import { auswerten } from "./auswertung";

// Erfundene Beispieldaten, so wie die Texterkennung sie liefert (mit typischem Rauschen).
const vorne = "FUHRERSCHEIN\n1. MUSTERMANN\n2. ERIKA\n4a. 01.06.2018 4c. Landratsamt\n4b. 31.05.2033\n5. B072RRE2I55";
const hinten = [
  "9. 10. 11. 12.",
  "| AM 01.06.2005",
  "A1 —",
  "B 01.06.2005",
  "BE 01.06.2005",
  "C1 01.06.2018 31.05.2028 95.31.05.2028",
  "C1E 01.06.2018 31.05.2028",
  "C 01.06.2018 31.O5.2028",
  "CE 01.06.2018 31.05.2028",
  "D1",
  "L 01.06.2005",
  "T",
].join("\n");

describe("auswerten", () => {
  it("liest Klassen mit Erteilungsdatum, Ablauf C/CE und Code 95", () => {
    expect(auswerten(vorne, hinten)).toEqual({
      klassen: ["AM", "B", "BE", "C1", "C1E", "C", "CE", "L"],
      gueltigBis: "2028-05-31",
      code95Bis: "2028-05-31",
    });
  });

  it("nimmt Feld 4b, wenn keine C-Klasse ein Ablaufdatum hat", () => {
    expect(auswerten(vorne, "B 01.06.05\nBE 01.06.05")).toEqual({ klassen: ["B", "BE"], gueltigBis: "2033-05-31", code95Bis: null });
  });

  it("erkennt zweistellige Jahre und das früheste Ablaufdatum", () => {
    const r = auswerten("", "C 01.06.18 31.05.28\nCE 02.07.19 01.07.27 95.01.07.27");
    expect(r).toEqual({ klassen: ["C", "CE"], gueltigBis: "2027-07-01", code95Bis: "2027-07-01" });
  });

  it("liefert leere Werte bei unlesbarem Text", () => {
    expect(auswerten("xx", "Hologramm ~~~")).toEqual({ klassen: [], gueltigBis: null, code95Bis: null });
  });
});
