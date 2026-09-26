from functools import lru_cache
from typing import Literal

from pydantic import Field, SecretStr, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "HackFlow API"
    api_v1_prefix: str = "/api/v1"
    debug: bool = False
    cors_origins: list[str] = ["http://localhost:5173"]
    database_url: str | None = None
    jwt_secret_key: SecretStr | None = None
    jwt_algorithm: Literal["HS256"] = "HS256"
    access_token_expire_minutes: int = Field(default=15, gt=0, le=60)
    auth_cookie_name: str = "codearena_access"
    auth_cookie_secure: bool = False
    auth_cookie_samesite: Literal["lax", "strict", "none"] = "lax"
    execution_docker_binary: str = "docker"
    execution_docker_image: str = "python:3.12-slim"
    execution_timeout_seconds: int = Field(default=5, ge=1, le=30)
    execution_memory_limit_mb: int = Field(default=128, ge=32, le=512)
    execution_cpu_limit: float = Field(default=0.5, gt=0, le=2)
    execution_pids_limit: int = Field(default=32, ge=1, le=128)
    execution_max_output_bytes: int = Field(default=65_536, ge=1_024, le=1_048_576)
    execution_max_input_bytes: int = Field(default=65_536, ge=1_024, le=1_048_576)
    worker_poll_interval_seconds: float = Field(default=1.0, ge=0.1, le=30)

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    @model_validator(mode="after")
    def validate_auth_settings(self) -> "Settings":
        if self.jwt_secret_key and len(self.jwt_secret_key.get_secret_value()) < 32:
            raise ValueError("JWT_SECRET_KEY must be at least 32 characters")
        if self.auth_cookie_samesite == "none" and not self.auth_cookie_secure:
            raise ValueError("AUTH_COOKIE_SECURE must be true when SameSite is none")
        return self


@lru_cache
def get_settings() -> Settings:
    return Settings()
