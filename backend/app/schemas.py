from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field

class RouteRequest(BaseModel):
    start_lat: float = Field(..., description="Широта начальной точки")
    start_lon: float = Field(..., description="Долгота начальной точки")
    duration_minutes: int = Field(60, ge=30, le=240, description="Желаемое общее время прогулки в минутах (30-240)")
    scenario: str = Field("date", description="Сценарий прогулки: date, tourist, coffee_walk, dog_walk, etc.")
    is_circular: bool = Field(True, description="Закольцевать маршрут (вернуться в старт)")
    end_lat: Optional[float] = Field(None, description="Широта конечной точки (если не закольцован)")
    end_lon: Optional[float] = Field(None, description="Долгота конечной точки (если не закольцован)")
    api_key: Optional[str] = Field(None, description="Опциональный API ключ Gemini или OpenAI от пользователя")

class POIPoint(BaseModel):
    id: str
    name: str
    lat: float
    lon: float
    category: str
    tags: Optional[Dict[str, Any]] = None

class RouteStop(BaseModel):
    name: str
    category: str
    lat: float
    lon: float
    spent_minutes: int
    description: str
    order: int = 1

class RouteResponse(BaseModel):
    total_walking_minutes: int
    total_distance_meters: float
    total_route_minutes: int
    stops: List[RouteStop]
    geojson: Dict[str, Any]
    scenario: str
    scenario_title: str
    used_ai: bool = True
    ai_model: Optional[str] = None
    notes: Optional[str] = None
