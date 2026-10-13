"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { kontrolleBericht } from "@/lib/kontrolle/bericht";
import { empfaenger } from "@/lib/fristMail";
import { mailBereit, sendeMail, type Anhang } from "@/lib/mail";
import { berlinZeitpunkt, terminText } from "@/lib/mangelWeitergeben";

// Mangel auf „erledigt“ (mit freiwilligem Vermerk) oder zurück auf „offen“ setzen.
export async function mangelStatus(firmaId: string, mangelId: string, erledigt: boolean, zurueck: string, formData: FormData) {
  const supabase = await createClient();
  const { error } = erledigt
    ? await supabase.rpc("mangel_schliessen", { mangel_id: mangelId, vermerk: String(formData.get("vermerk") ?? "").slice(0, 500) })
    : await supabase.rpc("mangel_oeffnen", { mangel_id: mangelId });
  // Nur Pfade innerhalb der eigenen Firma als Rücksprung.
  const ziel = zurueck.startsWith(`/verwaltung/${firmaId}/`) ? zurueck : `/verwaltung/${firmaId}/maengel`;
  if (error) redirect(`${ziel}?fehler=${encodeURIComponent(error.code === "P0001" ? error.message : "Speichern hat nicht geklappt. Bitte noch einmal versuchen.")}`);
  revalidatePath(`/verwaltung/${firmaId}`, "layout");
  redirect(ziel);
}

type MangelDaten = {
  id: string;
  kontrolle_id: string;
  fahrzeug: { kennzeichen: string } | null;
  antwort: { frage: string; bemerkung: string | null; foto_pfade: string[] } | null;
  firma: { name: string } | null;
};

async function mangelLaden(firmaId: string, mangelId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: m } = await supabase
    .from("maengel")
    .select("id, kontrolle_id, fahrzeug:fahrzeuge(kennzeichen), antwort:antworten(frage, bemerkung, foto_pfade), firma:firmen(name)")
    .eq("id", mangelId)
    .eq("firma_id", firmaId)
    .maybeSingle<MangelDaten>();
  return { supabase, user, m };
}

function zielVon(firmaId: string, zurueck: string) {
  return zurueck.startsWith(`/verwaltung/${firmaId}/`) ? zurueck : `/verwaltung/${firmaId}/maengel`;
}

const fehlerZiel = (ziel: string, text: string) => `${ziel}?fehler=${encodeURIComponent(text)}`;

// Mail an die Werkstatt mit dem Kontrollbericht als PDF. Antworten der Werkstatt gehen an den Absender.
export async function mailAnWerkstatt(firmaId: string, mangelId: string, zurueck: string, formData: FormData) {
  const ziel = zielVon(firmaId, zurueck);
  const { supabase, user, m } = await mangelLaden(firmaId, mangelId);
  if (!m) redirect(fehlerZiel(ziel, "Mangel nicht gefunden."));
  if (!mailBereit()) redirect(fehlerZiel(ziel, "Der Mailversand ist noch nicht eingerichtet."));

  const werkstattId = String(formData.get("werkstatt_id") ?? "");
  let werkstatt: { id: string; name: string; email: string | null } | null = null;
  if (werkstattId) {
    const { data } = await supabase.from("werkstaetten").select("id, name, email").eq("id", werkstattId).eq("firma_id", firmaId).maybeSingle();
    werkstatt = data;
  }
  const an = empfaenger(werkstatt?.email ?? String(formData.get("email") ?? ""));
  const betreff = String(formData.get("betreff") ?? "").trim().slice(0, 200);
  const text = String(formData.get("text") ?? "").trim().slice(0, 5000);
  if (an.length === 0) redirect(fehlerZiel(ziel, "Bitte eine Werkstatt mit E-Mail-Adresse wählen oder eine Adresse eingeben."));
  if (!betreff || !text) redirect(fehlerZiel(ziel, "Betreff und Text dürfen nicht leer sein."));

  const { data: vermerk, error } = await supabase
    .from("mangel_nachrichten")
    .insert({ firma_id: firmaId, mangel_id: mangelId, art: "werkstatt", werkstatt_id: werkstatt?.id ?? null, werkstatt_name: werkstatt?.name ?? null, an: an.join(", "), betreff, text })
    .select("id")
    .single();
  if (error || !vermerk) redirect(fehlerZiel(ziel, "Speichern hat nicht geklappt. Bitte noch einmal versuchen."));

  const anhaenge: Anhang[] = [];
  try {
    const bericht = await kontrolleBericht(supabase, m.kontrolle_id);
    if (bericht) anhaenge.push({ filename: bericht.dateiname, content: Buffer.from(bericht.pdf), contentType: "application/pdf" });
  } catch (e) {
    console.error("PDF-Bericht fehlgeschlagen", m.kontrolle_id, e);
  }
  // Fotos der Beschädigung als eigene Bilder, damit die Werkstatt sie direkt sieht.
  if (formData.get("fotos") === "on") {
    const pfade = (m.antwort?.foto_pfade ?? []).slice(0, 5);
    const fotos = await Promise.all(pfade.map((p) => supabase.storage.from("kontrollen").download(p).then((r) => r.data)));
    for (const [i, f] of fotos.entries()) {
      if (!f) continue;
      const typ = f.type || "image/jpeg";
      const endung = typ.includes("png") ? "png" : typ.includes("webp") ? "webp" : "jpg";
      anhaenge.push({ filename: `Foto-${m.fahrzeug?.kennzeichen ?? "Mangel"}-${i + 1}.${endung}`, content: Buffer.from(await f.arrayBuffer()), contentType: typ });
    }
  }
  try {
    await sendeMail(an, betreff, text, anhaenge, user?.email ?? undefined);
  } catch (e) {
    await supabase.from("mangel_nachrichten").update({ fehler: e instanceof Error ? e.message.slice(0, 300) : "Versand fehlgeschlagen" }).eq("id", vermerk.id);
    redirect(fehlerZiel(ziel, "Die Mail konnte nicht gesendet werden. Bitte später noch einmal versuchen."));
  }
  revalidatePath(`/verwaltung/${firmaId}`, "layout");
  redirect(`${ziel}?gesendet=werkstatt`);
}

