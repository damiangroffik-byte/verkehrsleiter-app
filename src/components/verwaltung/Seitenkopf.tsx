import Link from "next/link";
import type { ReactNode } from "react";

// Kopf jeder Verwaltungsseite: Pfad, Titel und rechts die wichtigste Aktion.
export function Seitenkopf({ pfad = [], titel, untertitel, children }: { pfad?: { titel: string; href?: string }[]; titel: string; untertitel?: string; children?: ReactNode }) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-3">
      <div className="flex min-w-0 flex-col gap-1">
        {pfad.length > 0 && (
          <nav aria-label="Pfad" className="flex flex-wrap items-center gap-1 text-sm text-gray-600">
            {pfad.map((p, i) => (
              <span key={i} className="flex items-center gap-1">
                {i > 0 && <span aria-hidden>›</span>}
                {p.href ? (
                  <Link href={p.href} className="hover:underline">
                    {p.titel}
                  </Link>
                ) : (
                  <span>{p.titel}</span>
                )}
              </span>
            ))}
          </nav>
        )}
        <h1 className="font-titel text-2xl font-extrabold sm:text-3xl">{titel}</h1>
        {untertitel && <p className="text-gray-600">{untertitel}</p>}
      </div>
      {children && <div className="flex flex-wrap gap-2">{children}</div>}
    </header>
  );
}
