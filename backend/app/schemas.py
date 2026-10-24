from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field

class POIPoint(BaseModel):
    id: str
    name: str
    lat: float
    lon: float
    category: str
    tags: Optional[Dict[str, Any]] = None

class DesiredWaypoint(BaseModel):
    id: str
    name: str
    lat: float
    lon: float
    address: Optional[str] = None
    category: Optional[str] = None
    photo_url: Optional[str] = None

class RouteRequest(BaseModel):
    start_lat: float = Field(..., description="Широта начальной точки")
    start_lon: float = Field(..., description="Долгота начальной точки")
    duration_minutes: int = Field(60, ge=15, le=360, description="Желаемое общее время прогулки в минутах")
    scenario: str = Field("walk", description="Сценарий прогулки: walk, coffee, sights, fastfood, etc.")
    is_circular: bool = Field(True, description="Закольцевать маршрут (вернуться в старт)")
    start_time: Optional[str] = Field(None, description="Время старта прогулки HH:MM")
    end_lat: Optional[float] = Field(None, description="Широта конечной точки")
    end_lon: Optional[float] = Field(None, description="Долгота конечной точки")
    end_name: Optional[str] = Field(None, description="Название точки финиша")
    end_address: Optional[str] = Field(None, description="Адрес точки финиша")
    target_arrival_time: Optional[str] = Field(None, description="Желаемое время прибытия HH:MM")
    custom_prompt: Optional[str] = Field(None, description="Пользовательский запрос 'Что хочется?'")
    activities: Optional[List[str]] = Field(default_factory=list, description="Выбранные форматы прогулки")
    stop_count: Optional[int] = Field(0, description="Желаемое количество остановок (0 = авто)")
    api_key: Optional[str] = Field(None, description="Опциональный ключ LLM")
    waypoints: Optional[List[DesiredWaypoint]] = Field(default_factory=list, description="Обязательные точки по пути")

class PlaceReview(BaseModel):
    id: Optional[str] = None
    author: str = "Гость"
    avatar: Optional[str] = None
    rating: float = 5.0
    text: str = ""
    date: Optional[str] = None

class RouteStop(BaseModel):
    id: Optional[str] = None
    name: str
    category: str
    lat: float
    lon: float
    spent_minutes: int = 15
    description: str = ""
    order: int = 1
    address: Optional[str] = None
    rating: Optional[float] = None
    reviews_count: Optional[int] = None
    photo_url: Optional[str] = None
    satellite_url: Optional[str] = None
    photos: List[str] = []
    yandex_url: Optional[str] = None
    arrival_time: Optional[str] = None
    departure_time: Optional[str] = None
    opening_hours: Optional[str] = None
    tags: List[str] = []
    reviews: List[PlaceReview] = []
    is_custom_waypoint: Optional[bool] = False

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
    ai_thought: Optional[str] = None
    notes: Optional[str] = None
    start_time: Optional[str] = None
    arrival_time: Optional[str] = None
    is_circular: Optional[bool] = True
    end_point: Optional[Dict[str, Any]] = None
    isFavorite: Optional[bool] = False

class PlacesSearchRequest(BaseModel):
    lat: float
    lon: float
    query: str
    radius_meters: Optional[float] = 2000.0
    limit: Optional[int] = 15

class PlacesSearchResponse(BaseModel):
    query: str
    places: List[RouteStop]
