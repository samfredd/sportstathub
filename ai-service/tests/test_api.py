from fastapi.testclient import TestClient

from app.main import app


client = TestClient(app)


def test_health_endpoint() -> None:
    response = client.get("/health")

    assert response.status_code == 200
    assert response.json()["status"] == "ok"


def test_predict_endpoint() -> None:
    response = client.post(
        "/predict",
        json={
            "sport": "FOOTBALL",
            "homeTeam": "Lagos FC",
            "awayTeam": "Kano United",
            "league": "NPFL",
            "startsAt": "2026-05-02T16:00:00Z",
            "features": {"home_strength": 0.7, "away_strength": 0.45},
        },
    )

    assert response.status_code == 200
    assert response.json()["pick"] == "Lagos FC"
