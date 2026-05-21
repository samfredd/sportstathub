from datetime import UTC, datetime

from app.schemas import PredictionRequest, Sport
from app.services.prediction_service import predict_match


def test_predict_match_selects_stronger_home_team() -> None:
    request = PredictionRequest(
        sport=Sport.FOOTBALL,
        homeTeam="Lagos FC",
        awayTeam="Accra Stars",
        league="West Africa Premier",
        startsAt=datetime(2026, 5, 2, tzinfo=UTC),
        features={"home_strength": 0.72, "away_strength": 0.43, "draw_pressure": 0.12},
    )

    result = predict_match(request)

    assert result.market == "1X2"
    assert result.pick == "Lagos FC"
    assert result.confidence >= 60


def test_predict_match_uses_tennis_winner_market() -> None:
    request = PredictionRequest(
        sport=Sport.TENNIS,
        homeTeam="Player A",
        awayTeam="Player B",
        league="ATP",
        startsAt=datetime(2026, 5, 2, tzinfo=UTC),
        features={"home_strength": 0.4, "away_strength": 0.62},
    )

    result = predict_match(request)

    assert result.market == "Match Winner"
    assert result.pick == "Player B"
