from fastapi import FastAPI

from app.schemas import PredictionRequest, PredictionResponse
from app.services.prediction_service import MODEL_VERSION, predict_match

app = FastAPI(title="MultiSport AI Prediction Service", version="0.1.0")


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok", "modelVersion": MODEL_VERSION}


@app.post("/predict", response_model=PredictionResponse)
def predict(request: PredictionRequest) -> PredictionResponse:
    return predict_match(request)
