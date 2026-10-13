import { describe, expect, it } from "vitest";
import { fristenListe } from "./fristen";

describe("fristenListe", () => {
  it("sammelt Fahrzeug- und Fahrerfristen und sortiert nach Datum", () => {
    const l = fristenListe(
      [{ id: "z", kennzeichen: "KN-A1", hu_faellig: "2026-12-01", sp_faellig: null, tacho_faellig: "2026-10-01", ladebordwand_uvv_bis: null, ameise_uvv_bis: null }],
      [{ id: "f", vorname: "A", nachname: "B", fqn_gueltig_bis: "2026-11-01", adr_gueltig_bis: null, fahrerkarte_gueltig_bis: null }],
      "2026-10-13",
    );
    expect(l.map((x) => [x.was, x.tage])).toEqual([
      ["Tacho-Prüfung", -12],
      ["Berufskraftfahrer (Code 95)", 19],
      ["Hauptuntersuchung (HU)", 49],
    ]);
  });
});
