-- Hilfsfunktionen nicht für Nicht-Angemeldete freigeben.
-- Die Trigger-Funktion braucht niemand direkt aufzurufen.
revoke execute on function public.firma_ersteller_eintragen() from public, anon, authenticated;
revoke execute on function public.ist_mitglied(uuid) from public, anon;
revoke execute on function public.ist_verwalter(uuid) from public, anon;
grant execute on function public.ist_mitglied(uuid) to authenticated;
grant execute on function public.ist_verwalter(uuid) to authenticated;
