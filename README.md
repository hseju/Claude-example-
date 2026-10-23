# BollyLook

Shop the outfits from Bollywood films and songs. A user picks a catalog scene or uploads a
screenshot. Claude breaks the outfit down into individual garments, and each garment gets
affiliate-tagged "closest match" and "budget dupe" searches on Myntra, AJIO and Amazon.in.

## Quick start

```bash
python3 -m venv .venv && .venv/bin/pip install -r requirements-dev.txt
cp .env.example .env            # add ANTHROPIC_API_KEY, an admin token, affiliate IDs
.venv/bin/uvicorn bollylook.main:create_app --factory --reload
open http://localhost:8000      # demo UI; API docs at /docs
.venv/bin/pytest                # runs offline, no API key needed
```

Add a scene to the catalog. It is analysed once, then served to every user from cache:

```bash
curl -X POST localhost:8000/api/admin/scenes -H "X-Admin-Token: $TOKEN" \
  -F image=@still.jpg -F movie="Dilwale Dulhania Le Jayenge" -F year=1995 -F scene="Tujhe Dekha To"
```

## How it works

```
upload ─► normalize (strip EXIF, downscale, JPEG) ─► perceptual hash
            │
            ├─ hash seen before? ──► cached look (no Claude call, no rate limit)
            ├─ same hash in flight? ──► wait for that one call
            └─ new ─► per-IP limit + daily cap ─► Claude vision (structured output) ─► save
look ─► garments × {exact, dupe} × {Myntra, AJIO, Amazon} ─► /go/... ─► log click ─► 302 to affiliate URL
```

| Endpoint | What it does |
|---|---|
| `POST /api/looks` | Upload a still (`image`, optional `movie`, `scene`, `notes`). 201 when new, 200 when cached |
| `GET /api/looks/{id}` | A saved look (shareable as `/#look={id}`) |
| `GET /api/scenes?q=` | Catalog search |
| `GET /api/scenes/{id}` | Scene plus its look |
| `GET /go/{look}/{garment}/{store}/{kind}` | Click tracking, then redirect to the store |
| `POST /api/admin/scenes` | Add a catalog scene (`X-Admin-Token`) |
| `GET /api/admin/stats` | Clicks by store and top looks (`X-Admin-Token`) |

Code map: `bollylook/vision.py` (Claude prompt and call), `stores.py` (store URLs and
affiliate wrapping), `service.py` (cache, request dedup, limits), `db.py` (SQLite),
`main.py` (routes), `static/index.html` (demo UI).

## Design choices

- **Cache by scene.** Popular scenes get looked up again and again, so a look is keyed by a
  perceptual hash of the frame. Re-encoded or resized copies of the same frame hit the cache,
  and the cost per user drops toward zero for anything trending. The catalog is the
  zero-cost path.
- **Claude call:** `claude-opus-5-5` at `medium` effort with structured output, so responses
  always match the `LookAnalysis` schema. Server-side refusal fallback (`fallbacks: "default"`)
  is on. Model and effort are env-configurable if you want to trade quality for cost later.
- **Search links, not scraping.** Links go to each store's own search page with your
  affiliate tag. Scraping Myntra, AJIO or Amazon breaks their terms and breaks often.
  Product-level matching should come from official feeds (see next steps).
- **Clicks are tracked server-side** through `/go/...`, and affiliate IDs are applied at
  redirect time. Changing an affiliate ID takes effect for every saved look immediately.
- **Privacy:** user uploads are analysed but not stored. Only the hash and the breakdown are
  kept. Only admin-curated catalog images are saved to disk. Click logs store no IP address.

## Next steps

1. **Real product matches:** add Amazon's product API and affiliate-network product feeds
   (Cuelinks, Admitad, EarnKaro and others carry Myntra and AJIO). Then have Claude re-rank
   candidate product images against the garment crop to get true "exact match" results.
2. **Scale-out:** Postgres instead of SQLite, Redis for the rate limiter and in-flight
   dedup, object storage plus a CDN for catalog images, and near-duplicate (Hamming-distance)
   hash lookup for cropped screenshots.
3. **Catalog pipeline:** batch-analyse new releases and trending songs with the Message
   Batches API (50% cheaper).
4. **Before launch:** the legal points below.

## Legal points to check before launch

- **Film stills are copyrighted.** Hosting frames in the catalog needs licensing or a
  fair-use review. User uploads that are analysed and not stored carry less risk.
- **Celebrity names and likeness in marketing** may need permission.
- **Affiliate disclosure:** ASCI guidelines in India require a disclosure. The UI footer
  includes one.
- **Store programme terms:** check each affiliate programme's rules on link formats and
  brand use.
