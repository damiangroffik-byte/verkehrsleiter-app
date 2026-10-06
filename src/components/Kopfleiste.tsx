import Link from "next/link";
import { abmelden } from "@/app/login/actions";

export function Kopfleiste({
  titel,
  untertitel,
  zurueck,
}: {
  titel: string;
  untertitel?: string;
  zurueck?: string;
}) {
  return (
    <header className="flex items-center gap-3 border-b-4 border-marke-gelb bg-marke-blau px-5 py-4 text-white">
      {zurueck && (
        <Link href={zurueck} aria-label="Zurück" className="-ml-2 flex h-11 w-11 items-center justify-center">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M15 6l-6 6 6 6" />
          </svg>
        </Link>
      )}
      <div className="flex flex-1 flex-col">
        <h1 className="font-titel text-xl font-extrabold">{titel}</h1>
        {untertitel && <p className="text-sm opacity-85">{untertitel}</p>}
      </div>
      <form action={abmelden}>
        <button type="submit" className="h-11 rounded-lg px-3 text-sm underline">
          Abmelden
        </button>
      </form>
    </header>
  );
}
