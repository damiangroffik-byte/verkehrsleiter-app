import { describe, expect, it } from "vitest";
import { berlinZeitpunkt, fahrerText, mangelName, tagText, werkstattBetreff, werkstattText } from "./mangelWeitergeben";

describe("mangelWeitergeben", () => {
  it("entfernt das Fragezeichen", () => {
    expect(mangelName("Reifen, Räder, Felgen beschädigt?")).toBe("Reifen, Räder, Felgen beschädigt");
    expect(werkstattBetreff({ kennzeichen: "B-CW7157", frage: "Beleuchtung beschädigt?" })).toBe("Reparaturanfrage B-CW7157: Beleuchtung beschädigt");
  });

  it("schreibt die Werkstatt-Mail mit Beschreibung", () => {
    const t = werkstattText({ kennzeichen: "B-CW7157", frage: "Reifen beschädigt?", bemerkung: "Riss", festgestellt: "2026-10-09T06:00:00Z", firma: "Testfirma" });
    expect(t).toContain("am 9.10.2026");
    expect(t).toContain("Beschreibung: Riss");
    expect(t.endsWith("Testfirma")).toBe(true);
  });

  it("nennt Wochentag, Uhrzeit und Werkstatt", () => {
    expect(tagText("2026-10-14")).toBe("Mittwoch, 14.10.2026");
    const t = fahrerText({
      vorname: "Max",
      datum: "2026-10-14",
      uhrzeit: "07:30",
      kennzeichen: "B-CW7157",
      frage: "Reifen beschädigt?",
      werkstatt: { name: "Reifen Müller", adresse: "Hauptstr. 1, Berlin", telefon: null },
      firma: "Testfirma",
    });
    expect(t).toContain("bitte fahre am Mittwoch, 14.10.2026 um 07:30 Uhr mit B-CW7157 zur Werkstatt:\nReifen Müller\nHauptstr. 1, Berlin");
    expect(t).toContain("Grund: Reifen beschädigt");
  });

  it("rechnet deutsche Ortszeit in UTC um", () => {
    expect(berlinZeitpunkt("2026-07-01", "08:00")).toBe("2026-07-01T06:00:00.000Z");
    expect(berlinZeitpunkt("2026-12-01", "08:00")).toBe("2026-12-01T07:00:00.000Z");
    expect(berlinZeitpunkt("2026-12-01", "")).toBeNull();
  });
});
