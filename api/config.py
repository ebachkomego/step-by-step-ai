from typing import List, Optional
from pydantic_settings import BaseSettings, SettingsConfigDict
import os

class Settings(BaseSettings):
    GEMINI_API_KEY: Optional[str] = None
    OPENAI_API_KEY: Optional[str] = None
    
    HOST: str = "0.0.0.0"
    PORT: int = 8000
    ENVIRONMENT: str = "development"
    
    OVERPASS_URL: str = "https://overpass-api.de/api/interpreter"
    OSRM_URL: str = "http://router.project-osrm.org/route/v1/foot"
    
    CORS_ORIGINS: List[str] = ["*"]

    model_config = SettingsConfigDict(
        extra="ignore"
    )

settings = Settings()
