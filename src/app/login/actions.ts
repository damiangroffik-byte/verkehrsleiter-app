"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type LoginZustand = {
  schritt: "email" | "code";
  email: string;
  fehler?: string;
};

// Anmeldung per 6-stelligem Code aus der E-Mail. Funktioniert auch in der
// installierten App, weil kein Link im Mail-Programm geöffnet werden muss.
export async function sendeCode(
  _vorher: LoginZustand,
  formData: FormData,
): Promise<LoginZustand> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (!email.includes("@")) {
    return { schritt: "email", email, fehler: "Bitte eine gültige E-Mail-Adresse eingeben." };
  }

  const supabase = await createClient();
  const origin = (await headers()).get("origin");
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: origin ? `${origin}/auth/callback` : undefined },
  });
  if (error) {
    return { schritt: "email", email, fehler: "Der Code konnte nicht gesendet werden. Bitte später erneut versuchen." };
  }
  return { schritt: "code", email };
}

export async function pruefeCode(
  vorher: LoginZustand,
  formData: FormData,
): Promise<LoginZustand> {
  const token = String(formData.get("code") ?? "").replace(/\s/g, "");
  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({
    email: vorher.email,
    token,
    type: "email",
  });
  if (error) {
    return { ...vorher, fehler: "Der Code ist falsch oder abgelaufen." };
  }
  redirect("/");
}

export async function abmelden() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
