import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

// Ziel des Anmelde-Links aus der E-Mail. Solange Supabase die Standard-Mail
// ohne Code verschickt, meldet dieser Link an. Unterstützt den Link mit
// `code` (Standard) und mit `token_hash` (eigene Mail-Vorlage).
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;

  const supabase = await createClient();
  const { error } = code
    ? await supabase.auth.exchangeCodeForSession(code)
    : tokenHash && type
      ? await supabase.auth.verifyOtp({ token_hash: tokenHash, type })
      : { error: new Error("Kein Anmeldelink") };

  if (error) {
    return NextResponse.redirect(`${origin}/login?fehler=link`);
  }
  return NextResponse.redirect(`${origin}/`);
}
