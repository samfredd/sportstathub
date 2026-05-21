"""
OddSwitch Engine — Confidence Scorer.

Step 6: Score the overall translation confidence.

Per-leg: event_match_confidence × market_match_confidence
Overall: weighted average of leg confidences
Status thresholds:
  > 0.9  → semantically_equivalent
  0.7-0.9 → approximate
  < 0.7  → partial
"""

from __future__ import annotations

from app.schemas.enums import TranslationStatus
from app.workers.matcher import EventMatch
from app.workers.translator import MarketTranslation


class ConfidenceScorer:
    """Computes confidence scores for a translation."""

    def score(
        self,
        event_matches: list[EventMatch],
        market_translations: list[MarketTranslation],
    ) -> dict:
        """
        Compute per-leg and overall confidence.

        Returns a dict with:
          confidence: float (0-1)
          status: str (semantically_equivalent | approximate | partial)
          legs: list of per-leg confidence data
        """
        leg_scores: list[dict] = []

        for i, event_match in enumerate(event_matches):
            market_tx = next(
                (m for m in market_translations if m.leg_index == i), None
            )
            market_confidence = market_tx.confidence if market_tx else 0.5
            combined = event_match.confidence * market_confidence

            leg_status = "exact" if combined >= 0.95 else (
                "approximate" if combined >= 0.7 else "missing"
            )

            leg_scores.append({
                "leg_index": i,
                "event_confidence": event_match.confidence,
                "market_confidence": market_confidence,
                "combined_confidence": round(combined, 4),
                "status": leg_status,
            })

        # Overall confidence: weighted average
        if leg_scores:
            overall = sum(l["combined_confidence"] for l in leg_scores) / len(leg_scores)
        else:
            overall = 0.0

        overall = round(overall, 4)

        if overall >= 0.9:
            status = TranslationStatus.SEMANTICALLY_EQUIVALENT
        elif overall >= 0.7:
            status = TranslationStatus.APPROXIMATE
        else:
            status = TranslationStatus.PARTIAL

        return {
            "confidence": overall,
            "status": status,
            "legs": leg_scores,
        }
