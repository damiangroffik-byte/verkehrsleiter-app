import { describe, expect, it } from "vitest";
import { darfLosfahren, istMangel, istSichtbar, istWinter, pruefeEntwurf, reifenfotosFaellig, type Antwort, type Lage, type Pruefpunkt } from "./regeln";

const punkt = (teil: Partial<Pruefpunkt>): Pruefpunkt => ({
  id: "p1",
  abschnitt: "LKW",
  reihenfolge: 1,
  frage: "Bremsen in Ordnung?",
  mangel_bei_ja: false,
  bedingung: "immer",
  monatliche_fotos: false,
  pflicht: true,
  foto_bei_mangel: true,
  mangel_stoppt: false,
  ...teil,
});

const antwort = (teil: Partial<Antwort>): Antwort => ({ antwortJa: null, bemerkung: "", fotoPfade: [], losfahren: null, ...teil });

const lage = (teil: Partial<Lage>): Lage => ({ adr: false, mitAnhaenger: false, ladebordwand: false, ameise: false, winter: false, ...teil });

describe("istSichtbar", () => {
  it("zeigt ADR-Punkte nur bei ADR", () => {
    expect(istSichtbar({ bedingung: "adr" }, lage({ mitAnhaenger: true }))).toBe(false);
    expect(istSichtbar({ bedingung: "adr" }, lage({ adr: true }))).toBe(true);
  });

  it("zeigt Anhänger-Punkte nur mit Anhänger", () => {
    expect(istSichtbar({ bedingung: "anhaenger" }, lage({ adr: true }))).toBe(false);
    expect(istSichtbar({ bedingung: "anhaenger" }, lage({ mitAnhaenger: true }))).toBe(true);
  });

  it("zeigt UVV-Punkte nur mit dem Arbeitsgerät", () => {
    expect(istSichtbar({ bedingung: "ladebordwand" }, lage({ ameise: true }))).toBe(false);
    expect(istSichtbar({ bedingung: "ladebordwand" }, lage({ ladebordwand: true }))).toBe(true);
    expect(istSichtbar({ bedingung: "ameise" }, lage({ ameise: true }))).toBe(true);
  });

  it("zeigt Winterpunkte nur im Winter", () => {
    expect(istSichtbar({ bedingung: "winter" }, lage({}))).toBe(false);
    expect(istSichtbar({ bedingung: "winter" }, lage({ winter: true }))).toBe(true);
  });

  it("zeigt normale Punkte immer", () => {
    expect(istSichtbar({ bedingung: "immer" }, lage({}))).toBe(true);
  });
});

describe("istMangel", () => {
  it("Nein ist Mangel, wenn mangel_bei_ja falsch ist", () => {
    expect(istMangel({ mangel_bei_ja: false }, false)).toBe(true);
    expect(istMangel({ mangel_bei_ja: false }, true)).toBe(false);
  });

  it("Ja ist Mangel, wenn mangel_bei_ja wahr ist", () => {
    expect(istMangel({ mangel_bei_ja: true }, true)).toBe(true);
    expect(istMangel({ mangel_bei_ja: true }, false)).toBe(false);
  });

  it("ohne Antwort kein Mangel", () => {
    expect(istMangel({ mangel_bei_ja: true }, null)).toBe(false);
  });
});

describe("reifenfotosFaellig", () => {
  it("ist fällig ohne frühere Fotos", () => {
    expect(reifenfotosFaellig(null, new Date("2026-10-08T10:00:00Z"))).toBe(true);
  });

  it("ist im selben Monat nicht fällig", () => {
    expect(reifenfotosFaellig("2026-10-01T06:00:00Z", new Date("2026-10-31T10:00:00Z"))).toBe(false);
  });

  it("ist im neuen Monat wieder fällig, auch über die Zeitzone", () => {
    // 30.09. 23:30 UTC ist in Berlin schon der 1.10.
    expect(reifenfotosFaellig("2026-09-30T23:30:00Z", new Date("2026-10-02T08:00:00Z"))).toBe(false);
    expect(reifenfotosFaellig("2026-09-30T20:00:00Z", new Date("2026-10-02T08:00:00Z"))).toBe(true);
  });
});

