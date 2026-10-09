import { describe, expect, it } from "vitest";
import { bereinigen } from "./erkennung";

describe("bereinigen", () => {
  it("übernimmt gültige Werte", () => {
    expect(bereinigen({ lesbar: true, klassen: ["B", "CE", "C"], gueltig_bis: "2030-05-01", code95_bis: null })).toEqual({
      klassen: ["B", "CE", "C"],
      gueltigBis: "2030-05-01",
      code95Bis: null,
    });
  });

  it("verwirft unbekannte Klassen und kaputte Daten", () => {
    expect(bereinigen({ lesbar: true, klassen: ["B", "X", "B"], gueltig_bis: "01.05.2030", code95_bis: "2030-13-40" })).toEqual({
      klassen: ["B"],
      gueltigBis: null,
      code95Bis: null,
    });
  });

  it("liefert nichts bei unlesbaren Fotos", () => {
    expect(bereinigen({ lesbar: false, klassen: ["B"], gueltig_bis: null, code95_bis: null })).toBeNull();
    expect(bereinigen("Unsinn")).toBeNull();
  });
});
