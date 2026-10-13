import { describe, expect, it } from "vitest";
import { blockAktiv, blockStatus, mischen, noetig, seiten, type Teilnahme } from "./regeln";

const t = (teil: Partial<Teilnahme>): Teilnahme => ({
  id: "x",
  unterweisung: "tacho",
  durchgefuehrt_am: "2026-01-10T08:00:00Z",
  prozent: 90,
  bestanden: true,
  unterschrieben_am: "2026-01-10T08:05:00Z",
  gueltig_bis: "2027-01-10",
  ...teil,
});

const heute = new Date("2026-10-12T10:00:00Z");

describe("blockStatus", () => {
  it("ohne Teilnahme fällig", () => {
    expect(blockStatus([], heute)).toMatchObject({ stufe: "rot", faellig: true, nachweis: null });
  });

  it("nicht bestandene oder nicht unterschriebene Versuche zählen nicht", () => {
    const s = blockStatus([t({ bestanden: false, gueltig_bis: null, unterschrieben_am: null }), t({ gueltig_bis: null, unterschrieben_am: null })], heute);
    expect(s.stufe).toBe("rot");
  });

  it("gültig mit Datum", () => {
    expect(blockStatus([t({})], heute)).toMatchObject({ stufe: "ok", text: "Gültig bis 10.01.2027", faellig: false });
  });

  it("bald fällig innerhalb von 30 Tagen", () => {
    expect(blockStatus([t({ gueltig_bis: "2026-11-01" })], heute)).toMatchObject({ stufe: "orange", faellig: true });
  });

  it("abgelaufen", () => {
    expect(blockStatus([t({ gueltig_bis: "2026-10-11" })], heute)).toMatchObject({ stufe: "rot", text: "Abgelaufen seit 11.10.2026" });
  });

  it("neueste Gültigkeit gewinnt", () => {
    const s = blockStatus([t({ id: "alt", gueltig_bis: "2026-01-01" }), t({ id: "neu", gueltig_bis: "2027-09-01" })], heute);
    expect(s.nachweis?.id).toBe("neu");
  });
});

describe("Test", () => {
  it("80 % von 10 sind 8 Antworten", () => {
    expect(noetig(10)).toBe(8);
    expect(noetig(12)).toBe(10);
  });

  it("mischen behält alle Antworten", () => {
    const r = mischen(4, () => 0.3);
    expect([...r].sort()).toEqual([0, 1, 2, 3]);
  });
});

describe("seiten", () => {
  it("wechselt Abschnitt und Frage ab", () => {
    expect(seiten(2, 2).map((s) => `${s.art[0]}${s.i}`)).toEqual(["a0", "f0", "a1", "f1"]);
  });

  it("übrige Fragen am Ende", () => {
    expect(seiten(1, 3).map((s) => `${s.art[0]}${s.i}`)).toEqual(["a0", "f0", "f1", "f2"]);
  });
});

describe("blockAktiv", () => {
  it("ohne Einträge aktiv", () => {
    expect(blockAktiv("tacho", [], [])).toBe(true);
  });
  it("Firmen-Auswahl gilt, wenn der Fahrer nichts Eigenes hat", () => {
    expect(blockAktiv("gefahrgut", [{ unterweisung: "gefahrgut", aktiv: false }], [])).toBe(false);
  });
  it("Zuordnung beim Fahrer geht vor", () => {
    expect(blockAktiv("gefahrgut", [{ unterweisung: "gefahrgut", aktiv: false }], [{ unterweisung: "gefahrgut", aktiv: true }])).toBe(true);
    expect(blockAktiv("tacho", [], [{ unterweisung: "tacho", aktiv: false }])).toBe(false);
  });
});
