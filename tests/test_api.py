import asyncio
from urllib.parse import parse_qs, urlparse

import httpx

from bollylook.main import create_app
from bollylook.vision import AnalysisRefused

from .conftest import ADMIN_TOKEN, FakeAnalyzer, make_image


def upload(client, seed=1, **fields):
    return client.post("/api/looks", files={"image": ("scene.png", make_image(seed), "image/png")}, data=fields)


def test_upload_returns_garments_with_shop_links(client, analyzer):
    res = upload(client, movie="Kabhi Khushi Kabhie Gham", scene="Bole Chudiyan")
    assert res.status_code == 201
    look = res.json()
    assert look["cached"] is False
    assert look["context"]["movie"] == "Kabhi Khushi Kabhie Gham"
    assert [g["category"] for g in look["garments"]] == ["saree", "sunglasses"]
    links = look["garments"][0]["links"]
    assert {(l["store"], l["kind"]) for l in links} == {
        (s, k) for s in ("myntra", "ajio", "amazon") for k in ("exact", "dupe")
    }
    assert all(l["url"].startswith(f"/go/{look['id']}/0/") for l in links)
    assert analyzer.calls[0].scene == "Bole Chudiyan"


def test_repeat_upload_is_served_from_cache(client, analyzer):
    first = upload(client, seed=3).json()
    second = upload(client, seed=3)
    assert second.status_code == 200
    assert second.json()["cached"] is True
    assert second.json()["id"] == first["id"]
    assert len(analyzer.calls) == 1


def test_concurrent_uploads_of_one_scene_share_a_single_analysis(settings):
    analyzer = FakeAnalyzer(delay=0.2)
    app = create_app(settings, analyzer)
    image = make_image(seed=5)

    async def burst():
        transport = httpx.ASGITransport(app=app)
        async with httpx.AsyncClient(transport=transport, base_url="http://test") as http:
            return await asyncio.gather(*[
                http.post("/api/looks", files={"image": ("s.png", image, "image/png")}) for _ in range(10)
            ])

    responses = asyncio.run(burst())
    assert len(analyzer.calls) == 1
    assert len({r.json()["id"] for r in responses}) == 1
    assert sorted(r.status_code for r in responses) == [200] * 9 + [201]


def test_get_look_by_id(client):
    look = upload(client).json()
    res = client.get(f"/api/looks/{look['id']}")
    assert res.status_code == 200
    assert res.json()["garments"][1]["name"] == "Black aviator sunglasses"
    assert client.get("/api/looks/nope").status_code == 404


def test_shop_click_is_recorded_and_redirects_with_affiliate_tag(client):
    look = upload(client).json()
    res = client.get(f"/go/{look['id']}/1/amazon/dupe", headers={"referer": "https://bollylook.app/"},
                     follow_redirects=False)
    assert res.status_code == 302
    target = urlparse(res.headers["location"])
    assert target.netloc == "www.amazon.in"
    assert parse_qs(target.query) == {"k": ["aviator sunglasses men"], "tag": ["bollylook-21"]}

    myntra = client.get(f"/go/{look['id']}/0/myntra/exact", follow_redirects=False)
    assert urlparse(myntra.headers["location"]).netloc == "aff.example.com"

    stats = client.get("/api/admin/stats", headers={"x-admin-token": ADMIN_TOKEN}).json()
    assert stats["totals"]["clicks"] == 2


def test_shop_click_rejects_unknown_targets(client):
    look = upload(client).json()
    assert client.get(f"/go/{look['id']}/9/amazon/exact", follow_redirects=False).status_code == 404
    assert client.get(f"/go/{look['id']}/0/flipkart/exact", follow_redirects=False).status_code == 422
    assert client.get("/go/missing/0/amazon/exact", follow_redirects=False).status_code == 404


def test_rejects_bad_uploads(client):
    res = client.post("/api/looks", files={"image": ("x.png", b"not an image", "image/png")})
    assert res.status_code == 422
    too_long = client.post("/api/looks", files={"image": ("s.png", make_image(), "image/png")}, data={"movie": "x" * 201})
    assert too_long.status_code == 422


def test_rate_limit_applies_to_new_analyses_only(settings, analyzer):
    settings.analyses_per_ip_per_minute = 2
    client = create_client(settings, analyzer)
    assert upload(client, seed=1).status_code == 201
    assert upload(client, seed=2).status_code == 201
    limited = upload(client, seed=3)
    assert limited.status_code == 429
    assert int(limited.headers["retry-after"]) > 0
    assert upload(client, seed=1).status_code == 200  # cached scenes are never limited


def test_daily_cap(settings, analyzer):
    settings.max_analyses_per_day = 1
    client = create_client(settings, analyzer)
    assert upload(client, seed=1).status_code == 201
    assert upload(client, seed=2).status_code == 503


def test_refusal_maps_to_friendly_error(settings):
    client = create_client(settings, FakeAnalyzer(error=AnalysisRefused("declined")))
    res = upload(client)
    assert res.status_code == 422
    assert "different still" in res.json()["detail"]


def test_admin_scene_catalog(client, analyzer):
    files = {"image": ("ddlj.jpg", make_image(seed=11, fmt="JPEG"), "image/jpeg")}
    data = {"movie": "Dilwale Dulhania Le Jayenge", "year": "1995", "scene": "Tujhe Dekha To"}
    assert client.post("/api/admin/scenes", files=files, data=data).status_code == 401
    res = client.post("/api/admin/scenes", files=files, data=data, headers={"x-admin-token": ADMIN_TOKEN})
    assert res.status_code == 201
    scene = res.json()
    assert scene["look"]["garments"]

    listed = client.get("/api/scenes", params={"q": "Dilwale"}).json()
    assert [s["id"] for s in listed] == [scene["id"]]
    assert client.get("/api/scenes", params={"q": "Sholay"}).json() == []
    assert client.get(scene["image_url"]).status_code == 200

    detail = client.get(f"/api/scenes/{scene['id']}").json()
    assert detail["look"]["id"] == scene["look_id"]
    # users who screenshot the same catalog frame reuse the stored analysis
    assert upload(client, seed=11).json()["id"] == scene["look_id"]
    assert len(analyzer.calls) == 1


def test_frontend_is_served(client):
    res = client.get("/")
    assert res.status_code == 200
    assert "BollyLook" in res.text


def create_client(settings, analyzer):
    from fastapi.testclient import TestClient
    return TestClient(create_app(settings, analyzer))
