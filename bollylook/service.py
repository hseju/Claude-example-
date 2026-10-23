import asyncio
import time
from collections import defaultdict, deque
from datetime import UTC, datetime

from .config import Settings
from .db import LookRecord, Repository
from .images import NormalizedImage
from .schemas import GarmentOut, LookOut, SceneContext, ShopLink
from .stores import LINK_KINDS, STORES, query_for
from .vision import Analyzer


class RateLimited(Exception):
    def __init__(self, retry_after: int):
        super().__init__(f"too many new analyses; retry in {retry_after}s")
        self.retry_after = retry_after


class DailyCapReached(Exception):
    pass


class SlidingWindowLimiter:
    """In-process per-key limiter. Swap for Redis once there is more than one instance."""

    def __init__(self, limit: int, window_s: float = 60.0):
        self._limit = limit
        self._window = window_s
        self._hits: dict[str, deque[float]] = defaultdict(deque)

    def check(self, key: str) -> None:
        now = time.monotonic()
        hits = self._hits[key]
        while hits and now - hits[0] > self._window:
            hits.popleft()
        if len(hits) >= self._limit:
            raise RateLimited(retry_after=int(self._window - (now - hits[0])) + 1)
        hits.append(now)


class LookService:
    def __init__(self, repo: Repository, analyzer: Analyzer, settings: Settings):
        self._repo = repo
        self._analyzer = analyzer
        self._settings = settings
        self._limiter = SlidingWindowLimiter(settings.analyses_per_ip_per_minute)
        self._inflight: dict[str, asyncio.Task[LookRecord]] = {}

    async def get_or_create(
        self, image: NormalizedImage, context: SceneContext, client_key: str, *, enforce_limits: bool = True
    ) -> tuple[LookRecord, bool]:
        """Return the look for this image, analysing it only if no one has before.

        Returns (look, cached). Identical uploads that arrive while an analysis is running
        wait on that one call instead of starting their own.
        """
        existing = self._repo.get_look_by_hash(image.phash)
        if existing:
            return existing, True

        task = self._inflight.get(image.phash)
        if task:
            return await asyncio.shield(task), True

        if enforce_limits:
            self._limiter.check(client_key)
            midnight = datetime.now(UTC).replace(hour=0, minute=0, second=0, microsecond=0)
            if self._repo.count_looks_since(midnight.isoformat(timespec="seconds")) >= self._settings.max_analyses_per_day:
                raise DailyCapReached()

        task = asyncio.create_task(self._analyze_and_save(image, context))
        self._inflight[image.phash] = task
        task.add_done_callback(lambda t: self._finish(image.phash, t))
        # shield: if this client disconnects, the analysis still completes and is cached
        return await asyncio.shield(task), False

    async def _analyze_and_save(self, image: NormalizedImage, context: SceneContext) -> LookRecord:
        analysis = await self._analyzer.analyze(image.jpeg, context)
        return self._repo.save_look(image.phash, context, analysis, self._settings.claude_model)

    def _finish(self, phash: str, task: asyncio.Task) -> None:
        self._inflight.pop(phash, None)
        if not task.cancelled():
            task.exception()  # mark retrieved so an unawaited failure doesn't log a warning


def tracking_url(look_id: str, garment_index: int, store: str, kind: str) -> str:
    return f"/go/{look_id}/{garment_index}/{store}/{kind}"


def to_look_out(look: LookRecord, cached: bool) -> LookOut:
    garments = []
    for i, g in enumerate(look.analysis.garments):
        links = [
            ShopLink(
                store=store.key,
                store_name=store.name,
                kind=kind,
                query=query_for(g, kind),
                url=tracking_url(look.id, i, store.key, kind),
            )
            for kind in LINK_KINDS
            for store in STORES.values()
        ]
        garments.append(GarmentOut(**g.model_dump(), index=i, links=links))
    return LookOut(
        id=look.id,
        cached=cached,
        summary=look.analysis.summary,
        context=look.context,
        garments=garments,
        created_at=look.created_at,
    )
