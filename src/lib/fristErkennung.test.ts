import { describe, expect, it } from "vitest";
import { jahreSpaeter, zuDatum } from "./fristErkennung";

describe("fristErkennung", () => {
  it("rechnet zum Prüftag 2 Jahre dazu", () => {
    expect(jahreSpaeter("2026-10-13", 2)).toBe("2028-10-13");
    expect(jahreSpaeter("2024-02-29", 2)).toBe("2026-02-28");
  });

  it("nimmt ohne Tag das Monatsende", () => {
    expect(zuDatum({ lesbar: true, jahr: 26, monat: 2, tag: null })).toBe("2026-02-28");
    expect(zuDatum({ lesbar: false, jahr: 2026, monat: 2, tag: 1 })).toBeNull();
  });
});
