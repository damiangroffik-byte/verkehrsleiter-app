"use client";

import { useActionState } from "react";
import { pruefeCode, sendeCode, type LoginZustand } from "./actions";

const start: LoginZustand = { schritt: "email", email: "" };

export function LoginFormular() {
  const [zustand, formAction, pending] = useActionState(
    async (vorher: LoginZustand, formData: FormData) =>
      vorher.schritt === "email" ? sendeCode(vorher, formData) : pruefeCode(vorher, formData),
    start,
  );

  return (
    <form action={formAction} className="flex flex-col gap-4">
      {zustand.schritt === "email" ? (
        <label className="flex flex-col gap-1 text-sm">
          E-Mail-Adresse
          <input
            name="email"
            type="email"
            autoComplete="email"
            required
            defaultValue={zustand.email}
            className="h-12 rounded-xl border border-gray-300 bg-white px-3 text-base"
          />
        </label>
      ) : (
        <label className="flex flex-col gap-1 text-sm">
          <span>
            Wir haben eine E-Mail an {zustand.email} geschickt. Tippe dort auf
            „Sign in“, auf diesem Gerät. Enthält die Mail einen Code, gib ihn
            hier ein.
          </span>
          <input
            name="code"
            inputMode="numeric"
            autoComplete="one-time-code"
            required
            className="h-12 rounded-xl border border-gray-300 bg-white px-3 text-lg tracking-widest"
          />
        </label>
      )}
      {zustand.fehler && <p className="text-sm text-mangel">{zustand.fehler}</p>}
      <button
        type="submit"
        disabled={pending}
        className="h-12 rounded-xl bg-marke-gelb font-semibold text-marke-blau"
      >
        {zustand.schritt === "email" ? "Anmeldelink anfordern" : "Anmelden"}
      </button>
    </form>
  );
}
