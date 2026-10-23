from urllib.parse import parse_qs, urlparse

from bollylook.config import Settings
from bollylook.stores import build_store_url

PLAIN = Settings(_env_file=None)


def test_store_search_urls_without_affiliate_config():
    q = "women red sequin saree"
    assert build_store_url("myntra", q, PLAIN) == "https://www.myntra.com/women-red-sequin-saree?rawQuery=women%20red%20sequin%20saree"
    assert build_store_url("ajio", q, PLAIN) == "https://www.ajio.com/search/?text=women+red+sequin+saree"
    assert build_store_url("amazon", q, PLAIN) == "https://www.amazon.in/s?k=women+red+sequin+saree"


def test_amazon_gets_associate_tag():
    url = build_store_url("amazon", "aviator sunglasses", Settings(_env_file=None, amazon_associate_tag="bl-21"))
    assert parse_qs(urlparse(url).query) == {"k": ["aviator sunglasses"], "tag": ["bl-21"]}


def test_affiliate_template_wraps_encoded_store_url():
    settings = Settings(_env_file=None, ajio_affiliate_template="https://aff.example.com/r?cid=9&url={url}")
    url = build_store_url("ajio", "kurta set", settings)
    parsed = urlparse(url)
    assert parsed.netloc == "aff.example.com"
    assert parse_qs(parsed.query)["url"] == ["https://www.ajio.com/search/?text=kurta+set"]


def test_hostile_queries_cannot_change_the_destination():
    q = "x/../../evil.com?a=1&tag=attacker#frag"
    for store, host in [("myntra", "www.myntra.com"), ("ajio", "www.ajio.com"), ("amazon", "www.amazon.in")]:
        parsed = urlparse(build_store_url(store, q, Settings(_env_file=None, amazon_associate_tag="bl-21")))
        assert parsed.netloc == host
        assert parsed.fragment == ""
    amazon = urlparse(build_store_url("amazon", q, Settings(_env_file=None, amazon_associate_tag="bl-21")))
    assert parse_qs(amazon.query)["tag"] == ["bl-21"]
