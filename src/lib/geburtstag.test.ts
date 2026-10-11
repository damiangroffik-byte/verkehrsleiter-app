import { describe, expect, it } from "vitest";
import { tageBisGeburtstag, wirdAlt } from "./geburtstag";

describe("Geburtstag", () => {
  it("zählt die Tage bis zum nächsten Geburtstag", () => {
    expect(tageBisGeburtstag("1985-10-16", "2026-10-11")).toBe(5);
    expect(tageBisGeburtstag("1985-10-11", "2026-10-11")).toBe(0);
    expect(tageBisGeburtstag("1985-10-10", "2026-10-11")).toBe(364);
    expect(tageBisGeburtstag("1990-01-02", "2026-12-30")).toBe(3);
  });

  it("29. Februar zählt in Nicht-Schaltjahren am 28.", () => {
    expect(tageBisGeburtstag("1996-02-29", "2027-02-26")).toBe(2);
    expect(tageBisGeburtstag("1996-02-29", "2028-02-26")).toBe(3);
  });

  it("nennt das neue Alter", () => {
    expect(wirdAlt("1985-10-16", "2026-10-11")).toBe(41);
    expect(wirdAlt("1990-01-02", "2026-12-30")).toBe(37);
  });
});
