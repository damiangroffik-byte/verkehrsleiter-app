import { describe, expect, it } from "vitest";
import { kennzeichenGueltig, kennzeichenNormal } from "./kennzeichen";

describe("kennzeichenNormal", () => {
  it("schreibt groß, setzt den Bindestrich nach dem Ort und entfernt Leerzeichen", () => {
    expect(kennzeichenNormal("kn bc 333")).toBe("KN-BC333");
    expect(kennzeichenNormal("B CW 7157")).toBe("B-CW7157");
    expect(kennzeichenNormal(" kn-bc 333 ")).toBe("KN-BC333");
    expect(kennzeichenNormal("KN - BC333")).toBe("KN-BC333");
    expect(kennzeichenNormal("KN-BC333")).toBe("KN-BC333");
  });
});

describe("kennzeichenGueltig", () => {
  it("erkennt deutsche Kennzeichen im einheitlichen Format", () => {
    expect(kennzeichenGueltig("KN-BC333")).toBe(true);
    expect(kennzeichenGueltig("B-CW7157")).toBe(true);
    expect(kennzeichenGueltig("M-AB1E")).toBe(true);
    expect(kennzeichenGueltig("KNBC333")).toBe(false);
    expect(kennzeichenGueltig("KN-333")).toBe(false);
    expect(kennzeichenGueltig("")).toBe(false);
  });
});
