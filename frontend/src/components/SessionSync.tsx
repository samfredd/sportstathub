"use client";

import { useEffect } from "react";
import { syncSession } from "@/lib/session";

// How often an open tab re-confirms its session while idle. Short enough
// that an actually-expired session (refresh token revoked/expired) doesn't
// keep showing "signed in" for long; long enough to not hammer /api/me.
const SYNC_INTERVAL_MS = 5 * 60_000;

/**
 * Mounted once in the root layout. Has no UI — it just keeps the localStorage
 * session descriptor honest by re-validating against the server on mount, on
 * an interval, and whenever the tab regains focus (the moment a stale session
 * is most likely to be visible to the user).
 */
export default function SessionSync() {
  useEffect(() => {
    void syncSession();

    const interval = setInterval(() => {
      void syncSession();
    }, SYNC_INTERVAL_MS);

    function onFocus() {
      void syncSession();
    }
    function onVisibilityChange() {
      if (document.visibilityState === "visible") void syncSession();
    }

    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      clearInterval(interval);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, []);

  return null;
}
