"use client";

import { useState, useEffect } from "react";
import { communityApi } from "@/lib/communityApi";
import { getSessionUser } from "@/lib/session";

export type Plan = string | null;

export interface SubscriptionState {
  plan: Plan;
  status: string | null;
  expiresAt: string | null;
  loading: boolean;
  /** true if user has an active paid plan */
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
    // Optimistic hint from the non-sensitive descriptor, then confirm with the
    // server (auth travels in the httpOnly cookie, so /api/me is the source of truth).
    const hint = getSessionUser();
    if (!hint) {
      setState(current=>({...current,loading:false,isLoggedIn:false}));
      return;
    }
    if (hint?.role === "admin") {
      setState(s => ({ ...s, isLoggedIn: true, isAdmin: true, isPro: true, isFree: false }));
    }

    communityApi.getMe()
      .then((profile: any) => {
        const plan: Plan = profile.subscription_plan ?? "free";
        const status: string | null = profile.subscription_status ?? null;
        const expiresAt = profile.subscription_expires_at ?? null;
        const isAdmin = profile.role === "admin";
        const isActive = (status === "active" || status === "grace") && (!expiresAt || new Date(expiresAt).getTime() > Date.now());
        const isPaidPlan = !!plan && plan !== "free";
        const isPro = isAdmin || (isActive && isPaidPlan);
        setState({
          plan,
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
        // 401 → not authenticated (cookie missing/expired).
        setState(s => ({ ...s, loading: false, isLoggedIn: false }));
      });
  }, []);

  return state;
}
