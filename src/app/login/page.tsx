import { LoginFormular } from "./LoginFormular";

export default async function LoginSeite({ searchParams }: PageProps<"/login">) {
  const { fehler } = await searchParams;

  return (
    <main className="flex flex-1 flex-col">
      <div className="border-b-4 border-marke-gelb bg-marke-blau px-5 py-8 text-white">
        <h1 className="font-titel text-2xl font-extrabold">Verkehrsleiter</h1>
        <p className="opacity-85">Anmeldung</p>
      </div>
      <div className="mx-auto w-full max-w-sm p-5">
        {fehler === "link" && (
          <p className="mb-4 text-sm text-mangel">
            Der Anmeldelink ist abgelaufen oder wurde schon benutzt. Bitte fordere
            eine neue E-Mail an, im selben Browser.
          </p>
        )}
        <LoginFormular />
      </div>
    </main>
  );
}
