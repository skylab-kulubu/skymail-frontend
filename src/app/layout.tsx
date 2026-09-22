import type { Metadata, Viewport } from "next";
import { Geist_Mono, Space_Grotesk } from "next/font/google";
import Script from "next/script";
import { ThemeSync } from "@/components/layout/ThemeSync";
import { themeInitScript } from "@/lib/theme";
import "./globals.css";

const spaceGrotesk = Space_Grotesk({
  variable: "--font-sans-loaded",
  subsets: ["latin", "latin-ext"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: { default: "SkyMail", template: "%s · SkyMail" },
  description: "SKY LAB mail paneli: Mail template'ler, mail listeleri ve gönderimler.",
  icons: { icon: "/favicon.ico" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    // The theme script sets data-theme before React hydrates; without it the
    // tokens fall back to the dark theme.
    <html lang="tr" suppressHydrationWarning>
      <head>
        <Script id="theme-init" strategy="beforeInteractive">
          {themeInitScript}
        </Script>
      </head>
      <body className={`${spaceGrotesk.variable} ${geistMono.variable} antialiased`}>
        <ThemeSync />
        {children}
      </body>
    </html>
  );
}
