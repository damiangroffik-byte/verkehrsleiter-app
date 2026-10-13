import { describe, expect, it } from "vitest";
import { ausfuellen, geltendeArten, mailFaellig, STANDARD_TEXT, stufe, type FristFahrzeug } from "./fahrzeugfristen";

const lkw: FristFahrzeug = {
  id: "1",
  kennzeichen: "KN-AB123",
  ist_anhaenger: false,
  ladebordwand: true,
  ameise: false,
  hu_faellig: null,
  sp_faellig: null,
  tacho_faellig: null,
  feuerloescher_bis: null,
  ladebordwand_uvv_bis: null,
  ameise_uvv_bis: null,
};

describe("Fahrzeugfristen", () => {
  it("wählt die passenden Prüfarten", () => {
    expect(geltendeArten(lkw)).toEqual(["hu", "sp", "tacho", "feuerloescher", "uvv_ladebordwand"]);
    expect(geltendeArten({ ...lkw, ist_anhaenger: true, ladebordwand: false })).toEqual(["hu", "sp"]);
  });
  it("bewertet Fristen", () => {
    expect(stufe(null, "2026-10-13", 30)).toBe("fehlt");
    expect(stufe("2026-10-12", "2026-10-13", 30)).toBe("rot");
    expect(stufe("2026-11-12", "2026-10-13", 30)).toBe("orange");
    expect(stufe("2026-11-13", "2026-10-13", 30)).toBe("ok");
  });
  it("Mail ab dem eingestellten Vorlauf", () => {
    expect(mailFaellig("2026-11-24", "2026-10-13", 42)).toBe(true);
    expect(mailFaellig("2026-11-25", "2026-10-13", 42)).toBe(false);
    expect(mailFaellig("2026-09-01", "2026-10-13", 42)).toBe(false);
  });
  it("füllt den Mailtext aus", () => {
    const t = ausfuellen(STANDARD_TEXT, { kennzeichen: "KN-AB123", art: "hu", datum: "2027-03-31", firma: "Muster GmbH" });
    expect(t).toContain("Kennzeichen KN-AB123 hat am 31.03.2027 die Hauptuntersuchung (HU).");
    expect(t).toContain("Muster GmbH");
  });
});

describe("zuDatum", () => {
  it("Monat ohne Tag wird Monatsende, zweistelliges Jahr wird ergänzt", async () => {
    const { zuDatum } = await import("./fristErkennung");
    expect(zuDatum({ lesbar: true, jahr: 27, monat: 2, tag: null })).toBe("2027-02-28");
    expect(zuDatum({ lesbar: true, jahr: 2027, monat: 6, tag: 15 })).toBe("2027-06-15");
    expect(zuDatum({ lesbar: false, jahr: 2027, monat: 6, tag: null })).toBeNull();
    expect(zuDatum({ lesbar: true, jahr: 2027, monat: 13, tag: null })).toBeNull();
  });
});
