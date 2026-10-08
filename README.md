# Verkehrsleiter-App

Web-App (installierbar wie eine App) für Verkehrsleiter und Fuhrparkleiter:
Abfahrtskontrolle, Führerscheinkontrolle, Unterweisungen. Fahrer öffnen sie
per Link auf dem Handy, der Verkehrsleiter am PC.

Konzept und Skizzen liegen im Claude-Projekt „Fuhrparkleiter Software“.

## Technik

- [Next.js](https://nextjs.org) 16 (App Router, Server Actions), Tailwind CSS 4
- [Supabase](https://supabase.com): Datenbank (Postgres), Login per E-Mail-Code,
  später Foto-Speicher. Region: Frankfurt (eu-central-1).
- Hosting: Vercel

Jede Firma ist ein eigener Bereich. Wer was sehen darf, regeln Zugriffsregeln
direkt in der Datenbank (Row Level Security), siehe `supabase/migrations/`.

## Einrichten

1. Supabase-Projekt anlegen (Region Frankfurt).
2. Im SQL-Editor den Inhalt von `supabase/migrations/0001_grundgeruest.sql` ausführen.
3. Unter Authentication > Email Templates im Template „Magic Link“ den Code
   einfügen, z. B. `Dein Anmeldecode: {{ .Token }}`. Die App meldet per
   6-stelligem Code an, nicht per Link.
4. `.env.example` nach `.env.local` kopieren und URL sowie Publishable Key aus
   Project Settings > API eintragen.
5. `npm install` und `npm run dev`, dann http://localhost:3000 öffnen.

## Rollen

- **Verkehrsleiter**: wer eine Firma anlegt, wird automatisch ihr Verkehrsleiter.
- **Unternehmer**: darf die Firma ebenfalls verwalten.
- **Fahrer**: wird vom Verwalter mit E-Mail angelegt und beim ersten Login
  automatisch mit seinem Konto verknüpft.
