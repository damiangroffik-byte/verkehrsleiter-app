"use client";

import Link from "next/link";
import { useState } from "react";
import { Karte } from "@/components/ui";
import { Unterschrift, alsPng } from "@/components/Unterschrift";
import { kategorie, monatJahr } from "@/lib/kontrolle/kategorien";
import { darfLosfahren, istSichtbar, pruefeEntwurf, reifenfotosFaellig, type Antwort } from "@/lib/kontrolle/regeln";
import { createClient } from "@/lib/supabase/browser";
import { kontrolleEinreichen } from "./actions";
import { EIGEN, KennzeichenWahl, Termin, aufloesen } from "./FahrzeugWahl";
import { PunktKarte, UvvZeile, inOrdnung, leer } from "./PunktKarte";
import type { KontrollEntwurf, KontrollFahrzeug, KontrollPruefpunkt, Prueftermine } from "./typen";

// fahrzeug → start (Übersicht) → eine Seite je Kategorie → abschluss → fertig
type Schritt = "fahrzeug" | "start" | "abschluss" | "fertig" | `kategorie:${string}`;

type Standort = KontrollEntwurf["standort"];

const keineTermine: Prueftermine = { hu: "", sp: "", tacho: "", anhaengerHu: "", anhaengerSp: "", ladebordwand: "", ameise: "" };

const WINTER = "Winterliche Verhältnisse";

