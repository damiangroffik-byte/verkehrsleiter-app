"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { after } from "next/server";
import { kontrolleBericht } from "@/lib/kontrolle/bericht";
import { mailBereit, mangelMail, sendeMail, type Anhang } from "@/lib/mail";
import { createClient } from "@/lib/supabase/server";
import type { EinreichenErgebnis, KontrollEntwurf } from "./typen";

type Ergebnis = {
  kontrolle_id: string;
  kennzeichen?: string;
  fahrer?: string;
  maengel: { id: string; frage: string; bemerkung: string | null; foto_pfad: string | null }[];
  verkehrsleiter_emails: string[];
};

export async function kontrolleEinreichen(entwurf: KontrollEntwurf): Promise<EinreichenErgebnis> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("kontrolle_einreichen", { p: entwurf });
  if (error) {
    // Eigene Fehler der Datenbankfunktion sind für den Fahrer formuliert (Code P0001).
    const eigen = error.code === "P0001";
    return {
      ok: false,
      fehler: eigen ? error.message : "Die Kontrolle konnte nicht gespeichert werden. Bitte versuche es noch einmal.",
      feld: eigen ? (error.hint ?? undefined) : undefined,
    };
  }

  const ergebnis = data as Ergebnis;
  const basis = process.env.NEXT_PUBLIC_APP_URL ?? (await headers()).get("origin") ?? "";

  // Mails nach der Antwort verschicken, damit der Fahrer nicht wartet.
  // Schlägt der Versand fehl, bleibt gemailt_am leer und wird später nachgeholt.
  if (ergebnis.maengel.length > 0 && ergebnis.verkehrsleiter_emails.length > 0 && mailBereit()) {
    after(async () => {
      const gesendet: string[] = [];
      // Bericht einmal erzeugen und an jede Mangel-Mail hängen; ohne PDF geht die Mail trotzdem raus.
      const anhaenge: Anhang[] = [];
      try {
        const bericht = await kontrolleBericht(supabase, ergebnis.kontrolle_id);
        if (bericht) anhaenge.push({ filename: bericht.dateiname, content: Buffer.from(bericht.pdf), contentType: "application/pdf" });
      } catch (e) {
        console.error("PDF-Bericht fehlgeschlagen", ergebnis.kontrolle_id, e);
      }
      for (const m of ergebnis.maengel) {
        try {
          const foto = m.foto_pfad
            ? (await supabase.storage.from("kontrollen").createSignedUrl(m.foto_pfad, 7 * 24 * 3600)).data?.signedUrl ?? null
            : null;
          const { betreff, text } = mangelMail({
            kennzeichen: ergebnis.kennzeichen ?? "",
            fahrer: ergebnis.fahrer ?? "",
            zeitpunkt: entwurf.durchgefuehrtAm,
            frage: m.frage,
            bemerkung: m.bemerkung,
            fotoLink: foto,
            mangelLink: `${basis}/verwaltung/${entwurf.firmaId}`,
          });
          await sendeMail(ergebnis.verkehrsleiter_emails, betreff, text, anhaenge);
          gesendet.push(m.id);
        } catch (e) {
          console.error("Mangel-Mail fehlgeschlagen", m.id, e);
        }
      }
      if (gesendet.length > 0) await supabase.rpc("maengel_gemailt", { ids: gesendet });
    });
  }

  revalidatePath("/fahrer");
  return { ok: true, kontrolleId: ergebnis.kontrolle_id, mitMangel: ergebnis.maengel.length > 0 };
}
