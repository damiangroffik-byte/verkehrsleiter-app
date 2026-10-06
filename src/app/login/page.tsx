import { LoginFormular } from "./LoginFormular";

export default function LoginSeite() {
  return (
    <main className="flex flex-1 flex-col">
      <div className="border-b-4 border-marke-gelb bg-marke-blau px-5 py-8 text-white">
        <h1 className="font-titel text-2xl font-extrabold">Verkehrsleiter</h1>
        <p className="opacity-85">Anmeldung</p>
      </div>
      <div className="mx-auto w-full max-w-sm p-5">
        <LoginFormular />
      </div>
    </main>
  );
}
