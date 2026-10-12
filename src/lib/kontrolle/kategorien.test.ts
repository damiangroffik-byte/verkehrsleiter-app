import { describe, expect, it } from "vitest";
import { EIGENE_KATEGORIEN, kategorie, kategorieNummer, monatJahr } from "./kategorien";

describe("Kategorien", () => {
  it("passen zur Reihenfolge der Prüfpunkte (Kategorie * 100)", () => {
    expect(kategorieNummer("Rund um das Fahrzeug")).toBe(1);
    expect(kategorieNummer("UVV Ladebordwand")).toBe(7);
    expect(kategorieNummer("Winterliche Verhältnisse")).toBe(9);
  });

  it("kennen unbekannte Abschnitte früherer Checklisten", () => {
    expect(kategorie("Vor der Abfahrt")).toMatchObject({ name: "Vor der Abfahrt", kurz: "" });
  });

  it("erlauben eigene Punkte nicht bei Winter und ADR", () => {
    expect(EIGENE_KATEGORIEN).not.toContain("Winterliche Verhältnisse");
    expect(EIGENE_KATEGORIEN).not.toContain("Gefahrgut (ADR)");
    expect(EIGENE_KATEGORIEN).toContain("UVV Elektro-Niederhubwagen");
  });

  it("zeigt die Prüfplakette als MM/JJJJ", () => {
    expect(monatJahr("2026-11-30")).toBe("11/2026");
    expect(monatJahr(null)).toBe("");
  });
});
