from datetime import datetime
from enum import StrEnum

from pydantic import BaseModel, Field


class Sport(StrEnum):
    FOOTBALL = "FOOTBALL"
    BASKETBALL = "BASKETBALL"
    TENNIS = "TENNIS"
    CRICKET = "CRICKET"
    RUGBY = "RUGBY"


class PredictionRequest(BaseModel):
    sport: Sport
    homeTeam: str = Field(min_length=1, max_length=120)
    awayTeam: str = Field(min_length=1, max_length=120)
    league: str = Field(min_length=1, max_length=80)
    startsAt: datetime
    features: dict[str, float] = Field(default_factory=dict)


class PredictionResponse(BaseModel):
    market: str
    pick: str
    confidence: int = Field(ge=1, le=100)
    modelVersion: str
    rationale: list[str]
