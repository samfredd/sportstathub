"use client";

import { useState, useEffect } from "react";
import { communityApi } from "@/lib/communityApi";

export type Plan = "free" | "pro" | null;

export interface SubscriptionState {
  plan: Plan;
  status: string | null;
  expiresAt: string | null;
  loading: boolean;
  /** true if user has an active pro plan */
  isPro: boolean;
  /** true if user is on the free tier (or not logged in) */
  isFree: boolean;
  /** true if a token exists (user is logged in) */
  isLoggedIn: boolean;
  /** true if the logged-in user is an admin */
  isAdmin: boolean;
}

export function useSubscription(): SubscriptionState {
  const [state, setState] = useState<SubscriptionState>({
    plan: null,
    status: null,
    expiresAt: null,
    loading: true,
    isPro: false,
    isFree: true,
    isLoggedIn: false,
    isAdmin: false,
  });

  useEffect(() => {
    const token = typeof window !== "undefined"
      ? window.localStorage.getItem("token")
      : null;

    if (!token) {
      setState(s => ({ ...s, loading: false, isLoggedIn: false }));
      return;
    }

    communityApi.getMe()
      .then((profile: any) => {
        const plan: Plan = profile.subscription_plan ?? "free";
        const status: string | null = profile.subscription_status ?? null;
        const expiresAt = profile.subscription_expires_at ?? null;
        const isAdmin = profile.role === "admin";
        const isActive = status === "active" && (!expiresAt || new Date(expiresAt).getTime() > Date.now());
        const isPro = isAdmin || (isActive && plan === "pro");
        setState({
          plan: (plan === "pro" ? "pro" : "free") as Plan,
          status,
          expiresAt,
          loading: false,
          isPro,
          isFree: !isPro,
          isLoggedIn: true,
          isAdmin,
        });
      })
      .catch(() => {
        setState(s => ({ ...s, loading: false, isLoggedIn: !!token }));
      });
  }, []);

  return state;
}
