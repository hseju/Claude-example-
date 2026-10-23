import re
from collections.abc import Callable
from dataclasses import dataclass
from urllib.parse import quote, quote_plus, urlencode

from .config import Settings
from .schemas import Garment, LinkKind, StoreKey


@dataclass(frozen=True)
class Store:
    key: StoreKey
    name: str
    search_url: Callable[[str], str]


def _slug(query: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", query.lower()).strip("-") or "search"


STORES: dict[str, Store] = {
    "myntra": Store(
        "myntra", "Myntra",
        lambda q: f"https://www.myntra.com/{_slug(q)}?rawQuery={quote(q)}",
    ),
    "ajio": Store(
        "ajio", "AJIO",
        lambda q: f"https://www.ajio.com/search/?{urlencode({'text': q})}",
    ),
    "amazon": Store(
        "amazon", "Amazon",
        lambda q: f"https://www.amazon.in/s?k={quote_plus(q)}",
    ),
}

LINK_KINDS: tuple[LinkKind, ...] = ("exact", "dupe")


def query_for(garment: Garment, kind: LinkKind) -> str:
    return garment.exact_query if kind == "exact" else garment.dupe_query


def build_store_url(store_key: str, query: str, settings: Settings) -> str:
    """Search URL on the store, wrapped with the configured affiliate tracking.

    Without affiliate config the link still works; it just earns no commission.
    """
    url = STORES[store_key].search_url(query)
    if store_key == "amazon":
        if settings.amazon_associate_tag:
            url += "&" + urlencode({"tag": settings.amazon_associate_tag})
        return url

    template = {
        "myntra": settings.myntra_affiliate_template,
        "ajio": settings.ajio_affiliate_template,
    }[store_key]
    if template:
        url = template.replace("{url}", quote(url, safe=""))
    return url