describe("istWinter", () => {
  it("gilt vom 1. November bis 31. März in Berlin", () => {
    expect(istWinter(new Date("2026-10-31T21:00:00Z"))).toBe(false);
    expect(istWinter(new Date("2026-10-31T23:30:00Z"))).toBe(true);
    expect(istWinter(new Date("2027-03-31T12:00:00Z"))).toBe(true);
    expect(istWinter(new Date("2027-04-01T08:00:00Z"))).toBe(false);
  });
});

describe("darfLosfahren", () => {
  it("ohne Mangel ja, bei Stopp-Punkten nie, sonst nach Antwort", () => {
    expect(darfLosfahren(punkt({}), antwort({ antwortJa: true }))).toBe(true);
    expect(darfLosfahren(punkt({ mangel_stoppt: true }), antwort({ antwortJa: false, losfahren: true }))).toBe(false);
    expect(darfLosfahren(punkt({}), antwort({ antwortJa: false }))).toBeNull();
    expect(darfLosfahren(punkt({}), antwort({ antwortJa: false, losfahren: true }))).toBe(true);
  });
});

describe("pruefeEntwurf", () => {
  const bremse = punkt({ id: "bremse" });
  const reifen = punkt({ id: "reifen", frage: "Reifen beschädigt?", mangel_bei_ja: true, monatliche_fotos: true });

  it("verlangt zuerst ein Fahrzeug", () => {
    expect(pruefeEntwurf({ fahrzeugId: null, antworten: {}, unterschrieben: true }, [bremse], false)?.feld).toBe("fahrzeug");
  });

  it("meldet den ersten unbeantworteten Punkt", () => {
    const f = pruefeEntwurf({ fahrzeugId: "lkw", antworten: {}, unterschrieben: true }, [bremse, reifen], false);
    expect(f).toEqual({ feld: "pruefpunkt", pruefpunktId: "bremse", text: "Bitte beantworte: Bremsen in Ordnung?" });
  });

  it("verlangt bei Mangel Beschreibung und Foto", () => {
    const ohneText = pruefeEntwurf(
      { fahrzeugId: "lkw", antworten: { bremse: antwort({ antwortJa: false }) }, unterschrieben: true },
      [bremse],
      false,
    );
    expect(ohneText?.text).toContain("beschreibe");

    const ohneFoto = pruefeEntwurf(
      { fahrzeugId: "lkw", antworten: { bremse: antwort({ antwortJa: false, bemerkung: "quietscht" }) }, unterschrieben: true },
      [bremse],
      false,
    );
    expect(ohneFoto?.text).toContain("Foto");

    const ohneLosfahren = pruefeEntwurf(
      { fahrzeugId: "lkw", antworten: { bremse: antwort({ antwortJa: false, bemerkung: "quietscht", fotoPfade: ["a.jpg"] }) }, unterschrieben: true },
      [bremse],
      false,
    );
    expect(ohneLosfahren?.text).toContain("losfahren");
  });

  it("verlangt kein Foto, wenn der Punkt es nicht vorschreibt", () => {
    const ohneFotoPflicht = punkt({ id: "oel", foto_bei_mangel: false, mangel_stoppt: true });
    const entwurf = { fahrzeugId: "lkw", antworten: { oel: antwort({ antwortJa: false, bemerkung: "zu wenig" }) }, unterschrieben: true };
    expect(pruefeEntwurf(entwurf, [ohneFotoPflicht], false)).toBeNull();
  });

  it("verlangt Reifenfotos nur, wenn sie diesen Monat fällig sind", () => {
    const entwurf = { fahrzeugId: "lkw", antworten: { reifen: antwort({ antwortJa: false }) }, unterschrieben: true };
    expect(pruefeEntwurf(entwurf, [reifen], true)?.text).toBe("Bitte fotografiere diesen Monat alle Reifen.");
    expect(pruefeEntwurf(entwurf, [reifen], false)).toBeNull();
  });

  it("verlangt am Ende die Unterschrift", () => {
    const entwurf = { fahrzeugId: "lkw", antworten: { bremse: antwort({ antwortJa: true }) }, unterschrieben: false };
    expect(pruefeEntwurf(entwurf, [bremse], false)?.feld).toBe("unterschrift");
    expect(pruefeEntwurf({ ...entwurf, unterschrieben: true }, [bremse], false)).toBeNull();
  });
});
