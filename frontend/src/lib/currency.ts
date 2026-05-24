"use client";

import { useEffect, useMemo, useState } from "react";

export const DISPLAY_CURRENCIES = [
  { code: "USD", label: "USD" },
  { code: "NGN", label: "NGN" },
  { code: "GBP", label: "GBP" },
  { code: "EUR", label: "EUR" },
] as const;

type DisplayCurrency = (typeof DISPLAY_CURRENCIES)[number]["code"];

const FALLBACK_RATES: Record<DisplayCurrency, number> = {
  USD: 1,
  NGN: 1500,
  GBP: 0.79,
  EUR: 0.92,
};

const CACHE_KEY = "sportstathub:usd-rates";
const SELECTED_KEY = "sportstathub:display-currency";
const RATE_MAX_AGE_MS = 12 * 60 * 60 * 1000;
const EURO_LOCALES = new Set(["AT", "BE", "CY", "DE", "EE", "ES", "FI", "FR", "GR", "HR", "IE", "IT", "LT", "LU", "LV", "MT", "NL", "PT", "SI", "SK"]);

function readBrowserLocale(): string {
  if (typeof navigator === "undefined") return "en-US";
  return navigator.language || navigator.languages?.[0] || "en-US";
}

function inferCurrencyFromLocale(locale: string): DisplayCurrency {
  const region = locale.split("-").pop()?.toUpperCase();
  if (region === "NG") return "NGN";
  if (region === "GB" || region === "UK") return "GBP";
  if (region && EURO_LOCALES.has(region)) return "EUR";
  return "USD";
}

function readSelectedCurrency(): DisplayCurrency {
  if (typeof window === "undefined") return "USD";
  const stored = window.localStorage.getItem(SELECTED_KEY);
  return DISPLAY_CURRENCIES.some((item) => item.code === stored) ? stored as DisplayCurrency : inferCurrencyFromLocale(readBrowserLocale());
}

export function useDisplayCurrency() {
  const [locale] = useState(() => readBrowserLocale());
  const [currency, setCurrencyState] = useState<DisplayCurrency>(() => readSelectedCurrency());
  const [rates, setRates] = useState<Record<string, number>>(FALLBACK_RATES);
  const [liveRates, setLiveRates] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function loadRates() {
      try {
        const cached = window.localStorage.getItem(CACHE_KEY);
        if (cached) {
          const parsed = JSON.parse(cached);
          if (Date.now() - parsed.ts < RATE_MAX_AGE_MS) {
            setRates({ ...FALLBACK_RATES, ...parsed.rates });
            setLiveRates(true);
            return;
          }
        }
        const res = await fetch("https://open.er-api.com/v6/latest/USD", { cache: "no-store" });
        const json = await res.json();
        if (!cancelled && json?.result === "success" && json?.rates) {
          setRates({ ...FALLBACK_RATES, ...json.rates });
          setLiveRates(true);
          window.localStorage.setItem(CACHE_KEY, JSON.stringify({ ts: Date.now(), rates: json.rates }));
        }
      } catch {
        if (!cancelled) setLiveRates(false);
      }
    }
    void loadRates();
    return () => {
      cancelled = true;
    };
  }, []);

  function setCurrency(next: DisplayCurrency) {
    setCurrencyState(next);
    if (typeof window !== "undefined") window.localStorage.setItem(SELECTED_KEY, next);
  }

  const formatter = useMemo(() => new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    maximumFractionDigits: currency === "NGN" ? 0 : 2,
  }), [currency, locale]);

  function formatUsd(amountUsd: number) {
    const rate = rates[currency] ?? 1;
    return formatter.format(Number(amountUsd) * rate);
  }

  return { currency, setCurrency, formatUsd, liveRates };
}
