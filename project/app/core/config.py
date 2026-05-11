"""Configuration depuis .env"""
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    APP_NAME: str = "Systeme IA Attijari bank"
    APP_VERSION: str = "1.0.0"
    DEBUG: bool = True
    SECRET_KEY: str = "changeme"
    DB_HOST: str = "localhost"
    DB_PORT: int = 5432
    DB_NAME: str = "attijari_pfe"
    DB_USER: str = "postgres"
    DB_PASSWORD: str = "postgres"
    DATABASE_URL: str = "postgresql://postgres:postgres@localhost:5432/attijari_pfe"
    JWT_SECRET_KEY: str = "jwt_secret_changeme"
    JWT_ALGORITHM: str = "HS256"
    JWT_EXPIRE_MINUTES: int = 480
    AES_KEY: str = "changeme32chars!changeme32chars!"
    SEUIL_RISQUE: float = 0.75
    FENETRE_LSTM: int = 30
    ES_HOST: str = "localhost"
    ES_PORT: int = 9200
    REDIS_HOST: str = "localhost"
    REDIS_PORT: int = 6379
    MLFLOW_TRACKING_URI: str = "http://localhost:5000"
    CSV_PATH: str = "data/raw/reclamations.csv"
    MODEL_PATH: str = "models/lstm_model.h5"
    BACKUP_PATH: str = "backups/"
    BACKUP_RETENTION_DAYS: int = 30

    # ── Notifications ──
    SMTP_HOST: str = "smtp.gmail.com"
    SMTP_PORT: int = 587
    SMTP_USER: str = ""
    SMTP_PASSWORD: str = ""
    TICKET_NOTIFY_EMAIL: str = "responsableit000@gmail.com"
    SLACK_WEBHOOK_URL: str = ""

    # ── Elasticsearch & Redis Extras ──
    ES_INDEX_RECLAMATIONS: str = "reclamations"
    REDIS_DB: int = 0
    MLFLOW_EXPERIMENT_NAME: str = "attijari_lstm"
    RETRAIN_INTERVAL_DAYS: int = 7

    class Config:
        env_file = ".env"
        extra = "ignore"

settings = Settings()
