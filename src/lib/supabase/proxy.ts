import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const OEFFENTLICH = ["/login", "/auth"];

// Erneuert die Supabase-Sitzung bei jeder Anfrage und schickt nicht
// angemeldete Nutzer zur Anmeldung.
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet, headers) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
          Object.entries(headers ?? {}).forEach(([key, value]) =>
            response.headers.set(key, value),
          );
        },
      },
    },
  );

  const { data } = await supabase.auth.getClaims();
  const angemeldet = Boolean(data?.claims);
  const pfad = request.nextUrl.pathname;

  if (!angemeldet && !OEFFENTLICH.some((p) => pfad.startsWith(p))) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  return response;
}
