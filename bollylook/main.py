import logging
import secrets
from pathlib import Path
from typing import Annotated

import anthropic
from fastapi import Depends, FastAPI, File, Form, Header, HTTPException, Query, Request, Response, UploadFile
from fastapi.responses import RedirectResponse
from fastapi.staticfiles import StaticFiles
from starlette.concurrency import run_in_threadpool

from .config import Settings, get_settings
from .db import Repository, SceneRecord
from .images import InvalidImage, NormalizedImage, normalize_image
from .schemas import LinkKind, LookOut, SceneContext, SceneDetailOut, SceneOut, StoreKey
from .service import DailyCapReached, LookService, RateLimited, to_look_out
from .stores import build_store_url, query_for
from .vision import Analyzer, AnalysisError, AnalysisRefused, ClaudeOutfitAnalyzer

log = logging.getLogger("bollylook")
STATIC_DIR = Path(__file__).parent / "static"

ContextField = Annotated[str | None, Form(max_length=200)]


def create_app(settings: Settings | None = None, analyzer: Analyzer | None = None) -> FastAPI:
    """App factory. Run with: uvicorn bollylook.main:create_app --factory"""
    logging.basicConfig(level=logging.INFO)
    settings = settings or get_settings()
    settings.media_dir.mkdir(parents=True, exist_ok=True)
    repo = Repository(settings.db_path)
    if analyzer is None:
        client = anthropic.AsyncAnthropic()
        if not (client.api_key or client.auth_token or client._token_cache):
            log.warning("No Anthropic credentials found (set ANTHROPIC_API_KEY); new uploads will fail, "
                        "catalog scenes still work")
        analyzer = ClaudeOutfitAnalyzer(client, settings.claude_model, settings.claude_effort)
    service = LookService(repo, analyzer, settings)

    app = FastAPI(title="BollyLook API", version="0.1.0")

    def require_admin(x_admin_token: Annotated[str | None, Header()] = None) -> None:
        if not settings.admin_token:
            raise HTTPException(503, "admin API is disabled; set BOLLYLOOK_ADMIN_TOKEN")
        if not x_admin_token or not secrets.compare_digest(x_admin_token, settings.admin_token):
            raise HTTPException(401, "invalid admin token")

    async def read_image(upload: UploadFile) -> NormalizedImage:
        max_bytes = settings.max_upload_mb * 1024 * 1024
        data = await upload.read(max_bytes + 1)
        if len(data) > max_bytes:
            raise HTTPException(413, f"image must be under {settings.max_upload_mb} MB")
        try:
            return await run_in_threadpool(normalize_image, data, settings.max_image_edge)
        except InvalidImage as exc:
            raise HTTPException(422, str(exc)) from exc

    async def get_or_create(image: NormalizedImage, context: SceneContext, request: Request, enforce_limits: bool):
        client_key = request.client.host if request.client else "unknown"
        try:
            return await service.get_or_create(image, context, client_key, enforce_limits=enforce_limits)
        except RateLimited as exc:
            raise HTTPException(429, str(exc), headers={"Retry-After": str(exc.retry_after)}) from exc
        except DailyCapReached as exc:
            raise HTTPException(503, "we've hit today's limit for new scenes; try a scene from the catalog") from exc
        except AnalysisRefused as exc:
            raise HTTPException(422, "we couldn't analyse this image; try a different still") from exc
        except AnalysisError as exc:
            log.warning("analysis failed: %s", exc)
            raise HTTPException(502, "outfit analysis failed; please try again") from exc
        except anthropic.RateLimitError as exc:
            raise HTTPException(503, "we're busy right now; please try again in a minute") from exc
        except (anthropic.APIStatusError, anthropic.APIConnectionError) as exc:
            log.error("Claude API error: %r", exc)
            raise HTTPException(502, "outfit analysis is temporarily unavailable") from exc

    def scene_out(scene: SceneRecord) -> SceneOut:
        return SceneOut(
            id=scene.id, movie=scene.movie, year=scene.year, scene=scene.scene,
            image_url=f"/media/{scene.image_file}", look_id=scene.look_id, created_at=scene.created_at,
        )

    def scene_detail(scene: SceneRecord) -> SceneDetailOut:
        look = repo.get_look(scene.look_id)
        return SceneDetailOut(**scene_out(scene).model_dump(), look=to_look_out(look, cached=True))

    # --- public API ---

    @app.get("/healthz")
    def healthz() -> dict:
        return {"ok": True}

    @app.post("/api/looks", response_model=LookOut, status_code=201)
    async def create_look(
        request: Request,
        response: Response,
        image: Annotated[UploadFile, File()],
        movie: ContextField = None,
        scene: ContextField = None,
        notes: ContextField = None,
    ) -> LookOut:
        """Break down the outfits in an uploaded still. Repeat uploads of the same frame are served from cache."""
        normalized = await read_image(image)
        look, cached = await get_or_create(
            normalized, SceneContext(movie=movie, scene=scene, notes=notes), request, enforce_limits=True
        )
        if cached:
            response.status_code = 200
        return to_look_out(look, cached)

    @app.get("/api/looks/{look_id}", response_model=LookOut)
    def get_look(look_id: str) -> LookOut:
        look = repo.get_look(look_id)
        if not look:
            raise HTTPException(404, "look not found")
        return to_look_out(look, cached=True)

    @app.get("/api/scenes", response_model=list[SceneOut])
    def list_scenes(q: Annotated[str | None, Query(max_length=100)] = None) -> list[SceneOut]:
        return [scene_out(s) for s in repo.list_scenes(q)]

    @app.get("/api/scenes/{scene_id}", response_model=SceneDetailOut)
    def get_scene(scene_id: str) -> SceneDetailOut:
        scene = repo.get_scene(scene_id)
        if not scene:
            raise HTTPException(404, "scene not found")
        return scene_detail(scene)

    @app.get("/go/{look_id}/{garment_index}/{store}/{kind}")
    def go(look_id: str, garment_index: int, store: StoreKey, kind: LinkKind, request: Request) -> RedirectResponse:
        """Record an outbound shopping click, then redirect to the affiliate-tagged store search."""
        look = repo.get_look(look_id)
        if not look or not 0 <= garment_index < len(look.analysis.garments):
            raise HTTPException(404, "link not found")
        garment = look.analysis.garments[garment_index]
        repo.record_click(look_id, garment_index, store, kind, request.headers.get("referer"))
        url = build_store_url(store, query_for(garment, kind), settings)
        return RedirectResponse(url, status_code=302, headers={"Cache-Control": "no-store", "X-Robots-Tag": "noindex"})

    # --- admin API ---

    @app.post("/api/admin/scenes", response_model=SceneDetailOut, status_code=201, dependencies=[Depends(require_admin)])
    async def add_scene(
        request: Request,
        image: Annotated[UploadFile, File()],
        movie: Annotated[str, Form(min_length=1, max_length=200)],
        year: Annotated[int | None, Form(ge=1900, le=2100)] = None,
        scene: ContextField = None,
        notes: ContextField = None,
    ) -> SceneDetailOut:
        """Add a curated scene to the catalog. It is analysed once, then served to every user from cache."""
        normalized = await read_image(image)
        look, _ = await get_or_create(
            normalized, SceneContext(movie=movie, scene=scene, notes=notes), request, enforce_limits=False
        )
        image_file = f"{normalized.phash[:24]}.jpg"
        (settings.media_dir / image_file).write_bytes(normalized.jpeg)
        return scene_detail(repo.add_scene(movie, year, scene, look.id, image_file))

    @app.get("/api/admin/stats", dependencies=[Depends(require_admin)])
    def stats() -> dict:
        return repo.click_stats()

    app.mount("/media", StaticFiles(directory=settings.media_dir), name="media")
    app.mount("/", StaticFiles(directory=STATIC_DIR, html=True), name="static")
    return app
