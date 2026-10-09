import type { NextRequest } from "next/server";
import { kontrolleBericht } from "@/lib/kontrolle/bericht";
import { createClient } from "@/lib/supabase/server";

// PDF einer Kontrolle. Sichtbar für Verwalter der Firma und den Fahrer selbst (RLS).
export async function GET(_req: NextRequest, ctx: RouteContext<"/kontrolle/[kontrolleId]/pdf">) {
  const { kontrolleId } = await ctx.params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new Response("Bitte melde dich an.", { status: 401 });

  const bericht = await kontrolleBericht(supabase, kontrolleId);
  if (!bericht) return new Response("Kontrolle nicht gefunden.", { status: 404 });

  return new Response(Buffer.from(bericht.pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${bericht.dateiname}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
