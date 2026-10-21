from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")
    database_url: str = "sqlite:///./data/salon.db"
    salon_timezone: str = "Asia/Kolkata"
    salon_open: str = "09:00"
    salon_close: str = "19:00"
    slot_minutes: int = 15
    admin_password: str = ""
    cors_origins: str = "http://localhost:5173"
    llm_api_key: str = ""
    llm_model: str = "gpt-4o-mini"
    llm_base_url: str = "https://api.openai.com/v1"


settings = Settings()
