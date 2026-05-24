"use client";

import { useState, useEffect } from "react";
import { communityApi } from "@/lib/communityApi";

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

function decodeJwt(token: string): { role?: string; exp?: number } | null {
  try {
    const payload = token.split(".")[1];
    const normalized = payload.replace(/-/g, "+").replace(/_/g, "/");
    return JSON.parse(atob(normalized)) as { role?: string; exp?: number };
  } catch {
    return null;
  }
}

function isValidAdminToken(token: string | null): boolean {
  if (!token) return false;
  const payload = decodeJwt(token);
  if (payload?.role !== "admin") return false;
  if (payload.exp && payload.exp * 1000 < Date.now()) return false;
  return true;
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

    const tokenIsAdmin = isValidAdminToken(token);
    if (tokenIsAdmin) {
      setState({
        plan: "admin",
        status: "active",
        expiresAt: null,
        loading: false,
        isPro: true,
        isFree: false,
        isLoggedIn: true,
        isAdmin: true,
      });
    }

    communityApi.getMe()
      .then((profile: any) => {
        const plan: Plan = profile.subscription_plan ?? "free";
        const status: string | null = profile.subscription_status ?? null;
        const expiresAt = profile.subscription_expires_at ?? null;
        const isAdmin = profile.role === "admin";
        const isActive = status === "active" && (!expiresAt || new Date(expiresAt).getTime() > Date.now());
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
        if (tokenIsAdmin) return;
        setState(s => ({ ...s, loading: false, isLoggedIn: !!token }));
      });
  }, []);

  return state;
}
