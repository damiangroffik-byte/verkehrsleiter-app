// Einheitliches Format für Kennzeichen: Großbuchstaben, Bindestrich nach dem Ort,
// keine Leerzeichen (z. B. "kn bc 333" → "KN-BC333"). Gleiche Regel in der Datenbank
// (public.kennzeichen_normal), damit Liste und eigene Eingaben zusammenpassen.

export function kennzeichenNormal(eingabe: string): string {
  let s = eingabe.toUpperCase().trim().replace(/\s+/g, " ");
  if (!s.includes("-")) s = s.replace(" ", "-");
  return s.replace(/\s/g, "").replace(/-+/g, "-").replace(/^-|-$/g, "");
}

// Ort (1–3 Buchstaben), Bindestrich, 1–2 Buchstaben, 1–4 Ziffern, optional E (Elektro) oder H (Oldtimer).
const MUSTER = /^[A-ZÄÖÜ]{1,3}-[A-Z]{1,2}[0-9]{1,4}[EH]?$/;

export function kennzeichenGueltig(kennzeichen: string): boolean {
  return MUSTER.test(kennzeichen);
}
