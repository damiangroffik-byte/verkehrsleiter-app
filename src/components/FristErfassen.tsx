"use client";

import { fristAuslesen, fristSpeichern } from "@/app/fahrer/pruefungen/actions";
import { DatumErfassen } from "@/components/DatumErfassen";
import { ART_INFO, type Art, type Stufe } from "@/lib/fahrzeugfristen";

// Eine Prüffrist am Fahrzeug: Foto der Plakette, Datum wird erkannt und am Fahrzeug gespeichert.
export function FristErfassen({
  firmaId,
  fahrzeugId,
  art,
  datum,
  stufe,
  onGespeichert,
}: {
  firmaId: string;
  fahrzeugId: string;
  art: Art;
  datum: string | null;
  stufe: Stufe;
  onGespeichert?: (datum: string) => void;
}) {
  return (
    <DatumErfassen
      titel={ART_INFO[art].titel}
      fotoText={ART_INFO[art].foto}
      bucket="fahrzeugfristen"
      ordner={`${firmaId}/${fahrzeugId}`}
      praefix={art}
      datum={datum}
      stufe={stufe}
      auslesen={(pfad) => fristAuslesen(firmaId, fahrzeugId, art, pfad)}
      speichern={(d, foto) => fristSpeichern(fahrzeugId, art, d, foto)}
      onGespeichert={onGespeichert}
      zusatz={ART_INFO[art].pflicht || datum ? undefined : "Freiwillig – kannst du später nachholen."}
    />
  );
}
