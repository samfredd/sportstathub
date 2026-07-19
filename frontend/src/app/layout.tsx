import "./globals.css";
import { Inter, Archivo } from "next/font/google";
import { connection } from "next/server";
import SessionSync from "@/components/SessionSync";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

// Sporty, confident display face for headings/scores — replaces the techy
// "terminal" feel of Rajdhani.
const archivo = Archivo({
  subsets: ["latin"],
  variable: "--font-archivo",
  weight: ["500", "600", "700", "800", "900"],
  display: "swap",
});

export const metadata = {
  title: "SportStatHub — Football Analytics & Stats",
  description: "Real-time football stats, scores, booking codes, and AI-powered predictions.",
};

export default async function RootLayout({ children }) {
  // Nonce-based CSP requires request-time rendering so Next can attach the
  // proxy-generated nonce to framework and page scripts.
  await connection();
  return (
    <html lang="en" suppressHydrationWarning className={`${inter.variable} ${archivo.variable}`}>
      <body className="min-h-screen flex flex-col bg-background text-foreground antialiased">
        <SessionSync />
        <a href="#main-content" className="skip-link">Skip to content</a>
        <main id="main-content" className="flex-1 w-full relative">
          {children}
        </main>
      </body>
    </html>
  );
}
