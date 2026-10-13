-- SP, Tacho-Prüfung und SP des Anhängers sind bei der Abfahrtskontrolle freiwillig (HU bleibt Pflicht).
-- Leere Angaben überschreiben bekannte Termine nicht.

create or replace function public.pruefdatum_frei(wert text, name text)
returns date language plpgsql stable set search_path = '' as $$
begin
  if nullif(btrim(wert), '') is null then
    return null;
  end if;
  return public.pruefdatum(wert, name);
end;
$$;

revoke execute on function public.pruefdatum_frei(text, text) from public, anon;

do $$
declare
  neu text := pg_get_functiondef('public.kontrolle_einreichen'::regproc);
  paar text[];
begin
  foreach paar slice 1 in array array[
    array[$a$sp := public.pruefdatum(fr ->> 'sp', 'SP');$a$, $a$sp := public.pruefdatum_frei(fr ->> 'sp', 'SP');$a$],
    array[$a$tacho := public.pruefdatum(fr ->> 'tacho', 'Tacho-Prüfung');$a$, $a$tacho := public.pruefdatum_frei(fr ->> 'tacho', 'Tacho-Prüfung');$a$],
    array[$a$anh_sp := public.pruefdatum(fr ->> 'anhaengerSp', 'SP des Anhängers');$a$, $a$anh_sp := public.pruefdatum_frei(fr ->> 'anhaengerSp', 'SP des Anhängers');$a$],
    array[$a$set hu_faellig = hu, sp_faellig = sp, tacho_faellig = tacho,$a$, $a$set hu_faellig = hu, sp_faellig = coalesce(sp, sp_faellig), tacho_faellig = coalesce(tacho, tacho_faellig),$a$],
    array[$a$update public.fahrzeuge set hu_faellig = anh_hu, sp_faellig = anh_sp$a$, $a$update public.fahrzeuge set hu_faellig = anh_hu, sp_faellig = coalesce(anh_sp, sp_faellig)$a$]
  ] loop
    if position(paar[1] in neu) = 0 then
      raise exception 'kontrolle_einreichen: Stelle nicht gefunden: %', paar[1];
    end if;
    neu := replace(neu, paar[1], paar[2]);
  end loop;
  execute neu;
end;
$$;
