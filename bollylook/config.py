from functools import lru_cache
from pathlib import Path

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Runtime configuration, read from BOLLYLOOK_* env vars or a .env file.

    The Anthropic API key is read by the SDK itself from ANTHROPIC_API_KEY.
    """

    model_config = SettingsConfigDict(env_prefix="BOLLYLOOK_", env_file=".env", extra="ignore")

    claude_model: str = "claude-opus-5-5"
    claude_effort: str = "medium"

    data_dir: Path = Path("data")
    max_upload_mb: int = 8
    # Long edge, in pixels, that uploads are downscaled to before analysis.
    # Larger keeps more garment detail but costs more image tokens per call.
    max_image_edge: int = 1568

    admin_token: str = ""
    # Limits on calls that reach Claude. Cached looks are never limited.
    analyses_per_ip_per_minute: int = 5
    max_analyses_per_day: int = 1000

    amazon_associate_tag: str = ""
    # Affiliate-network deep-link templates (Cuelinks, EarnKaro, Admitad, ...).
    # Must contain "{url}", which is replaced with the URL-encoded store link.
    myntra_affiliate_template: str = ""
    ajio_affiliate_template: str = ""

    @field_validator("myntra_affiliate_template", "ajio_affiliate_template")
    @classmethod
    def _check_template(cls, value: str) -> str:
        if value and (not value.startswith("https://") or "{url}" not in value):
            raise ValueError("affiliate template must be an https:// URL containing {url}")
        return value

    @property
    def db_path(self) -> Path:
        return self.data_dir / "bollylook.db"

    @property
    def media_dir(self) -> Path:
        return self.data_dir / "media"


@lru_cache
def get_settings() -> Settings:
    return Settings()
