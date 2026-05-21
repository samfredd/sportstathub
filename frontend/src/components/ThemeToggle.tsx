"use client";

import { useState, useEffect } from "react";
import { MoonIcon, SunIcon } from "./Icons";

function resolveInitialDark(): boolean {
  if (typeof window === "undefined") return true;
  const stored = localStorage.getItem("theme");
  return stored === "dark" || (!stored && window.matchMedia("(prefers-color-scheme: dark)").matches);
}

export default function ThemeToggle({ className = "" }: { className?: string }) {
  const [isDark, setIsDark] = useState(true);

  useEffect(() => {
    const dark = resolveInitialDark();
    document.documentElement.classList.toggle("dark", dark);
    setIsDark(dark);
  }, []);

  function toggle() {
    const next = !isDark;
    document.documentElement.classList.toggle("dark", next);
    try { localStorage.setItem("theme", next ? "dark" : "light"); } catch {}
    setIsDark(next);
  }

  return (
    <button
      onClick={toggle}
      aria-label="Toggle theme"
      className={`p-2 rounded-xl text-muted hover:text-accent hover:bg-accent/10 transition-all cursor-pointer ${className}`}
    >
      {isDark
        ? <MoonIcon className="w-4 h-4 transition-transform duration-300" />
        : <SunIcon  className="w-4 h-4 transition-transform duration-300" />
      }
    </button>
  );
}
