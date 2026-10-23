import io
from dataclasses import dataclass

from PIL import Image, ImageOps, UnidentifiedImageError

ALLOWED_FORMATS = {"JPEG", "PNG", "WEBP"}
MAX_PIXELS = 40_000_000  # refuse decompression bombs well before Pillow's own limit
HASH_SIZE = 16  # 16x16 difference hash -> 256 bits


class InvalidImage(ValueError):
    pass


@dataclass(frozen=True)
class NormalizedImage:
    jpeg: bytes
    phash: str
    width: int
    height: int


def normalize_image(data: bytes, max_edge: int) -> NormalizedImage:
    """Validate an upload and re-encode it as a metadata-free JPEG no larger than max_edge."""
    try:
        with Image.open(io.BytesIO(data)) as probe:
            if probe.format not in ALLOWED_FORMATS:
                raise InvalidImage(f"unsupported image format {probe.format}; use JPEG, PNG or WebP")
            if probe.width * probe.height > MAX_PIXELS:
                raise InvalidImage("image is too large")
            img = ImageOps.exif_transpose(probe)
            img = img.convert("RGB")
    except (UnidentifiedImageError, Image.DecompressionBombError, OSError) as exc:
        raise InvalidImage("file is not a readable image") from exc

    img.thumbnail((max_edge, max_edge), Image.Resampling.LANCZOS)
    out = io.BytesIO()
    img.save(out, format="JPEG", quality=88, optimize=True)
    return NormalizedImage(jpeg=out.getvalue(), phash=difference_hash(img), width=img.width, height=img.height)


def difference_hash(img: Image.Image) -> str:
    """Perceptual hash that survives re-encoding and resizing.

    Lets thousands of screenshots of the same viral frame share one cached analysis.
    """
    small = img.convert("L").resize((HASH_SIZE + 1, HASH_SIZE), Image.Resampling.LANCZOS)
    px = small.load()
    bits = 0
    for y in range(HASH_SIZE):
        for x in range(HASH_SIZE):
            bits = (bits << 1) | (px[x, y] > px[x + 1, y])
    return f"{bits:0{HASH_SIZE * HASH_SIZE // 4}x}"
