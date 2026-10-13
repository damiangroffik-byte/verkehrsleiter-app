import { ausfuellen, STANDARD_BETREFF, STANDARD_TEXT, type Art, type Regel } from "./fahrzeugfristen";

// Empfänger: mehrere Adressen mit Komma oder Semikolon getrennt.
export function empfaenger(an: string | null): string[] {
  return (an ?? "")
    .split(/[;,\s]+/)
    .map((a) => a.trim())
    .filter((a) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(a));
}

export function fristMail(regel: Pick<Regel, "mail_betreff" | "mail_text">, w: { kennzeichen: string; art: Art; datum: string; firma: string }) {
  return {
    betreff: ausfuellen(regel.mail_betreff?.trim() || STANDARD_BETREFF, w),
    text: ausfuellen(regel.mail_text?.trim() || STANDARD_TEXT, w),
  };
}

export function automatikBereit() {
  return Boolean(process.env.CRON_SECRET && process.env.SUPABASE_SECRET_KEY && process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASSWORT);
}
