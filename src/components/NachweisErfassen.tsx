"use client";

import { nachweisAuslesen, nachweisSpeichern } from "@/app/fahrer/fuehrerschein/actions";
import { DatumErfassen } from "@/components/DatumErfassen";
import { NACHWEIS_INFO, type Nachweis } from "@/lib/fahrerNachweise";
import type { Stufe } from "@/lib/fahrzeugfristen";

// Ein Nachweis des Fahrers (Code 95/FQN, Fahrerkarte, ADR): Foto, Datum wird erkannt und beim Fahrer gespeichert.
export function NachweisErfassen({
  firmaId,
  fahrerId,
  art,
  datum,
  stufe,
  onGespeichert,
}: {
  firmaId: string;
  fahrerId: string;
  art: Nachweis;
  datum: string | null;
  stufe: Stufe;
  onGespeichert?: (datum: string) => void;
}) {
  const info = NACHWEIS_INFO[art];
  return (
    <DatumErfassen
      titel={info.titel}
      fotoText={info.foto}
      bucket="fahrernachweise"
      ordner={`${firmaId}/${fahrerId}`}
      praefix={art}
      datum={datum}
      // Freiwillige Nachweise ohne Datum nicht als Fehler zeigen.
      stufe={!info.pflicht && !datum ? "ok" : stufe}
      auslesen={(pfad) => nachweisAuslesen(firmaId, fahrerId, art, pfad)}
      speichern={(d, foto) => nachweisSpeichern(firmaId, art, d, foto)}
      onGespeichert={onGespeichert}
      zusatz={info.pflicht ? undefined : "Nur nötig, wenn du einen hast."}
    />
  );
}
