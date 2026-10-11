// Erscheint sofort nach dem Antippen, solange die nächste Seite lädt.
export default function Laden() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-3 p-5" aria-busy="true">
      <span className="h-10 w-10 animate-spin rounded-full border-4 border-marke-gelb border-t-marke-blau" />
      <p className="font-semibold text-marke-blau">Wird geladen …</p>
    </main>
  );
}
