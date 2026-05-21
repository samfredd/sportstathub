"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";

function OAuthCallbackContent() {
  const router = useRouter();
  const params = useSearchParams();
  const [error, setError] = useState("");

  useEffect(() => {
    const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    const token = params.get("token") || hashParams.get("token");
    const err = params.get("error") || hashParams.get("error");

    if (err) {
      queueMicrotask(() => setError(err));
      return;
    }

    if (!token) {
      queueMicrotask(() => setError("Missing OAuth token"));
      return;
    }

    try {
      window.localStorage?.setItem("token", token);
      window.dispatchEvent(new Event("storage"));
      router.replace("/dashboard");
    } catch {
      queueMicrotask(() => setError("Could not save the login session"));
    }
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
