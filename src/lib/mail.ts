import nodemailer from "nodemailer";

// Mailversand über SMTP (IONOS). Ohne Zugangsdaten wird nichts verschickt.
function transport() {
  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASSWORT;
  if (!host || !user || !pass) return null;
  const port = Number(process.env.SMTP_PORT ?? 465);
  return nodemailer.createTransport({ host, port, secure: port === 465, auth: { user, pass } });
}

export function mailBereit() {
  return Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASSWORT);
}

export type Anhang = { filename: string; content: Buffer; contentType: string };

export async function sendeMail(an: string[], betreff: string, text: string, anhaenge: Anhang[] = []) {
  const t = transport();
  if (!t) throw new Error("SMTP ist nicht eingerichtet.");
  await t.sendMail({
    from: process.env.MAIL_ABSENDER ?? process.env.SMTP_USER,
    to: an.join(", "),
    subject: betreff,
    text,
    attachments: anhaenge,
  });
}

export type MangelMail = {
  kennzeichen: string;
  fahrer: string;
  zeitpunkt: string;
  frage: string;
  bemerkung: string | null;
  fotoLink: string | null;
  mangelLink: string;
};

export function mangelMail(m: MangelMail) {
  const zeit = new Date(m.zeitpunkt).toLocaleString("de-DE", { timeZone: "Europe/Berlin", dateStyle: "short", timeStyle: "short" });
  const betreff = `Mangel: ${m.kennzeichen} – ${m.frage}`;
  const text = [
    "Bei einer Abfahrtskontrolle wurde ein Mangel gemeldet.",
    "",
    `Fahrzeug: ${m.kennzeichen}`,
    `Fahrer: ${m.fahrer}`,
    `Zeitpunkt: ${zeit} Uhr`,
    `Prüfpunkt: ${m.frage}`,
    `Beschreibung: ${m.bemerkung ?? "–"}`,
    "",
    m.fotoLink ? `Foto (7 Tage gültig): ${m.fotoLink}` : "Foto: nicht verfügbar",
    `Mangel öffnen: ${m.mangelLink}`,
    "",
    "Der vollständige Bericht hängt als PDF an.",
  ].join("\n");
  return { betreff, text };
}

export function fuehrerscheinMail(m: { fahrer: string; pruefLink: string }) {
  return {
    betreff: `Führerschein zur Prüfung: ${m.fahrer}`,
    text: [
      `${m.fahrer} hat seinen Führerschein zur Kontrolle eingereicht.`,
      "",
      "Bitte prüfe die Fotos und bestätige oder lehne ab:",
      m.pruefLink,
    ].join("\n"),
  };
}
