import { createBrowserClient } from "@supabase/ssr";

// Client im Browser, z. B. für Foto- und Unterschrift-Uploads direkt in Storage.
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
  );
}
