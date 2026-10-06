import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

// Neuer Client pro Anfrage, niemals zwischen Anfragen teilen.
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // In Server Components dürfen keine Cookies gesetzt werden.
            // Der Proxy erneuert die Sitzung, daher ist das unkritisch.
          }
        },
      },
    },
  );
}
