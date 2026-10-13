import { describe, expect, it } from "vitest";
import { istNachweis, nachweisDatum } from "./fahrerNachweise";

const leer = { fqn_gueltig_bis: null, fahrerkarte_gueltig_bis: null, adr_gueltig_bis: null };

describe("nachweisDatum", () => {
  it("Code 95 aus dem Führerschein, wenn keine FQN-Karte erfasst ist", () => {
    expect(nachweisDatum(leer, "fqn", "2028-05-01")).toBe("2028-05-01");
    expect(nachweisDatum({ ...leer, fqn_gueltig_bis: "2029-01-31" }, "fqn", "2028-05-01")).toBe("2029-01-31");
  });
  it("Fahrerkarte nur aus der eigenen Spalte", () => {
    expect(nachweisDatum(leer, "fahrerkarte", "2028-05-01")).toBeNull();
  });
});

describe("istNachweis", () => {
  it("kennt nur die drei Arten", () => {
    expect(istNachweis("adr")).toBe(true);
    expect(istNachweis("hu")).toBe(false);
  });
});
