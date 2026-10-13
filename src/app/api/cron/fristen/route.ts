import { createClient } from "@supabase/supabase-js";
import { ART_INFO, FAHRZEUG_SPALTEN, mailFaellig, type FristFahrzeug, type Regel } from "@/lib/fahrzeugfristen";
import { automatikBereit, empfaenger, fristMail } from "@/lib/fristMail";
import { tag } from "@/lib/fuehrerschein/regeln";
import { sendeMail } from "@/lib/mail";

type FirmaRegel = Regel & { firma_id: string };

// Täglich (Vercel Cron): Werkstatt-Mails für bald fällige Prüfungen, je Fälligkeit nur einmal.
export async function GET(request: Request) {
  if (!automatikBereit()) return Response.json({ fehler: "nicht eingerichtet" }, { status: 503 });
  if (request.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) return new Response("Nicht erlaubt", { status: 401 });

  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!, { auth: { persistSession: false } });
  const heute = tag(new Date());
  const { data: regeln, error } = await db
    .from("frist_regeln")
    .select("firma_id, art, vorwarnung_tage, mail_aktiv, mail_an, mail_betreff, mail_text, mail_tage")
    .eq("mail_aktiv", true)
    .returns<FirmaRegel[]>();
  if (error) return Response.json({ fehler: error.message }, { status: 500 });

  const ergebnis = { gesendet: 0, fehlgeschlagen: 0 };
  for (const firmaId of new Set((regeln ?? []).map((r) => r.firma_id))) {
    const [{ data: fahrzeuge }, { data: firma }] = await Promise.all([
      db.from("fahrzeuge").select(FAHRZEUG_SPALTEN).eq("firma_id", firmaId).eq("aktiv", true).returns<FristFahrzeug[]>(),
      db.from("firmen").select("name").eq("id", firmaId).maybeSingle(),
    ]);
    for (const regel of (regeln ?? []).filter((r) => r.firma_id === firmaId)) {
      const an = empfaenger(regel.mail_an);
      if (an.length === 0) continue;
      for (const fz of fahrzeuge ?? []) {
        const info = ART_INFO[regel.art];
        const datum = (fz[info.spalte] as string | null) ?? null;
        if (!info.gilt(fz) || !datum || !mailFaellig(datum, heute, regel.mail_tage)) continue;
        // Erst vermerken (eindeutig je Fahrzeug, Prüfart, Fälligkeit), dann senden: so geht keine Mail doppelt raus.
        const { data: vermerk, error: doppelt } = await db
          .from("frist_mails")
          .insert({ firma_id: firmaId, fahrzeug_id: fz.id, art: regel.art, faellig_am: datum, an: an.join(", ") })
          .select("id")
          .maybeSingle();
        if (doppelt || !vermerk) continue;
        const { betreff, text } = fristMail(regel, { kennzeichen: fz.kennzeichen, art: regel.art, datum, firma: firma?.name ?? "" });
        try {
          await sendeMail(an, betreff, text);
          ergebnis.gesendet += 1;
        } catch (e) {
          ergebnis.fehlgeschlagen += 1;
          await db.from("frist_mails").update({ fehler: e instanceof Error ? e.message.slice(0, 300) : "Versand fehlgeschlagen" }).eq("id", vermerk.id);
        }
      }
    }
  }
  return Response.json(ergebnis);
}
