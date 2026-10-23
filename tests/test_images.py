import io

import pytest
from PIL import Image

from bollylook.images import InvalidImage, normalize_image

from .conftest import make_image


def test_downscales_and_reencodes_as_jpeg():
    img = normalize_image(make_image(size=(3000, 2000)), max_edge=1568)
    assert (img.width, img.height) == (1568, 1045)
    assert Image.open(io.BytesIO(img.jpeg)).format == "JPEG"


def test_small_images_are_not_upscaled():
    img = normalize_image(make_image(size=(640, 360)), max_edge=1568)
    assert (img.width, img.height) == (640, 360)


def test_hash_survives_reencoding_and_resizing():
    source = make_image(seed=7, size=(1600, 900))
    out = io.BytesIO()
    Image.open(io.BytesIO(source)).resize((1200, 675)).save(out, format="JPEG", quality=70)
    original = normalize_image(source, max_edge=1568)
    screenshot = normalize_image(out.getvalue(), max_edge=1568)
    assert original.phash == screenshot.phash


def test_different_scenes_hash_differently():
    assert normalize_image(make_image(seed=1), 1568).phash != normalize_image(make_image(seed=2), 1568).phash


def test_rejects_non_images():
    with pytest.raises(InvalidImage):
        normalize_image(b"definitely not an image", 1568)


def test_rejects_unsupported_formats():
    out = io.BytesIO()
    Image.new("RGB", (50, 50)).save(out, format="GIF")
    with pytest.raises(InvalidImage, match="unsupported"):
        normalize_image(out.getvalue(), 1568)
