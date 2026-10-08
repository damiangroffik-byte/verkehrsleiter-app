"use client";

import { useEffect, useState } from "react";
import { sitzungUebernehmen } from "./actions";

// Ziel des Anmeldelinks aus der Standard-Mail. Die Zugangsdaten stehen hinter
// dem # in der Adresse, das sieht nur der Browser. Dadurch klappt der Link
// auf jedem Gerät, nicht nur dort, wo die Mail angefordert wurde.
export default function AnmeldelinkSeite() {
  const [fehler, setFehler] = useState(false);

  useEffect(() => {
    const werte = new URLSearchParams(window.location.hash.slice(1));
    const accessToken = werte.get("access_token");
    const refreshToken = werte.get("refresh_token");
    if (!accessToken || !refreshToken) {
      window.location.replace("/login?fehler=link");
      return;
    }
    sitzungUebernehmen(accessToken, refreshToken).then(({ ok }) => {
      if (ok) window.location.replace("/");
      else setFehler(true);
    });
  }, []);

  return (
    <main className="flex flex-1 items-center justify-center p-5 text-center">
      {fehler ? (
        <p className="text-mangel">
          Die Anmeldung hat nicht geklappt. <a href="/login" className="underline">Neu anmelden</a>
        </p>
      ) : (
        <p>Du wirst angemeldet …</p>
      )}
    </main>
  );
}