export function KontrollAblauf({
  firmaId,
  vorname,
  fahrzeuge,
  anhaenger,
  pruefpunkte,
  standardArtId,
  reifenZuletzt,
  heute,
  winter,
}: {
  firmaId: string;
  vorname: string;
  fahrzeuge: KontrollFahrzeug[];
  anhaenger: KontrollFahrzeug[];
  pruefpunkte: KontrollPruefpunkt[];
  standardArtId: string | null;
  reifenZuletzt: Record<string, string>;
  heute: number;
  winter: boolean;
}) {
  const start = fahrzeuge.length === 1 ? fahrzeuge[0] : null;
  const [kontrolleId] = useState(() => crypto.randomUUID());
  const [schritt, setSchritt] = useState<Schritt>("fahrzeug");
  const [wahl, setWahl] = useState<string | null>(start ? start.id : fahrzeuge.length === 0 ? EIGEN : null);
  const [eingabe, setEingabe] = useState("");
  const [anhWahl, setAnhWahl] = useState<string | null>(null);
  const [anhEingabe, setAnhEingabe] = useState("");
  const [termine, setTermine] = useState<Prueftermine>({
    ...keineTermine,
    hu: start?.hu_faellig ?? "",
    sp: start?.sp_faellig ?? "",
    tacho: start?.tacho_faellig ?? "",
    ladebordwand: start?.ladebordwand_uvv_bis?.slice(0, 7) ?? "",
    ameise: start?.ameise_uvv_bis?.slice(0, 7) ?? "",
  });
  const [ausstattung, setAusstattung] = useState({ ladebordwand: start?.ladebordwand ?? false, ameise: start?.ameise ?? false });
  const [vorbelegt, setVorbelegt] = useState({ fahrzeug: start?.id ?? null, anhaenger: null as string | null });
  const [antworten, setAntworten] = useState<Record<string, Antwort>>({});
  const [offen, setOffen] = useState<Record<string, boolean>>({});
  const [unterschrift, setUnterschrift] = useState<HTMLCanvasElement | null>(null);
  const [standort, setStandort] = useState<Standort>(null);
  const [fehler, setFehler] = useState<{ text: string; pruefpunktId?: string } | null>(null);
  const [sendet, setSendet] = useState(false);
  const [ergebnis, setErgebnis] = useState<{ mitMangel: boolean; freigegeben: boolean } | null>(null);

  const ordner = `${firmaId}/${kontrolleId}`;
  const fz = aufloesen(wahl, eingabe, fahrzeuge, anhaenger, "ein Fahrzeug");
  const anh = aufloesen(anhWahl, anhEingabe, anhaenger, fahrzeuge, "einen Anhänger");
  const fahrzeug = fz?.fahrzeug ?? null;
  const gewaehlterAnhaenger = anh?.fahrzeug ?? null;
  const fahrzeugBereit = Boolean(fz && !fz.fehler);
  const reifenFaellig = fahrzeugBereit ? reifenfotosFaellig(fahrzeug ? (reifenZuletzt[fahrzeug.id] ?? null) : null, new Date(heute)) : false;

  // Prüftermine und Ausstattung mit den bekannten Werten vorbelegen, sobald ein anderes Fahrzeug gewählt ist.
  const fzSchluessel = fahrzeug?.id ?? null;
  const anhSchluessel = gewaehlterAnhaenger?.id ?? null;
  if (fzSchluessel !== vorbelegt.fahrzeug || anhSchluessel !== vorbelegt.anhaenger) {
    setVorbelegt({ fahrzeug: fzSchluessel, anhaenger: anhSchluessel });
    if (fzSchluessel !== vorbelegt.fahrzeug) {
      setAusstattung({ ladebordwand: fahrzeug?.ladebordwand ?? false, ameise: fahrzeug?.ameise ?? false });
    }
    setTermine((t) => ({
      ...t,
      ...(fzSchluessel !== vorbelegt.fahrzeug && {
        hu: fahrzeug?.hu_faellig ?? "",
        sp: fahrzeug?.sp_faellig ?? "",
        tacho: fahrzeug?.tacho_faellig ?? "",
        ladebordwand: fahrzeug?.ladebordwand_uvv_bis?.slice(0, 7) ?? "",
        ameise: fahrzeug?.ameise_uvv_bis?.slice(0, 7) ?? "",
      }),
      ...(anhSchluessel !== vorbelegt.anhaenger && {
        anhaengerHu: gewaehlterAnhaenger?.hu_faellig ?? "",
        anhaengerSp: gewaehlterAnhaenger?.sp_faellig ?? "",
      }),
    }));
  }

  const art = fahrzeug?.fahrzeugart_id ?? standardArtId;
  const lage = {
    adr: Boolean(fahrzeug?.adr || gewaehlterAnhaenger?.adr),
    mitAnhaenger: anh !== null,
    ladebordwand: ausstattung.ladebordwand,
    ameise: ausstattung.ameise,
    winter,
  };
  const derArt = pruefpunkte.filter((p) => p.fahrzeugart_id === art);
  const sichtbare = fahrzeugBereit ? derArt.filter((p) => istSichtbar(p, lage)) : [];
  // Winterpunkte außerhalb der Saison grau als Hinweis zeigen.
  const winterSpaeter = !winter && derArt.some((p) => p.bedingung === "winter");

  const gruppen = new Map<string, KontrollPruefpunkt[]>();
  for (const p of sichtbare) gruppen.set(p.abschnitt, [...(gruppen.get(p.abschnitt) ?? []), p]);
  const abschnitte = [...gruppen.entries()];
  const namen = abschnitte.map(([n]) => n);

  const erledigt = (punkte: KontrollPruefpunkt[]) => punkte.filter((p) => (antworten[p.id] ?? leer).antwortJa !== null).length;
  const fertigGesamt = erledigt(sichtbare);

  function antworte(id: string, teil: Partial<Antwort>) {
    setAntworten((a) => ({ ...a, [id]: { ...(a[id] ?? leer), ...teil } }));
    if (fehler?.pruefpunktId === id) setFehler(null);
  }

  function gehe(s: Schritt) {
    setFehler(null);
    setSchritt(s);
    window.scrollTo({ top: 0 });
  }

  function zeigeFehler(text: string, pruefpunktId?: string) {
    setFehler({ text, pruefpunktId });
    if (pruefpunktId) {
      const p = sichtbare.find((x) => x.id === pruefpunktId);
      if (p) setSchritt(`kategorie:${p.abschnitt}`);
      requestAnimationFrame(() =>
        document.getElementById(`punkt-${pruefpunktId}`)?.scrollIntoView({ behavior: "smooth", block: "center" }),
      );
    } else {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }

  // Fehlt etwas im ersten Schritt (Fahrzeug, Anhänger, Prüftermine)?
  function fahrzeugFehler(): string | null {
    if (!fz) return "Bitte wähle ein Fahrzeug oder tippe das Kennzeichen ein.";
    if (fz.fehler) return fz.fehler;
    if (anh?.fehler) return anh.fehler;
    const pflicht: [keyof Prueftermine, string][] = [
      ["hu", "HU"],
      ["sp", "SP"],
      ["tacho", "Tacho-Prüfung"],
      ...(anh ? ([["anhaengerHu", "HU des Anhängers"], ["anhaengerSp", "SP des Anhängers"]] as [keyof Prueftermine, string][]) : []),
    ];
    const fehlt = pflicht.find(([k]) => !termine[k]);
    return fehlt ? `Bitte trage den Termin für ${fehlt[1]} ein.` : null;
  }

  // UVV-Prüfplakette fehlt?
  function plakettenFehler(abschnitt: string): string | null {
    if (abschnitt === "UVV Ladebordwand" && ausstattung.ladebordwand && !termine.ladebordwand)
      return "Bitte trage ein, bis wann die UVV-Prüfplakette der Ladebordwand gültig ist.";
    if (abschnitt === "UVV Elektro-Niederhubwagen" && ausstattung.ameise && !termine.ameise)
      return "Bitte trage ein, bis wann die Prüfplakette der Elektro-Ameise gültig ist.";
    return null;
  }

  function weiterZurUebersicht() {
    const f = fahrzeugFehler();
    if (f) return zeigeFehler(f);
    // Standort im Hintergrund holen; lehnt der Fahrer ab, geht es ohne weiter.
    if (!standort && "geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => setStandort({ lat: pos.coords.latitude, lng: pos.coords.longitude, genauigkeit: pos.coords.accuracy }),
        () => {},
        { enableHighAccuracy: false, maximumAge: 10 * 60_000, timeout: 15_000 },
      );
    }
    gehe("start");
  }

  // Erste Kategorie mit offenen Punkten, sonst der Abschluss.
  function naechsteOffene(): Schritt {
    const n = abschnitte.find(([, punkte]) => erledigt(punkte) < punkte.length);
    return n ? `kategorie:${n[0]}` : "abschluss";
  }

  function kategorieFertig(abschnitt: string) {
    const punkte = gruppen.get(abschnitt) ?? [];
    const f = pruefeEntwurf({ fahrzeugId: EIGEN, antworten, unterschrieben: true }, punkte, reifenFaellig);
    if (f) return zeigeFehler(f.text, f.feld === "pruefpunkt" ? f.pruefpunktId : undefined);
    const plakette = plakettenFehler(abschnitt);
    if (plakette) return zeigeFehler(plakette);
    const i = namen.indexOf(abschnitt);
    gehe(i + 1 < namen.length ? `kategorie:${namen[i + 1]}` : "abschluss");
  }

  async function freigeben() {
    const vorn = fahrzeugFehler();
    if (vorn) {
      setSchritt("fahrzeug");
      return zeigeFehler(vorn);
    }
    const f = pruefeEntwurf({ fahrzeugId: EIGEN, antworten, unterschrieben: Boolean(unterschrift) }, sichtbare, reifenFaellig);
    if (f) return zeigeFehler(f.text, f.feld === "pruefpunkt" ? f.pruefpunktId : undefined);
    for (const n of namen) {
      const plakette = plakettenFehler(n);
      if (plakette) {
        setSchritt(`kategorie:${n}`);
        return zeigeFehler(plakette);
      }
    }
    if (!unterschrift || !fz) return;

    setSendet(true);
    setFehler(null);
    try {
      const durchgefuehrtAm = new Date().toISOString();
      const unterschriftPfad = `${ordner}/unterschrift.png`;
      const { error } = await createClient()
        .storage.from("kontrollen")
        .upload(unterschriftPfad, await alsPng(unterschrift), { contentType: "image/png", upsert: false });
      // Beim erneuten Senden liegt die Unterschrift schon in Storage.
      if (error && !/exists|duplicate/i.test(error.message)) throw error;

      const entwurf: KontrollEntwurf = {
        kontrolleId,
        firmaId,
        fahrzeugId: fahrzeug?.id ?? null,
        kennzeichen: fahrzeug ? null : fz.kennzeichen,
        anhaengerId: gewaehlterAnhaenger?.id ?? null,
        anhaengerKennzeichen: anh && !gewaehlterAnhaenger ? anh.kennzeichen : null,
        fristen: {
          ...termine,
          anhaengerHu: anh ? termine.anhaengerHu : "",
          anhaengerSp: anh ? termine.anhaengerSp : "",
          ladebordwand: ausstattung.ladebordwand ? termine.ladebordwand : "",
          ameise: ausstattung.ameise ? termine.ameise : "",
        },
        ausstattung,
        standort,
        durchgefuehrtAm,
        unterschriftPfad,
        antworten: sichtbare.map((p) => {
          const a = antworten[p.id] ?? leer;
          return {
            pruefpunktId: p.id,
            antwortJa: a.antwortJa === true,
            bemerkung: a.bemerkung.trim() || null,
            fotoPfade: a.fotoPfade,
            losfahren: inOrdnung(p, a) === false ? a.losfahren : null,
          };
        }),
      };
      const antwort = await kontrolleEinreichen(entwurf);
      if (!antwort.ok) {
        if (antwort.feld === "fristen" || antwort.feld === "fahrzeug" || antwort.feld === "anhaenger") setSchritt("fahrzeug");
        if (antwort.feld === "uvv") setSchritt(`kategorie:${namen.find((n) => kategorie(n).uvv) ?? namen[0]}`);
        const punkt = antwort.feld?.startsWith("pruefpunkt:") ? antwort.feld.slice("pruefpunkt:".length) : undefined;
        return zeigeFehler(antwort.fehler, punkt);
      }
      setErgebnis({ mitMangel: antwort.mitMangel, freigegeben: antwort.freigegeben });
      gehe("fertig");
    } catch {
      zeigeFehler("Die Kontrolle konnte nicht gesendet werden. Bitte prüfe die Verbindung und tippe noch einmal auf den Knopf.");
    } finally {
      setSendet(false);
    }
  }

  const fehlerZeile = fehler && (
    <p role="alert" className="rounded-xl border-2 border-mangel bg-white p-3 font-semibold text-mangel">
      {fehler.text}
    </p>
  );

  if (schritt === "fertig" && ergebnis) {
    return (
      <Karte titel={ergebnis.freigegeben ? "Abfahrt freigegeben" : "Nicht losfahren"}>
        {ergebnis.freigegeben ? (
          <p className="text-lg">
            Danke! Die Abfahrtskontrolle für <strong>{fz?.kennzeichen}</strong> ist gespeichert. Gute Fahrt!
          </p>
        ) : (
          <p className="rounded-xl border-2 border-mangel bg-mangel/5 p-3 font-semibold text-mangel">
            Die Kontrolle für {fz?.kennzeichen} ist gespeichert. Mit dem gemeldeten Mangel darfst du nicht losfahren. Dein Verkehrsleiter ist
            informiert und meldet sich.
          </p>
        )}
        {ergebnis.freigegeben && ergebnis.mitMangel && (
          <p className="rounded-xl border-2 border-warnung bg-white p-3 font-semibold text-warnung">
            Du fährst mit einem geringen Mangel. Dein Verkehrsleiter ist informiert.
          </p>
        )}
        <Link href="/fahrer" className="flex h-12 items-center justify-center rounded-xl bg-marke-gelb font-semibold text-marke-blau">
          Fertig
        </Link>
      </Karte>
    );
  }

  if (schritt === "fahrzeug") {
    return (
      <div className="flex flex-col gap-4">
        {fehlerZeile}
        <Karte titel="Fahrzeug">
          <KennzeichenWahl liste={fahrzeuge} wahl={wahl} onWahl={setWahl} eingabe={eingabe} onEingabe={setEingabe} aufgeloest={fz} />
        </Karte>

        <Karte titel="Anhänger">
          <KennzeichenWahl
            liste={anhaenger}
            wahl={anhWahl}
            onWahl={setAnhWahl}
            eingabe={anhEingabe}
            onEingabe={setAnhEingabe}
            aufgeloest={anh}
            ohne="Ohne Anhänger"
          />
        </Karte>

        {fz && (
          <>
            <Karte titel="Arbeitsgeräte">
              <p className="text-sm text-gray-600">Hat das Fahrzeug heute eine Ladebordwand oder eine Elektro-Ameise dabei?</p>
              <Schalter
                text="Ladebordwand (Hubladebühne)"
                an={ausstattung.ladebordwand}
                onChange={(ladebordwand) => setAusstattung((a) => ({ ...a, ladebordwand }))}
              />
              <Schalter
                text="Elektro-Ameise (Niederhubwagen) an Bord"
                an={ausstattung.ameise}
                onChange={(ameise) => setAusstattung((a) => ({ ...a, ameise }))}
              />
            </Karte>

            <Karte titel="Prüftermine">
              <p className="text-sm text-gray-600">Bitte prüfe die Termine und trage sie ein, wenn sie fehlen oder nicht stimmen.</p>
              <div className="grid grid-cols-1 gap-3">
                <Termin name="HU" wert={termine.hu} onChange={(hu) => setTermine((t) => ({ ...t, hu }))} heute={heute} />
                <Termin name="SP" wert={termine.sp} onChange={(sp) => setTermine((t) => ({ ...t, sp }))} heute={heute} />
                <Termin name="Tacho-Prüfung" wert={termine.tacho} onChange={(tacho) => setTermine((t) => ({ ...t, tacho }))} heute={heute} />
              </div>
              {anh && (
                <>
                  <p className="pt-2 text-sm font-semibold">Anhänger {anh.kennzeichen}</p>
                  <div className="grid grid-cols-1 gap-3">
                    <Termin name="HU" wert={termine.anhaengerHu} onChange={(anhaengerHu) => setTermine((t) => ({ ...t, anhaengerHu }))} heute={heute} />
                    <Termin name="SP" wert={termine.anhaengerSp} onChange={(anhaengerSp) => setTermine((t) => ({ ...t, anhaengerSp }))} heute={heute} />
                  </div>
                </>
              )}
            </Karte>
          </>
        )}

        <button type="button" onClick={weiterZurUebersicht} className="h-12 rounded-xl bg-marke-gelb font-semibold text-marke-blau">
          Weiter
        </button>
      </div>
    );
  }

  const kopf = (
    <div className="flex flex-col gap-3 rounded-2xl bg-marke-blau p-4 text-white">
      <p className="text-sm text-white/80">
        {new Date(heute).toLocaleDateString("de-DE", { timeZone: "Europe/Berlin", weekday: "long", day: "numeric", month: "long" })} ·{" "}
        {new Date(heute).toLocaleTimeString("de-DE", { timeZone: "Europe/Berlin", hour: "2-digit", minute: "2-digit" })}
      </p>
      <p className="font-titel text-2xl font-semibold">
        {gruss(heute)}
        {vorname ? `, ${vorname}` : ""}
      </p>
      <button
        type="button"
        onClick={() => gehe("fahrzeug")}
        className="flex min-h-12 items-center gap-3 rounded-xl bg-white/10 px-3 py-2 text-left"
      >
        <span aria-hidden className="text-2xl text-marke-gelb">
          ⛟
        </span>
        <span className="flex flex-1 flex-col">
          <span className="font-semibold">
            {fz?.kennzeichen}
            {anh ? ` + ${anh.kennzeichen}` : ""}
          </span>
          <span className="text-sm text-white/80">
            {[ausstattung.ladebordwand && "mit Ladebordwand", ausstattung.ameise && "Elektro-Ameise an Bord"].filter(Boolean).join(" · ") ||
              "ohne Arbeitsgeräte"}
          </span>
        </span>
        <span className="text-sm underline">ändern</span>
      </button>
    </div>
  );

  if (schritt === "start") {
    return (
      <div className="flex flex-col gap-4">
        {kopf}
        {fehlerZeile}
        <div className="flex items-baseline justify-between">
          <h2 className="font-titel text-lg font-semibold">HEUTIGE KONTROLLE</h2>
          <span className="text-sm text-gray-600">
            {fertigGesamt} von {sichtbare.length} Punkten
          </span>
        </div>
        <ul className="flex flex-col gap-2">
          {abschnitte.map(([name, punkte]) => {
            const k = kategorie(name);
            const n = erledigt(punkte);
            const alle = n === punkte.length;
            const maengel = punkte.filter((p) => inOrdnung(p, antworten[p.id] ?? leer) === false).length;
            return (
              <li key={name}>
                <button
                  type="button"
                  onClick={() => gehe(`kategorie:${name}`)}
                  className={`flex min-h-16 w-full items-center gap-3 rounded-2xl border-2 p-3 text-left shadow-sm ${k.uvv ? "border-marke-gelb bg-marke-gelb/15" : "border-transparent bg-white"}`}
                >
                  <span
                    aria-hidden
                    className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-xl ${alle ? (maengel ? "bg-mangel text-white" : "bg-ok text-white") : k.uvv ? "bg-marke-gelb text-marke-blau" : "bg-grund text-marke-blau"}`}
                  >
                    {alle ? (maengel ? "!" : "✓") : k.symbol}
                  </span>
                  <span className="flex flex-1 flex-col">
                    <span className="font-semibold">{name}</span>
                    <span className="text-sm text-gray-600">
                      {n > 0 ? `${n} / ${punkte.length} erledigt` : `${punkte.length} ${punkte.length === 1 ? "Punkt" : "Punkte"}`}
                      {maengel > 0 ? ` · ${maengel} Mangel` : k.uvv ? " · Pflicht für dieses Fahrzeug" : k.kurz ? ` · ${k.kurz}` : ""}
                    </span>
                  </span>
                  <span aria-hidden className="text-xl text-gray-400">
                    ›
                  </span>
                </button>
              </li>
            );
          })}
          {winterSpaeter && (
            <li className="flex min-h-16 items-center gap-3 rounded-2xl border-2 border-dashed border-gray-300 p-3 text-gray-500">
              <span aria-hidden className="flex h-11 w-11 items-center justify-center rounded-xl bg-white text-xl">
                ❄
              </span>
              <span className="flex flex-col">
                <span className="font-semibold">{WINTER}</span>
                <span className="text-sm">aktiv ab 1. November</span>
              </span>
            </li>
          )}
        </ul>
        <p className="flex items-center gap-2 text-sm text-gray-700">
          <span aria-hidden>▭</span> Fahrerkarte gesteckt? Gerät auf Arbeitszeit stellen.
        </p>
        <button type="button" onClick={() => gehe(naechsteOffene())} className="h-14 rounded-xl bg-marke-blau text-lg font-semibold text-white">
          {fertigGesamt === 0 ? "Kontrolle starten" : fertigGesamt === sichtbare.length ? "Zum Abschluss" : "Kontrolle fortsetzen"}
        </button>
      </div>
    );
  }

  if (schritt.startsWith("kategorie:")) {
    const name = schritt.slice("kategorie:".length);
    const punkte = gruppen.get(name) ?? [];
    const k = kategorie(name);
    const i = namen.indexOf(name);
    const n = erledigt(punkte);
    const naechste = namen[i + 1];
    const zeileProps = (p: KontrollPruefpunkt) => ({
      p,
      a: antworten[p.id] ?? leer,
      onChange: (teil: Partial<Antwort>) => antworte(p.id, teil),
      ordner,
      reifenFaellig,
      markiert: fehler?.pruefpunktId === p.id,
      zusatzOffen: Boolean(offen[p.id]),
      onZusatz: () => setOffen((o) => ({ ...o, [p.id]: true })),
    });
    return (
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-2 rounded-2xl bg-marke-blau p-4 text-white">
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => gehe("start")} aria-label="Zur Übersicht" className="-ml-2 h-11 w-11 text-2xl">
              ‹
            </button>
            <h2 className="font-titel text-xl font-semibold">{name}</h2>
          </div>
          <div className="flex justify-between text-sm text-white/80">
            <span>
              Schritt {i + 1} von {namen.length}
            </span>
            <span>
              {fertigGesamt} / {sichtbare.length} erledigt
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-white/20" aria-hidden>
            <div className="h-full rounded-full bg-marke-gelb" style={{ width: `${sichtbare.length ? (fertigGesamt / sichtbare.length) * 100 : 0}%` }} />
          </div>
        </div>
        {fehlerZeile}
        <p className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-gray-700">
          <span>🔒 Pflicht (BG / gesetzlich)</span>
          <span>
            <span aria-hidden className="text-marke-gelb">
              ●
            </span>{" "}
            vom Verkehrsleiter gewählt
          </span>
        </p>

        {k.uvv ? (
          <section className="overflow-hidden rounded-2xl bg-white shadow-sm">
            <div className="flex items-center gap-3 bg-marke-blau p-4 text-white">
              <span aria-hidden className="text-2xl text-marke-gelb">
                {k.symbol}
              </span>
              <span className="flex flex-1 flex-col">
                <span className="font-titel font-semibold uppercase">{name}</span>
                <span className="text-sm text-white/80">{k.kurz}</span>
              </span>
              <span className="rounded-md bg-marke-gelb px-2 py-0.5 text-xs font-semibold text-marke-blau">Pflicht</span>
            </div>
            <ul className="divide-y divide-gray-200">
              {punkte.map((p) => (
                <UvvZeile key={p.id} {...zeileProps(p)} />
              ))}
            </ul>
            <Plakette
              name={name === "UVV Ladebordwand" ? "UVV-Prüfplakette gültig bis" : "Prüfplakette gültig bis"}
              wert={name === "UVV Ladebordwand" ? termine.ladebordwand : termine.ameise}
              onChange={(wert) => setTermine((t) => (name === "UVV Ladebordwand" ? { ...t, ladebordwand: wert } : { ...t, ameise: wert }))}
              heute={heute}
            />
          </section>
        ) : (
          <ul className="flex flex-col gap-3">
            {punkte.map((p) => (
              <PunktKarte key={p.id} {...zeileProps(p)} />
            ))}
          </ul>
        )}

        <p className="text-center text-sm text-gray-600">
          {n} von {punkte.length} Punkten in dieser Kategorie erledigt
        </p>
        <button type="button" onClick={() => kategorieFertig(name)} className="h-12 rounded-xl bg-marke-gelb font-semibold text-marke-blau">
          {naechste ? `Weiter: ${naechste}` : "Weiter zum Abschluss"}
        </button>
        <button type="button" onClick={() => gehe("start")} className="h-11 text-sm underline">
          Zur Übersicht
        </button>
      </div>
    );
  }

  // Abschluss & Freigabe
  const maengel = sichtbare.filter((p) => inOrdnung(p, antworten[p.id] ?? leer) === false);
  const okZahl = sichtbare.filter((p) => inOrdnung(p, antworten[p.id] ?? leer) === true).length;
  const offenZahl = sichtbare.length - okZahl - maengel.length;
  const stopp = maengel.some((p) => darfLosfahren(p, antworten[p.id] ?? leer) === false);
  return (
    <div className="flex flex-col gap-4">
      {kopf}
      {fehlerZeile}
      <Karte titel="ABSCHLUSS & FREIGABE">
        <div className="grid grid-cols-3 gap-2 text-center">
          <Zahl wert={okZahl} text="in Ordnung" farbe="bg-ok/10 text-ok" />
          <Zahl wert={maengel.length} text="Mangel" farbe="bg-mangel/10 text-mangel" />
          <Zahl wert={offenZahl} text="offen" farbe="bg-grund text-gray-700" />
        </div>
        {offenZahl > 0 && (
          <button type="button" onClick={() => gehe(naechsteOffene())} className="h-11 text-left text-sm font-semibold text-marke-blau underline">
            Noch {offenZahl} offene Punkte beantworten
          </button>
        )}
        {maengel.map((p) => {
          const a = antworten[p.id] ?? leer;
          const los = darfLosfahren(p, a);
          return (
            <p key={p.id} className="rounded-xl bg-mangel/10 p-3 text-sm text-mangel">
              <strong>Mangel:</strong> {a.bemerkung.trim() || p.frage} – an Verkehrsleiter gemeldet,{" "}
              {los === false ? <strong>Fahrt gestoppt.</strong> : los ? "Fahrt mit geringem Mangel erlaubt." : "„Darf ich so losfahren?“ noch offen."}
            </p>
          );
        })}
        <p className="pt-2 text-sm font-semibold">Unterschrift Fahrer</p>
        <Unterschrift onChange={setUnterschrift} />
        <p className="text-sm text-gray-600">
          Ich bestätige, die Abfahrtskontrolle für {fz?.kennzeichen}
          {anh && ` und ${anh.kennzeichen}`} gewissenhaft durchgeführt zu haben. Zeitstempel
          {standort ? " und Standort werden" : " wird"} gespeichert.
        </p>
      </Karte>
      <button
        type="button"
        onClick={freigeben}
        disabled={sendet}
        className={`h-14 rounded-xl text-lg font-semibold disabled:opacity-60 ${stopp ? "bg-mangel text-white" : "bg-marke-gelb text-marke-blau"}`}
      >
        {sendet ? "Wird gesendet …" : stopp ? "Kontrolle abschließen – nicht losfahren" : "Abfahrt freigeben"}
      </button>
      <button type="button" onClick={() => gehe("start")} className="h-11 text-sm underline">
        Zur Übersicht
      </button>
    </div>
  );
}

function gruss(heute: number) {
  const teile = new Intl.DateTimeFormat("de-DE", { timeZone: "Europe/Berlin", hour: "numeric", hourCycle: "h23" }).formatToParts(heute);
  const h = Number(teile.find((t) => t.type === "hour")?.value ?? 12);
  return h < 11 ? "Guten Morgen" : h < 18 ? "Guten Tag" : "Guten Abend";
}

function Zahl({ wert, text, farbe }: { wert: number; text: string; farbe: string }) {
  return (
    <div className={`flex flex-col rounded-xl p-3 ${farbe}`}>
      <span className="font-titel text-3xl font-semibold">{wert}</span>
      <span className="text-sm">{text}</span>
    </div>
  );
}

function Schalter({ text, an, onChange }: { text: string; an: boolean; onChange: (an: boolean) => void }) {
  return (
    <button type="button" role="switch" aria-checked={an} onClick={() => onChange(!an)} className="flex min-h-12 items-center justify-between gap-3 text-left">
      <span className="font-semibold">{text}</span>
      <span aria-hidden className={`flex h-8 w-14 shrink-0 items-center rounded-full p-1 transition ${an ? "justify-end bg-ok" : "justify-start bg-gray-300"}`}>
        <span className="h-6 w-6 rounded-full bg-white shadow" />
      </span>
    </button>
  );
}

// Prüfplakette „gültig bis MM/JJJJ“ mit Hinweis, wenn sie bald abläuft.
function Plakette({ name, wert, onChange, heute }: { name: string; wert: string; onChange: (wert: string) => void; heute: number }) {
  let hinweis: { text: string; farbe: string } | null = null;
  if (wert) {
    const [j, m] = wert.split("-").map(Number);
    const ende = Date.UTC(j, m, 0, 23, 59);
    const tage = Math.ceil((ende - heute) / 86_400_000);
    hinweis =
      tage < 0
        ? { text: "Prüfplakette abgelaufen – bitte Verkehrsleiter informieren", farbe: "bg-mangel/10 text-mangel" }
        : tage <= 30
          ? { text: `Prüfplakette läuft ab in ${tage} Tagen`, farbe: "bg-marke-gelb/25 text-warnung" }
          : { text: `${name} ${monatJahr(wert)}`, farbe: "bg-ok/10 text-ok" };
  }
  return (
    <label className={`flex flex-col gap-2 p-4 text-sm font-semibold ${hinweis ? hinweis.farbe : "bg-mangel/5 text-mangel"}`}>
      <span>{hinweis ? hinweis.text : `${name} – bitte eintragen`}</span>
      <input
        type="month"
        value={wert}
        onChange={(e) => onChange(e.target.value)}
        className={`h-12 rounded-xl border bg-white px-3 text-base text-marke-blau-dunkel ${wert ? "border-gray-300" : "border-mangel"}`}
      />
    </label>
  );
}
