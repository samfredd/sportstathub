"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { API_BASE, setSessionUser } from "@/lib/session";

function OAuthCallbackContent() {
  const router = useRouter();
  const params = useSearchParams();
  const [error, setError] = useState("");

  useEffect(() => {
    const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    const err = params.get("error") || hashParams.get("error");

    if (err) {
      queueMicrotask(() => setError(err));
      return;
    }

    // The backend already set the httpOnly auth cookie during the OAuth redirect.
    // Fetch the signed-in user (cookie is sent automatically) to populate the UI.
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${API_BASE}/api/me`, { credentials: "include" });
        if (!res.ok) throw new Error("not authenticated");
        const json = await res.json();
        if (cancelled) return;
        setSessionUser(json.data ?? json);
        router.replace("/dashboard");
      } catch {
        if (!cancelled) setError("Could not complete Google sign-in. Please try again.");
      }
    })();
    return () => { cancelled = true; };
  }, [params, router]);

  if (error) {
    return (
      <div className="card-premium p-6 sm:p-8 border-border text-center">
        <h1 className="text-2xl font-black text-foreground mb-2">Google Login Failed</h1>
        <p className="text-sm text-danger mb-6">{error}</p>
        <Link href="/auth/login" className="btn-gradient inline-flex px-5 py-3">
          Back to Sign In
        </Link>
      </div>
    );
  }

  return (
    <div className="card-premium p-6 sm:p-8 border-border text-center">
      <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin mx-auto mb-4" />
      <p className="text-sm text-muted font-bold">Completing Google login...</p>
    </div>
  );
}

export default function OAuthCallbackPage() {
  return (
    <Suspense fallback={<div className="text-center text-muted">Loading...</div>}>
      <OAuthCallbackContent />
    </Suspense>
  );
}
