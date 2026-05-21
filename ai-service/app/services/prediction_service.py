from app.schemas import PredictionRequest, PredictionResponse, Sport

MODEL_VERSION = "rules-baseline-2026-05-01"


def predict_match(request: PredictionRequest) -> PredictionResponse:
    """Baseline inference path until trained model artifacts are promoted."""
    home_strength = request.features.get("home_strength", 0.5)
    away_strength = request.features.get("away_strength", 0.5)
    draw_pressure = request.features.get("draw_pressure", 0.2)

    if request.sport == Sport.TENNIS:
        pick = request.homeTeam if home_strength >= away_strength else request.awayTeam
        market = "Match Winner"
    elif abs(home_strength - away_strength) <= draw_pressure:
        pick = "Draw"
        market = "1X2"
    else:
        pick = request.homeTeam if home_strength > away_strength else request.awayTeam
        market = "1X2"

    confidence = _confidence_from_gap(abs(home_strength - away_strength), draw_pressure)
    return PredictionResponse(
        market=market,
        pick=pick,
        confidence=confidence,
        modelVersion=MODEL_VERSION,
        rationale=[
            f"Compared normalized team strength for {request.homeTeam} and {request.awayTeam}.",
            "Applied sport-specific market selection and conservative confidence bounds.",
        ],
    )


def _confidence_from_gap(gap: float, draw_pressure: float) -> int:
    adjusted_gap = max(0.0, min(1.0, gap - draw_pressure / 2))
    return max(52, min(88, round(52 + adjusted_gap * 72)))
