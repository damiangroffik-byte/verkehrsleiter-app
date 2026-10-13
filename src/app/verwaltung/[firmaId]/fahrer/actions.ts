"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { empfaenger } from "@/lib/fristMail";
import { mailBereit, sendeMail } from "@/lib/mail";

// Nachricht an einen, mehrere oder alle Fahrer: in der App und auf Wunsch per E-Mail.
export async function nachrichtSenden(firmaId: string, formData: FormData) {
  const ziel = `/verwaltung/${firmaId}/fahrer`;
  const fehler = (t: string) => redirect(`${ziel}?fehler=${encodeURIComponent(t)}#nachricht`);
  const betreff = String(formData.get("betreff") ?? "").trim().slice(0, 150);
  const text = String(formData.get("text") ?? "").trim().slice(0, 5000);
  const mail = formData.get("mail") === "on";
  if (!betreff || !text) fehler("Bitte Betreff und Text ausfüllen.");

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const gewaehlt = formData.getAll("fahrer").map(String);
  let abfrage = supabase.from("fahrer").select("id, email").eq("firma_id", firmaId).eq("aktiv", true);
  if (formData.get("alle") !== "on") abfrage = abfrage.in("id", gewaehlt.length > 0 ? gewaehlt : ["00000000-0000-0000-0000-000000000000"]);
  const { data: fahrer } = await abfrage.returns<{ id: string; email: string | null }[]>();
  if (!fahrer || fahrer.length === 0) fehler("Bitte mindestens einen Fahrer auswählen.");

  const { data: zeilen, error } = await supabase
    .from("mangel_nachrichten")
    .insert(fahrer!.map((f) => ({ firma_id: firmaId, art: "allgemein", fahrer_id: f.id, an: mail ? empfaenger(f.email).join(", ") || null : null, betreff, text })))
    .select("id, fahrer_id, an");
  if (error || !zeilen) fehler("Senden hat nicht geklappt. Bitte noch einmal versuchen.");

  let ohneMail = 0;
  for (const z of zeilen!) {
    const an = empfaenger(z.an);
    if (!mail) continue;
    if (an.length === 0 || !mailBereit()) {
      ohneMail += 1;
      continue;
    }
    try {
      await sendeMail(an, betreff, text, [], user?.email ?? undefined);
    } catch (e) {
      ohneMail += 1;
      await supabase.from("mangel_nachrichten").update({ fehler: e instanceof Error ? e.message.slice(0, 300) : "Versand fehlgeschlagen" }).eq("id", z.id);
    }
  }
  revalidatePath(`/verwaltung/${firmaId}`, "layout");
  revalidatePath("/fahrer", "layout");
  redirect(`${ziel}?gesendet=${zeilen!.length}&ohne_mail=${ohneMail}#nachricht`);
}
