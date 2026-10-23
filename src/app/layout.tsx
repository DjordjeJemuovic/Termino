import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { AppearanceControls } from "@/components/ui/appearance-controls";
import { LocaleProvider } from "@/lib/i18n/locale-provider";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Termino — jednostavno zakazivanje",
  description:
    "Organizuj usluge, tim i termine na jednom mestu. Termino je jednostavan sistem za zakazivanje za salone i ordinacije.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="sr-Latn"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col"><LocaleProvider>{children}<AppearanceControls /></LocaleProvider></body>
    </html>
  );
}