// Termin an den Fahrer: Nachricht in seiner App und, wenn hinterlegt, per E-Mail.
export async function fahrerInformieren(firmaId: string, mangelId: string, zurueck: string, formData: FormData) {
  const ziel = zielVon(firmaId, zurueck);
  const { supabase, user, m } = await mangelLaden(firmaId, mangelId);
  if (!m) redirect(fehlerZiel(ziel, "Mangel nicht gefunden."));

  const fahrerId = String(formData.get("fahrer_id") ?? "");
  const werkstattId = String(formData.get("werkstatt_id") ?? "");
  const text = String(formData.get("text") ?? "").trim().slice(0, 5000);
  const termin = berlinZeitpunkt(String(formData.get("datum") ?? ""), String(formData.get("uhrzeit") ?? ""));
  const [{ data: fahrer }, { data: werkstatt }] = await Promise.all([
    supabase.from("fahrer").select("id, vorname, email").eq("id", fahrerId).eq("firma_id", firmaId).maybeSingle<{ id: string; vorname: string; email: string | null }>(),
    werkstattId
      ? supabase.from("werkstaetten").select("id, name").eq("id", werkstattId).eq("firma_id", firmaId).maybeSingle<{ id: string; name: string }>()
      : Promise.resolve({ data: null }),
  ]);
  if (!fahrer) redirect(fehlerZiel(ziel, "Bitte einen Fahrer auswählen."));
  if (!text) redirect(fehlerZiel(ziel, "Der Text darf nicht leer sein."));

  const betreff = `Werkstatttermin ${m.fahrzeug?.kennzeichen ?? ""}${termin ? `: ${terminText(termin)} Uhr` : ""}`.trim();
  const an = empfaenger(fahrer.email);
  const { data: vermerk, error } = await supabase
    .from("mangel_nachrichten")
    .insert({
      firma_id: firmaId,
      mangel_id: mangelId,
      art: "fahrer",
      fahrer_id: fahrer.id,
      werkstatt_id: werkstatt?.id ?? null,
      werkstatt_name: werkstatt?.name ?? null,
      an: an.join(", ") || null,
      termin,
      betreff,
      text,
    })
    .select("id")
    .single();
  if (error || !vermerk) redirect(fehlerZiel(ziel, "Speichern hat nicht geklappt. Bitte noch einmal versuchen."));

  let hinweis = "fahrer";
  if (an.length > 0 && mailBereit()) {
    try {
      await sendeMail(an, betreff, text, [], user?.email ?? undefined);
    } catch (e) {
      hinweis = "fahrer-ohne-mail";
      await supabase.from("mangel_nachrichten").update({ fehler: e instanceof Error ? e.message.slice(0, 300) : "Versand fehlgeschlagen" }).eq("id", vermerk.id);
    }
  } else {
    hinweis = "fahrer-ohne-mail";
  }
  revalidatePath(`/verwaltung/${firmaId}`, "layout");
  revalidatePath("/fahrer", "layout");
  redirect(`${ziel}?gesendet=${hinweis}`);
}
