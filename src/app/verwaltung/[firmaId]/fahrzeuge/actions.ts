"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { ART_INFO, ARTEN, istArt, type FristFahrzeug } from "@/lib/fahrzeugfristen";
import { empfaenger, fristMail } from "@/lib/fristMail";
import { mailBereit, sendeMail } from "@/lib/mail";
import { createClient } from "@/lib/supabase/server";

const DATUM = /^\d{4}-\d{2}-\d{2}$/;

function zurueck(ziel: string, meldung: { fehler?: string; gespeichert?: string }): never {
  const q = new URLSearchParams(meldung as Record<string, string>);
  redirect(`${ziel}?${q}`);
}

// Fristen und Ausstattung eines Fahrzeugs speichern (Verwalter).
export async function fahrzeugSpeichern(firmaId: string, fahrzeugId: string, formData: FormData) {
  const ziel = `/verwaltung/${firmaId}/fahrzeuge/${fahrzeugId}`;
  const supabase = await createClient();
  const { data: fz } = await supabase.from("fahrzeuge").select("*").eq("id", fahrzeugId).eq("firma_id", firmaId).maybeSingle<FristFahrzeug>();
  if (!fz) zurueck(ziel, { fehler: "Fahrzeug nicht gefunden." });

  const { error: e1 } = await supabase
    .from("fahrzeuge")
    .update({
      ist_anhaenger: formData.get("ist_anhaenger") === "on",
      adr: formData.get("adr") === "on",
      ladebordwand: formData.get("ladebordwand") === "on",
      ameise: formData.get("ameise") === "on",
    })
    .eq("id", fahrzeugId)
    .eq("firma_id", firmaId);
  if (e1) zurueck(ziel, { fehler: "Speichern hat nicht geklappt." });

  for (const art of ARTEN) {
    const feld = formData.get(`frist_${art}`);
    if (feld === null) continue;
    const neu = String(feld).trim();
    const alt = (fz![ART_INFO[art].spalte] as string | null) ?? "";
    if (neu === alt) continue;
    if (neu === "") {
      await supabase.from("fahrzeuge").update({ [ART_INFO[art].spalte]: null }).eq("id", fahrzeugId).eq("firma_id", firmaId);
      continue;
    }
    if (!DATUM.test(neu)) zurueck(ziel, { fehler: `Bitte prüfe das Datum bei ${ART_INFO[art].titel}.` });
    const { error } = await supabase.rpc("fahrzeug_frist_erfassen", { fz: fahrzeugId, art, datum: neu, foto: null });
    if (error) zurueck(ziel, { fehler: error.code === "P0001" ? error.message : "Speichern hat nicht geklappt." });
  }
  revalidatePath(`/verwaltung/${firmaId}`, "layout");
  revalidatePath("/fahrer", "layout");
  zurueck(ziel, { gespeichert: "1" });
}

// Erinnerung und Werkstatt-Mail für eine Prüfart einstellen (Verkehrsleiter).
export async function regelSpeichern(firmaId: string, art: string, formData: FormData) {
  const ziel = `/verwaltung/${firmaId}/fahrzeuge/erinnerungen`;
  if (!istArt(art)) zurueck(ziel, { fehler: "Unbekannte Prüfart." });
  const zahl = (name: string, standard: number) => {
    const n = Number(formData.get(name));
    return Number.isInteger(n) && n >= 0 && n <= 365 ? n : standard;
  };
  const mailAktiv = formData.get("mail_aktiv") === "on";
  const an = String(formData.get("mail_an") ?? "").trim();
  const text = String(formData.get("mail_text") ?? "").trim();
  if (mailAktiv && empfaenger(an).length === 0) zurueck(ziel, { fehler: `${ART_INFO[art as keyof typeof ART_INFO].titel}: Bitte gib eine gültige E-Mail-Adresse ein.` });
  if (mailAktiv && !text) zurueck(ziel, { fehler: `${ART_INFO[art as keyof typeof ART_INFO].titel}: Bitte schreibe einen Mailtext.` });

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("frist_regeln")
    .upsert({
      firma_id: firmaId,
      art,
      vorwarnung_tage: zahl("vorwarnung_tage", 30),
      mail_aktiv: mailAktiv,
      mail_an: an || null,
      mail_betreff: String(formData.get("mail_betreff") ?? "").trim() || null,
      mail_text: text || null,
      mail_tage: zahl("mail_tage", 42),
    })
    .select("art");
  if (error || !data?.length) zurueck(ziel, { fehler: "Speichern hat nicht geklappt. Nur der Verkehrsleiter kann das ändern." });
  revalidatePath(`/verwaltung/${firmaId}`, "layout");
  revalidatePath("/fahrer", "layout");
  zurueck(ziel, { gespeichert: art });
}

// Werkstatt-Mail für eine Frist sofort senden.
export async function mailJetztSenden(firmaId: string, fahrzeugId: string, art: string) {
  const ziel = `/verwaltung/${firmaId}/fahrzeuge/${fahrzeugId}`;
  if (!istArt(art)) zurueck(ziel, { fehler: "Unbekannte Prüfart." });
  if (!mailBereit()) zurueck(ziel, { fehler: "Der Mailversand ist noch nicht eingerichtet." });
  const supabase = await createClient();
  const [{ data: fz }, { data: regel }, { data: firma }] = await Promise.all([
    supabase.from("fahrzeuge").select("*").eq("id", fahrzeugId).eq("firma_id", firmaId).maybeSingle<FristFahrzeug>(),
    supabase.from("frist_regeln").select("mail_an, mail_betreff, mail_text").eq("firma_id", firmaId).eq("art", art).maybeSingle(),
    supabase.from("firmen").select("name").eq("id", firmaId).maybeSingle(),
  ]);
  const datum = fz ? ((fz[ART_INFO[art as keyof typeof ART_INFO].spalte] as string | null) ?? null) : null;
  const an = empfaenger(regel?.mail_an ?? null);
  if (!fz || !datum) zurueck(ziel, { fehler: "Für diese Prüfung ist noch kein Datum eingetragen." });
  if (an.length === 0) zurueck(ziel, { fehler: "Bitte hinterlege zuerst unter „Erinnerungen & E-Mails“ eine E-Mail-Adresse." });

  const { betreff, text } = fristMail(regel!, { kennzeichen: fz!.kennzeichen, art: art as never, datum: datum!, firma: firma?.name ?? "" });
  let fehler: string | null = null;
  try {
    await sendeMail(an, betreff, text);
  } catch (e) {
    fehler = e instanceof Error ? e.message : "Versand fehlgeschlagen";
  }
  await supabase.from("frist_mails").insert({ firma_id: firmaId, fahrzeug_id: fahrzeugId, art, faellig_am: datum, an: an.join(", "), automatisch: false, fehler });
  revalidatePath(ziel);
  zurueck(ziel, fehler ? { fehler: "Die Mail konnte nicht gesendet werden. Bitte später noch einmal versuchen." } : { gespeichert: "mail" });
}
