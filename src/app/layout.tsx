import type { Metadata, Viewport } from "next";
import { Space_Grotesk, Space_Mono } from "next/font/google";
import { ThemeScript } from "@skylab-kulubu/skylcn-ui";
import { ThemeSync } from "@/components/layout/ThemeSync";
import { themeMigrationScript } from "@/lib/theme";
import { Providers } from "./providers";
import "./globals.css";

// skylcn-ui's faces (ADR 0064: the products use Space Grotesk and Space Mono).
const sans = Space_Grotesk({
  variable: "--skylcn-font-sans",
  subsets: ["latin", "latin-ext"],
});

const mono = Space_Mono({
  variable: "--skylcn-font-mono",
  subsets: ["latin", "latin-ext"],
  weight: ["400", "700"],
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
    // The theme scripts set data-theme before React hydrates (src/lib/theme.ts).
    <html lang="tr" className={`${sans.variable} ${mono.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeMigrationScript }} />
        <ThemeScript />
      </head>
      <body className="antialiased">
        <Providers>
          <ThemeSync />
          {children}
        </Providers>
      </body>
    </html>
  );
}
