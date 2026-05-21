import "./globals.css";

export const metadata = {
  title: "SportStatHub — Football Analytics & Stats",
  description: "Real-time football stats, scores, booking codes, and AI-powered predictions.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" suppressHydrationWarning>
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
        <main className="flex-1 w-full relative">
          {children}
        </main>
      </body>
    </html>
  );
}
