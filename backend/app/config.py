from pathlib import Path

from pydantic_settings import BaseSettings

_ENV_FILE = Path(__file__).resolve().parent.parent / ".env"


class Settings(BaseSettings):
    openai_api_key: str = ""
    vector_store_dir: str = "./data/vectors"
    sqlite_db_path: str = "./data/knowledge.db"
    embedding_model: str = "text-embedding-3-small"
    llm_model: str = "gpt-4o-mini"
    frontend_url: str = "http://localhost:5173"
    chunk_size: int = 500
    chunk_overlap: int = 50

    model_config = {"env_file": str(_ENV_FILE)}


settings = Settings()
