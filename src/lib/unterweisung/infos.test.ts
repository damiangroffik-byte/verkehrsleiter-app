import { describe, expect, it } from "vitest";
import { INFO_FELDER, infosBereinigen, telefonTeile } from "./infos";

describe("infosBereinigen", () => {
  it("übernimmt nur bekannte, gefüllte Einträge", () => {
    expect(infosBereinigen({ ersthelfer: [" A ", "", "B"], unbekannt: ["x"], sammelpunkt: "kein Array" })).toEqual({ ersthelfer: ["A", "B"] });
  });
  it("begrenzt Anzahl und Länge", () => {
    const viele = Array.from({ length: 15 }, (_, i) => `Ort ${i}`);
    const r = infosBereinigen({ feuerloescher: viele, betriebsarzt: ["x".repeat(500), "zweiter"] });
    expect(r.feuerloescher).toHaveLength(10);
    expect(r.betriebsarzt).toEqual(["x".repeat(200)]);
  });
  it("hat je 10 Felder für Verbandkasten und Feuerlöscher", () => {
    expect(INFO_FELDER.find((f) => f.schluessel === "verbandkaesten")?.anzahl).toBe(10);
    expect(INFO_FELDER.find((f) => f.schluessel === "feuerloescher")?.anzahl).toBe(10);
  });
});

describe("telefonTeile", () => {
  it("erkennt Telefonnummern", () => {
    expect(telefonTeile("Max, 0171 / 123 45 67")).toEqual([{ text: "Max, " }, { text: "0171 / 123 45 67", tel: "01711234567" }]);
    expect(telefonTeile("+49 30 1234567 Büro")).toEqual([{ text: "+49 30 1234567", tel: "+49301234567" }, { text: " Büro" }]);
  });
  it("lässt kurze Zahlen und Text in Ruhe", () => {
    expect(telefonTeile("Halle 1, Tor 12")).toEqual([{ text: "Halle 1, Tor 12" }]);
  });
});
