import Link from "next/link";

const COLUMNS = [
  {
    heading: "Platform",
    links: [
      { href: "/",            label: "Matches" },
      { href: "/predictions", label: "Tips & Picks" },
      { href: "/codes",       label: "Booking Codes" },
      { href: "/rankings",    label: "Rankings" },
    ],
  },
  {
    heading: "Community",
    links: [
      { href: "/forum",      label: "Forum" },
      { href: "/stats",      label: "Stats" },
      { href: "/h2h",        label: "Head to Head" },
      { href: "/referees",   label: "Referees" },
    ],
  },
  {
    heading: "Account",
    links: [
      { href: "/auth/register", label: "Create Account" },
      { href: "/auth/login",    label: "Sign In" },
      { href: "/dashboard",     label: "Dashboard" },
      { href: "/contact",       label: "Contact" },
    ],
  },
];

const LEGAL = [
  { href: "/contact", label: "Privacy Policy" },
  { href: "/contact", label: "Terms of Service" },
  { href: "/contact", label: "Cookie Policy" },
  { href: "/contact", label: "Responsible Gambling" },
];

export default function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="mt-0 border-t border-border/50 bg-surface/50 backdrop-blur-sm pb-20 lg:pb-0">
      <div className="max-w-[1600px] mx-auto px-4 lg:px-6">

        {/* Main footer grid */}
        <div className="py-8 md:py-12 grid grid-cols-2 md:grid-cols-[2fr_1fr_1fr_1fr] gap-6 md:gap-10">

          {/* Brand column */}
          <div className="col-span-2 md:col-span-1 space-y-4">
            {/* Logo */}
            <Link href="/" className="flex items-center gap-3 group w-fit">
              <div className="w-10 h-10 bg-accent/10 border border-accent/20 rounded-xl flex items-center justify-center font-black text-accent text-xl shadow-glass group-hover:bg-accent/20 transition-all">
                S
              </div>
              <div className="flex flex-col justify-center">
                <span
                  className="text-foreground font-black text-base leading-none tracking-tight"
                  style={{ fontFamily: "var(--font-display, inherit)" }}
                >
                  SPORTSTATHUB
                </span>
                <span className="text-[9px] text-accent font-black uppercase tracking-[0.3em] mt-0.5">
                  Pro Terminal
                </span>
              </div>
            </Link>

            <p className="text-sm text-muted leading-relaxed max-w-[260px]">
              Expert football analytics, real-time scores, booking codes, and AI-powered predictions — all in one place.
            </p>

            {/* Social icons */}
            <div className="flex items-center gap-2 pt-1">
              {[
                { label: "X / Twitter", href: "#", svg: <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.744l7.73-8.835L1.254 2.25H8.08l4.259 5.623L18.244 2.25zm-1.161 17.52h1.833L7.084 4.126H5.117L17.083 19.77z" /> },
                { label: "Telegram",    href: "#", svg: <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" /> },
                { label: "Instagram",   href: "#", svg: <><rect x="2" y="2" width="20" height="20" rx="5" ry="5" /><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" /><line x1="17.5" y1="6.5" x2="17.51" y2="6.5" /></> },
              ].map(({ label, href, svg }) => (
                <a
                  key={label}
                  href={href}
                  aria-label={label}
                  className="w-8 h-8 rounded-lg bg-background border border-border/60 flex items-center justify-center text-muted hover:text-accent hover:border-accent/30 transition-all"
                >
                  <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="currentColor" stroke="none">
                    {svg}
                  </svg>
                </a>
              ))}
            </div>
          </div>

          {/* Link columns */}
          {COLUMNS.map((col) => (
            <div key={col.heading} className={`space-y-3 ${col.heading === "Account" ? "hidden sm:block" : ""}`}>
              <h4 className="text-[10px] font-black text-foreground uppercase tracking-[0.2em]">
                {col.heading}
              </h4>
              <ul className="space-y-2.5">
                {col.links.map(({ href, label }) => (
                  <li key={label}>
                    <Link
                      href={href}
                      className="text-[13px] text-muted hover:text-accent transition-colors font-medium"
                    >
                      {label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Disclaimer */}
        <div className="py-4 md:py-5 border-t border-border/40">
          <p className="text-[11px] text-muted/70 leading-relaxed max-w-3xl">
            <span className="font-bold text-muted">18+ only.</span> SportStatHub is for informational and entertainment purposes only. We do not accept bets or promote gambling. Always gamble responsibly. If gambling is causing you harm, visit{" "}
            <a href="https://www.begambleaware.org" target="_blank" rel="noopener noreferrer" className="underline hover:text-accent transition-colors">
              BeGambleAware.org
            </a>.
          </p>
        </div>

        {/* Bottom bar */}
        <div className="py-3 md:py-4 border-t border-border/30 flex flex-col sm:flex-row items-center justify-between gap-2 md:gap-3">
          <p className="text-[11px] text-muted/60">
            © {year} SportStatHub. All rights reserved.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-4">
            {LEGAL.map(({ href, label }) => (
              <Link
                key={label}
                href={href}
                className="text-[11px] text-muted/60 hover:text-accent transition-colors"
              >
                {label}
              </Link>
            ))}
          </div>
        </div>

      </div>
    </footer>
  );
}
