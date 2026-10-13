"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";

export type MenuePunkt = { href: string; titel: string; zahl?: number; genau?: boolean; auch?: string[] };

function istAktiv(pfad: string, p: MenuePunkt) {
  if (p.genau) return pfad === p.href;
  return [p.href, ...(p.auch ?? [])].some((h) => pfad === h || pfad.startsWith(`${h}/`));
}

function Zahl({ n }: { n?: number }) {
  if (!n) return null;
  return <span className="ml-auto min-w-6 rounded-full bg-mangel px-2 py-0.5 text-center text-xs font-bold text-white">{n}</span>;
}

// Seitenleiste am Computer.
export function MenueLeiste({ punkte }: { punkte: MenuePunkt[] }) {
  const pfad = usePathname();
  return (
    <ul className="flex flex-col gap-1">
      {punkte.map((p) => {
        const aktiv = istAktiv(pfad, p);
        return (
          <li key={p.href}>
            <Link
              href={p.href}
              aria-current={aktiv ? "page" : undefined}
              className={`flex min-h-11 items-center gap-2 rounded-lg border-l-4 px-3 text-[15px] ${aktiv ? "border-marke-gelb bg-white/12 font-semibold text-white" : "border-transparent text-white/80 hover:bg-white/8 hover:text-white"}`}
            >
              {p.titel}
              <Zahl n={p.zahl} />
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

// Waagerechte Leiste zum Wischen am Handy.
export function MenueHandy({ punkte }: { punkte: MenuePunkt[] }) {
  const pfad = usePathname();
  const liste = useRef<HTMLUListElement>(null);
  // Aktiven Punkt ins Bild schieben, wenn er rechts außerhalb liegt.
  useEffect(() => {
    liste.current?.querySelector('[aria-current="page"]')?.scrollIntoView({ inline: "center", block: "nearest" });
  }, [pfad]);
  return (
    <ul ref={liste} className="flex gap-2 overflow-x-auto px-4 pb-3 [scrollbar-width:none]">
      {punkte.map((p) => {
        const aktiv = istAktiv(pfad, p);
        return (
          <li key={p.href} className="shrink-0">
            <Link
              href={p.href}
              aria-current={aktiv ? "page" : undefined}
              className={`flex h-11 items-center gap-2 rounded-full px-4 text-sm font-semibold whitespace-nowrap ${aktiv ? "bg-marke-gelb text-marke-blau" : "bg-white/12 text-white"}`}
            >
              {p.titel}
              {p.zahl ? <span className="rounded-full bg-mangel px-1.5 text-xs text-white">{p.zahl}</span> : null}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
