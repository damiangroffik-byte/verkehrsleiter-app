import { createClient } from "@supabase/supabase-js";
import { automatikBereit } from "@/lib/fristMail";
import { tag } from "@/lib/fuehrerschein/regeln";
import { grussText, naechsterGeburtstag, tageBisGeburtstag, wirdAlt } from "@/lib/geburtstag";
import { sendeMail } from "@/lib/mail";

type Einstellung = { firma_id: string; geburtstag_vorlauf_tage: number; geburtstag_text: string | null; firmen: { name: string } | null };
type Fahrer = { id: string; vorname: string; nachname: string; email: string | null; geburtsdatum: string };

// Täglich (Vercel Cron), nur für Firmen mit eingeschalteten Geburtstagen:
// Hinweis an die Verwaltung ab dem eingestellten Vorlauf, Glückwunsch an den Fahrer am Geburtstag. Je Geburtstag einmal.
export async function GET(request: Request) {
  if (!automatikBereit()) return Response.json({ fehler: "nicht eingerichtet" }, { status: 503 });
  if (request.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) return new Response("Nicht erlaubt", { status: 401 });

  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!, { auth: { persistSession: false } });
  const heute = tag(new Date());
  const { data: firmen, error } = await db
    .from("firma_einstellungen")
    .select("firma_id, geburtstag_vorlauf_tage, geburtstag_text, firmen(name)")
    .eq("geburtstag_aktiv", true)
    .returns<Einstellung[]>();
  if (error) return Response.json({ fehler: error.message }, { status: 500 });

  const ergebnis = { gesendet: 0, fehlgeschlagen: 0 };

  // Erst vermerken (eindeutig je Fahrer, Geburtstag, Art), dann senden: so geht keine Mail doppelt raus.
  async function einmal(firmaId: string, f: Fahrer, art: "hinweis" | "gruss", an: string[], betreff: string, text: string) {
    const { data: vermerk, error: doppelt } = await db
      .from("geburtstag_mails")
      .insert({ firma_id: firmaId, fahrer_id: f.id, geburtstag: naechsterGeburtstag(f.geburtsdatum, heute), art })
      .select("id")
      .maybeSingle();
    if (doppelt || !vermerk) return;
    try {
      await sendeMail(an, betreff, text);
      ergebnis.gesendet += 1;
    } catch (e) {
      ergebnis.fehlgeschlagen += 1;
      await db.from("geburtstag_mails").update({ fehler: e instanceof Error ? e.message.slice(0, 300) : "Versand fehlgeschlagen" }).eq("id", vermerk.id);
    }
  }

  for (const e of firmen ?? []) {
    const firma = e.firmen?.name ?? "";
    const { data: fahrer } = await db
      .from("fahrer")
      .select("id, vorname, nachname, email, geburtsdatum")
      .eq("firma_id", e.firma_id)
      .eq("aktiv", true)
      .not("geburtsdatum", "is", null)
      .returns<Fahrer[]>();
    const anstehend = (fahrer ?? []).filter((f) => tageBisGeburtstag(f.geburtsdatum, heute) <= e.geburtstag_vorlauf_tage);
    if (anstehend.length === 0) continue;
    const { data: verwaltung } = await db.rpc("verwalter_emails", { f: e.firma_id });
    const an = (verwaltung ?? []) as string[];

    for (const f of anstehend) {
      const tage = tageBisGeburtstag(f.geburtsdatum, heute);
      const datum = naechsterGeburtstag(f.geburtsdatum, heute).split("-").reverse().join(".");
      if (an.length > 0) {
        const wann = tage === 0 ? "heute" : tage === 1 ? "morgen" : `in ${tage} Tagen (am ${datum})`;
        await einmal(
          e.firma_id,
          f,
          "hinweis",
          an,
          `Geburtstag: ${f.vorname} ${f.nachname} am ${datum}`,
          `Hallo,\n\n${f.vorname} ${f.nachname} hat ${wann} Geburtstag und wird ${wirdAlt(f.geburtsdatum, heute)} Jahre alt.\n\nAm Geburtstag bekommt ${f.vorname} euren Glückwunsch in der App${f.email ? " und per E-Mail" : ""}.\n\nVerkehrsleiter-App`,
        );
      }
      if (tage === 0 && f.email) {
        await einmal(e.firma_id, f, "gruss", [f.email], `Alles Gute zum Geburtstag, ${f.vorname}!`, grussText(e.geburtstag_text, { vorname: f.vorname, firma }));
      }
    }
  }
  return Response.json(ergebnis);
}
