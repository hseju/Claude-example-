import asyncio
import io
import random

import pytest
from fastapi.testclient import TestClient
from PIL import Image, ImageDraw

from bollylook.config import Settings
from bollylook.main import create_app
from bollylook.schemas import Garment, LookAnalysis, SceneContext

ADMIN_TOKEN = "test-admin-token"


def make_image(seed: int = 1, size: tuple[int, int] = (1200, 800), fmt: str = "PNG") -> bytes:
    """A distinct synthetic 'scene' per seed, so each seed gets its own perceptual hash."""
    rng = random.Random(seed)
    img = Image.new("RGB", size, (rng.randrange(256), rng.randrange(256), rng.randrange(256)))
    draw = ImageDraw.Draw(img)
    for _ in range(12):
        x0, y0 = rng.randrange(size[0]), rng.randrange(size[1])
        x1, y1 = x0 + rng.randrange(50, 400), y0 + rng.randrange(50, 400)
        draw.rectangle((x0, y0, x1, y1), fill=(rng.randrange(256), rng.randrange(256), rng.randrange(256)))
    out = io.BytesIO()
    img.save(out, format=fmt)
    return out.getvalue()


SAMPLE_ANALYSIS = LookAnalysis(
    summary="Festive red-and-gold wedding look.",
    garments=[
        Garment(
            category="saree", name="Red sequinned chiffon saree", worn_by="woman in the centre",
            gender="women", colors=["red", "gold"], pattern="sequinned", material="chiffon",
            details="gold scalloped border, pallu draped over left shoulder",
            exact_query="women red sequin chiffon saree gold border",
            dupe_query="red sequin party wear saree",
            confidence="high",
        ),
        Garment(
            category="sunglasses", name="Black aviator sunglasses", worn_by="man on the left",
            gender="men", colors=["black"], pattern="solid", material="metal",
            details="thin gold frame, dark lenses",
            exact_query="men black gold aviator sunglasses",
            dupe_query="aviator sunglasses men",
            confidence="medium",
        ),
    ],
)


class FakeAnalyzer:
    def __init__(self, result: LookAnalysis = SAMPLE_ANALYSIS, delay: float = 0.0, error: Exception | None = None):
        self.result = result
        self.delay = delay
        self.error = error
        self.calls: list[SceneContext] = []

    async def analyze(self, image_jpeg: bytes, context: SceneContext) -> LookAnalysis:
        self.calls.append(context)
        if self.delay:
            await asyncio.sleep(self.delay)
        if self.error:
            raise self.error
        return self.result


@pytest.fixture
def settings(tmp_path) -> Settings:
    return Settings(
        _env_file=None,
        data_dir=tmp_path,
        admin_token=ADMIN_TOKEN,
        analyses_per_ip_per_minute=100,
        amazon_associate_tag="bollylook-21",
        myntra_affiliate_template="https://aff.example.com/r?cid=42&url={url}",
    )


@pytest.fixture
def analyzer() -> FakeAnalyzer:
    return FakeAnalyzer()


@pytest.fixture
def client(settings, analyzer) -> TestClient:
    return TestClient(create_app(settings, analyzer))
