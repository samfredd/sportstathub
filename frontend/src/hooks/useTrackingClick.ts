"use client";
import { useCallback } from "react";
import { communityApi } from "@/lib/communityApi";

type TrackPayload = Record<string, string | number | boolean | null | undefined>;

interface UseTrackingClickReturn {
  track: (eventName: string, payload?: TrackPayload) => void;
  trackCodeCopy: (trackingId: string, bookmaker: string, code: string, predictionId?: string, creatorId?: string) => void;
  trackBookmakerOpen: (trackingId: string, bookmaker: string, affiliateUrl: string, predictionId?: string, creatorId?: string) => void;
  trackPredictionView: (predictionId: string, creatorId?: string) => void;
}

export function useTrackingClick(): UseTrackingClickReturn {
  const track = useCallback((eventName: string, payload: TrackPayload = {}): void => {
    if (process.env.NODE_ENV === "development") {
      console.debug("[track]", eventName, payload);
    }
    communityApi.trackClick({ eventName, ...payload }).catch(() => {});
  }, []);

  const trackCodeCopy = useCallback((
    trackingId: string,
    bookmaker: string,
    code: string,
    predictionId?: string,
    creatorId?: string,
  ): void => {
    track("code_copy", { trackingId, bookmaker, code, predictionId, creatorId, ts: Date.now() });
  }, [track]);

  const trackBookmakerOpen = useCallback((
    trackingId: string,
    bookmaker: string,
    affiliateUrl: string,
    predictionId?: string,
    creatorId?: string,
  ): void => {
    track("bookmaker_open", { trackingId, bookmaker, affiliateUrl, predictionId, creatorId, ts: Date.now() });
  }, [track]);

  const trackPredictionView = useCallback((predictionId: string, creatorId?: string): void => {
    track("prediction_view", { predictionId, creatorId, ts: Date.now() });
  }, [track]);

  return { track, trackCodeCopy, trackBookmakerOpen, trackPredictionView };
}
