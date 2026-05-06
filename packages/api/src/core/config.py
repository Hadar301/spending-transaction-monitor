"""
Application configuration
"""

import os
from pathlib import Path
from typing import Literal

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application settings"""

    # Define env file priority order (first one found is used)
    model_config = SettingsConfigDict(
        env_file=[
            Path(__file__).resolve().parents[4]
            / '.env.development',  # root/.env.development
            Path(__file__).resolve().parents[4] / '.env',  # root/.env
            Path(__file__).resolve().parents[2] / '.env',  # packages/api/.env
        ],
        extra='ignore',  # Allow extra environment variables without validation errors
    )

    # Environment settings
    ENVIRONMENT: Literal['development', 'production', 'staging', 'test', 'ci'] = (
        'development'
    )

    # Authentication settings
    BYPASS_AUTH: bool = False

    # Basic settings
    APP_NAME: str = 'spending-monitor'
    DEBUG: bool = False

    # CORS settings
    ALLOWED_HOSTS: list[str] = ['http://localhost:5173']

    # Database settings
    DATABASE_URL: str = (
        'postgresql+asyncpg://user:password@localhost:5432/spending-monitor'
    )

    # LLM settings
    LLM_PROVIDER: str = 'openai'
    NODE_ENV: str = 'development'
    BASE_URL: str = ''
    API_KEY: str = ''
    MODEL: str = 'gpt-3.5-turbo'
    LLAMASTACK_BASE_URL: str = 'http://localhost:8321'
    LLAMASTACK_MODEL: str = 'meta-llama/Llama-3.2-3B-Instruct'

    # Embedding settings (for category normalization)
    EMBEDDING_PROVIDER: str = 'local'  # local (sentence-transformers), openai, llamastack, ollama (deprecated)
    EMBEDDING_MODEL: str = (
        'all-minilm'  # Maps to sentence-transformers/all-MiniLM-L6-v2
    )
    EMBEDDING_DIMENSIONS: int = 384
    OLLAMA_BASE_URL: str = (
        'http://localhost:11434'  # Only needed if using ollama provider
    )
    # Note: Using same LLAMASTACK_BASE_URL as LLM settings above

    # Keycloak settings
    KEYCLOAK_URL: str = 'http://spending-monitor-keycloak:8080'  # Internal URL for API to reach Keycloak (container/cluster network)
    KEYCLOAK_FRONTEND_URL: str = (
        'http://localhost:8080'  # External URL for browser and token issuer
    )
    KEYCLOAK_REALM: str = 'spending-monitor'
    KEYCLOAK_CLIENT_ID: str = 'spending-monitor'

    # Accept tokens up to this many seconds past exp / before nbf (Keycloak vs API pod clock skew).
    JWT_CLOCK_SKEW_LEEWAY_SECONDS: int = 120

    # SMTP settings
    SMTP_HOST: str = 'localhost'
    SMTP_PORT: int = 8025
    SMTP_USERNAME: str = ''
    SMTP_PASSWORD: str = ''
    SMTP_FROM_EMAIL: str = 'noreply@localhost'
    SMTP_REPLY_TO_EMAIL: str = 'noreply@localhost'
    SMTP_USE_TLS: bool = True
    SMTP_USE_SSL: bool = False

    # Twilio SMS settings
    TWILIO_ACCOUNT_SID: str = ''
    TWILIO_AUTH_TOKEN: str = ''
    TWILIO_PHONE_NUMBER: str = ''

    def model_post_init(self, __context):
        """Set derived values based on environment"""
        # Auto-enable auth bypass in development ONLY if not explicitly set in environment
        if self.ENVIRONMENT == 'development' and 'BYPASS_AUTH' not in os.environ:
            self.BYPASS_AUTH = True

        # Set DEBUG based on environment if not explicitly set
        if not hasattr(self, '_debug_explicitly_set') and 'DEBUG' not in os.environ:
            self.DEBUG = self.ENVIRONMENT == 'development'


# Create a global settings instance
settings = Settings()
