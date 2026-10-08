"use server";

import { createClient } from "@/lib/supabase/server";

// Übernimmt die Sitzung aus dem Anmeldelink und speichert sie in Cookies.
export async function sitzungUebernehmen(accessToken: string, refreshToken: string) {
  const supabase = await createClient();
  const { error } = await supabase.auth.setSession({
    access_token: accessToken,
    refresh_token: refreshToken,
  });
  return { ok: !error };
}
