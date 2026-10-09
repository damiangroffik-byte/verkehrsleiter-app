import { describe, expect, it } from "vitest";
import { fuehrerscheinStatus, plusMonate, type Pruefung } from "./regeln";

const pruefung = (teil: Partial<Pruefung>): Pruefung => ({
  status: "bestaetigt",
  eingereicht_am: "2026-04-01T08:00:00Z",
  geprueft_am: "2026-04-02T08:00:00Z",
  gueltig_bis: "2030-01-01",
  code95_bis: null,
  vermerk: null,
  ...teil,
});

const am = (d: string) => new Date(`${d}T10:00:00Z`);

describe("plusMonate", () => {
  it("rechnet Monate und kürzt auf den Monatsletzten", () => {
    expect(plusMonate("2026-04-02", 6)).toBe("2026-10-02");
    expect(plusMonate("2026-08-31", 6)).toBe("2027-02-28");
  });
});

describe("fuehrerscheinStatus", () => {
  it("ohne Prüfung rot", () => {
    expect(fuehrerscheinStatus([], 6, am("2026-10-09")).stufe).toBe("rot");
  });

  it("eingereicht ohne Bestätigung wartet", () => {
    expect(fuehrerscheinStatus([pruefung({ status: "eingereicht", geprueft_am: null })], 6, am("2026-10-09")).stufe).toBe("wartet");
  });

  it("nach Bestätigung ok mit nächster Prüfung in 6 Monaten", () => {
    const s = fuehrerscheinStatus([pruefung({})], 6, am("2026-06-01"));
    expect(s.stufe).toBe("ok");
    expect(s.naechstePruefung).toBe("2026-10-02");
  });

  it("30 Tage vor der nächsten Prüfung orange, danach rot", () => {
    expect(fuehrerscheinStatus([pruefung({})], 6, am("2026-09-10")).stufe).toBe("orange");
    expect(fuehrerscheinStatus([pruefung({})], 6, am("2026-10-02")).stufe).toBe("rot");
  });

  it("abgelaufene Fahrerlaubnis ist rot", () => {
    const s = fuehrerscheinStatus([pruefung({ gueltig_bis: "2026-06-30" })], 6, am("2026-07-01"));
    expect(s).toMatchObject({ stufe: "rot", text: "Fahrerlaubnis abgelaufen" });
  });

  it("bald ablaufender Code 95 ist orange", () => {
    expect(fuehrerscheinStatus([pruefung({ code95_bis: "2026-06-20" })], 6, am("2026-06-01")).stufe).toBe("orange");
  });

  it("abgelehnte neueste Einreichung verlangt neue Einreichung", () => {
    const s = fuehrerscheinStatus(
      [pruefung({ status: "abgelehnt", vermerk: "unscharf", eingereicht_am: "2026-10-05T08:00:00Z" }), pruefung({})],
      6,
      am("2026-10-09"),
    );
    expect(s.stufe).toBe("rot");
    expect(s.abgelehnt?.vermerk).toBe("unscharf");
  });
});
