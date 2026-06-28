import "./globals.css";
import { Inter, Archivo } from "next/font/google";

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

export default function RootLayout({ children }) {
  return (
    <html lang="en" suppressHydrationWarning className={`${inter.variable} ${archivo.variable}`}>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              try {
                if (localStorage.theme === 'dark' || (!('theme' in localStorage) && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
                  document.documentElement.classList.add('dark')
                } else {
                  document.documentElement.classList.remove('dark')
                }
              } catch (_) {}
            `,
          }}
        />
      </head>
      <body className="min-h-screen flex flex-col bg-background text-foreground antialiased">
        <a href="#main-content" className="skip-link">Skip to content</a>
        <main id="main-content" className="flex-1 w-full relative">
          {children}
        </main>
      </body>
    </html>
  );
}
