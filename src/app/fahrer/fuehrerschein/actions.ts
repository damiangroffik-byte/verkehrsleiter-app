"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { after } from "next/server";
import { istNachweis, NACHWEIS_INFO } from "@/lib/fahrerNachweise";
import { datumLesen } from "@/lib/fristErkennung";
import { erkennungBereit, fuehrerscheinLesen, type Erkannt } from "@/lib/fuehrerschein/erkennung";
import { fuehrerscheinMail, mailBereit, sendeMail } from "@/lib/mail";
import { createClient } from "@/lib/supabase/server";

export type FuehrerscheinEntwurf = {
  pruefungId: string;
  firmaId: string;
  fotoVorne: string | null;
  fotoHinten: string | null;
  klassen: string[];
  gueltigBis: string;
  code95Bis: string;
};

export type FuehrerscheinErgebnis = { ok: true } | { ok: false; fehler: string; feld?: string };

type Antwort = { pruefung_id: string; fahrer?: string; verkehrsleiter_emails: string[] };

export async function fuehrerscheinEinreichen(entwurf: FuehrerscheinEntwurf): Promise<FuehrerscheinErgebnis> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("fuehrerschein_einreichen", { p: entwurf });
  if (error) {
    // Eigene Fehler der Datenbankfunktion sind für den Fahrer formuliert (Code P0001).
    const eigen = error.code === "P0001";
    return {
      ok: false,
      fehler: eigen ? error.message : "Der Führerschein konnte nicht gespeichert werden. Bitte versuche es noch einmal.",
      feld: eigen ? (error.hint ?? undefined) : undefined,
    };
  }

  const ergebnis = data as Antwort;
  const basis = process.env.NEXT_PUBLIC_APP_URL ?? (await headers()).get("origin") ?? "";
  if (ergebnis.verkehrsleiter_emails.length > 0 && mailBereit()) {
    after(async () => {
      try {
        const { betreff, text } = fuehrerscheinMail({
          fahrer: ergebnis.fahrer ?? "Ein Fahrer",
          pruefLink: `${basis}/verwaltung/${entwurf.firmaId}/fuehrerschein/${ergebnis.pruefung_id}`,
        });
        await sendeMail(ergebnis.verkehrsleiter_emails, betreff, text);
      } catch (e) {
        console.error("Führerschein-Mail fehlgeschlagen", ergebnis.pruefung_id, e);
      }
    });
  }

  revalidatePath("/fahrer");
  revalidatePath("/fahrer/fuehrerschein");
  return { ok: true };
}

export type AuslesenErgebnis = { ok: true; werte: Erkannt } | { ok: false };

// Vorschlag für Klassen und Fristen aus den Fotos. Ohne API-Schlüssel oder bei
// unlesbaren Fotos kommt nichts zurück; der Fahrer füllt dann selbst aus.
export async function fuehrerscheinAuslesen(firmaId: string, fotoVorne: string, fotoHinten: string): Promise<AuslesenErgebnis> {
  if (!erkennungBereit()) return { ok: false };
  if (![fotoVorne, fotoHinten].every((p) => p.startsWith(`${firmaId}/`))) return { ok: false };

  const supabase = await createClient();
  // Herunterladen klappt nur mit Leserecht (eigene Fotos oder Verwalter), siehe Storage-Regeln.
  const [vorne, hinten] = await Promise.all(
    [fotoVorne, fotoHinten].map(async (p) => {
      const { data } = await supabase.storage.from("fuehrerscheine").download(p);
      return data ? new Uint8Array(await data.arrayBuffer()) : null;
    }),
  );
  if (!vorne || !hinten) return { ok: false };

  try {
    const werte = await fuehrerscheinLesen(vorne, hinten);
    return werte ? { ok: true, werte } : { ok: false };
  } catch (e) {
    console.error("Führerschein-Erkennung fehlgeschlagen", e instanceof Error ? e.message : e);
    return { ok: false };
  }
}

// Ablaufdatum eines Nachweises (Code 95/FQN, Fahrerkarte, ADR) vom Foto lesen; null, wenn nicht lesbar.
export async function nachweisAuslesen(firmaId: string, fahrerId: string, art: string, pfad: string): Promise<string | null> {
  if (!erkennungBereit() || !istNachweis(art) || !pfad.startsWith(`${firmaId}/${fahrerId}/`)) return null;
  const supabase = await createClient();
  const { data } = await supabase.storage.from("fahrernachweise").download(pfad);
  if (!data) return null;
  try {
    return await datumLesen(NACHWEIS_INFO[art].hinweis, new Uint8Array(await data.arrayBuffer()));
  } catch (e) {
    console.error("Nachweis-Erkennung fehlgeschlagen", e instanceof Error ? e.message : e);
    return null;
  }
}

export async function nachweisSpeichern(firmaId: string, art: string, datum: string, foto: string | null): Promise<{ ok: true } | { ok: false; fehler: string }> {
  if (!istNachweis(art) || !/^\d{4}-\d{2}-\d{2}$/.test(datum)) return { ok: false, fehler: "Bitte gib ein gültiges Datum ein." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("fahrer_nachweis_erfassen", { f: firmaId, art, datum, foto });
  if (error) return { ok: false, fehler: error.code === "P0001" ? error.message : "Speichern hat nicht geklappt. Bitte versuche es noch einmal." };
  revalidatePath("/fahrer", "layout");
  revalidatePath("/verwaltung", "layout");
  return { ok: true };
}
