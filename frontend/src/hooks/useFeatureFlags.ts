"use client";

import { useState, useEffect } from "react";

const BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
const LS_KEY = "ff_cache_v1";
const TTL_MS = 60 * 1000; // 1 minute — keep close to admin changes

export interface FeatureFlag {
  key: string;
  name: string;
  description: string | null;
  required_plan: "free" | "pro";
  is_enabled: boolean;
}

/** key → FeatureFlag */
export type FlagMap = Record<string, FeatureFlag>;

interface State {
  flags: FlagMap;
  loading: boolean;
}

let _cache: { flags: FlagMap; ts: number } | null = null;

export function useFeatureFlags(): State {
  const [state, setState] = useState<State>(() => {
    // Warm from in-memory cache on first render (avoids extra fetch in the same session)
    if (_cache && Date.now() - _cache.ts < TTL_MS) {
      return { flags: _cache.flags, loading: false };
    }
    return { flags: {}, loading: true };
  });

  useEffect(() => {
    // Already warm from memory
    if (_cache && Date.now() - _cache.ts < TTL_MS) {
      setState({ flags: _cache.flags, loading: false });
      return;
    }

    // Try localStorage
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (raw) {
        const { data, ts } = JSON.parse(raw) as { data: FlagMap; ts: number };
        if (Date.now() - ts < TTL_MS) {
          _cache = { flags: data, ts };
          setState({ flags: data, loading: false });
          return;
        }
      }
    } catch {}

    // Fetch from API
    fetch(`${BASE}/api/feature-flags`)
      .then((r) => r.json())
      .then((json) => {
        const arr: FeatureFlag[] = json.data ?? [];
        const flags: FlagMap = {};
        arr.forEach((f) => { flags[f.key] = f; });
        const ts = Date.now();
        _cache = { flags, ts };
        try { localStorage.setItem(LS_KEY, JSON.stringify({ data: flags, ts })); } catch {}
        setState({ flags, loading: false });
      })
      .catch(() => setState((s) => ({ ...s, loading: false })));
  }, []);

  return state;
}

/** Invalidate the in-memory + localStorage cache (call after admin updates a flag) */
export function invalidateFlagCache() {
  _cache = null;
  try { localStorage.removeItem(LS_KEY); } catch {}
}
