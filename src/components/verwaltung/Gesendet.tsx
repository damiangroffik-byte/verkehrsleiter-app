// Bestätigung nach dem Weitergeben eines Mangels.
export function Gesendet({ art }: { art: string }) {
  const text =
    art === "werkstatt"
      ? "Mail an die Werkstatt gesendet. Die Antwort kommt in dein E-Mail-Postfach."
      : art === "fahrer"
        ? "Der Fahrer ist informiert (in der App und per E-Mail)."
        : art === "fahrer-ohne-mail"
          ? "Der Fahrer sieht die Nachricht in seiner App. Eine E-Mail ging nicht raus (keine Adresse hinterlegt oder Versand fehlgeschlagen)."
          : null;
  if (!text) return null;
  return (
    <p role="status" className="rounded-xl border-2 border-ok bg-white p-3 font-semibold text-ok">
      {text}
    </p>
  );
}
