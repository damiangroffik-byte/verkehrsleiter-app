import type { Metadata, Viewport } from "next";
import { Archivo, Source_Sans_3 } from "next/font/google";
import "./globals.css";

const titel = Archivo({
  variable: "--font-titel",
  subsets: ["latin"],
  weight: ["600", "800"],
});

const text = Source_Sans_3({
  variable: "--font-text",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Verkehrsleiter",
  description: "Abfahrtskontrolle, Führerscheinkontrolle und Unterweisungen",
  appleWebApp: { capable: true, title: "Verkehrsleiter", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  themeColor: "#0f227b",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="de" className={`${titel.variable} ${text.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col font-sans">{children}</body>
    </html>
  );
}
