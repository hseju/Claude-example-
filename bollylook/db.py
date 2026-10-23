import json
import secrets
import sqlite3
from contextlib import contextmanager
from dataclasses import dataclass
from datetime import UTC, datetime
from pathlib import Path

from .schemas import LookAnalysis, SceneContext

SCHEMA = """
CREATE TABLE IF NOT EXISTS looks (
    id          TEXT PRIMARY KEY,
    image_hash  TEXT NOT NULL UNIQUE,
    context     TEXT NOT NULL,
    analysis    TEXT NOT NULL,
    model       TEXT NOT NULL,
    created_at  TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS scenes (
    id          TEXT PRIMARY KEY,
    movie       TEXT NOT NULL,
    year        INTEGER,
    scene       TEXT,
    look_id     TEXT NOT NULL REFERENCES looks(id),
    image_file  TEXT NOT NULL,
    created_at  TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS clicks (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    look_id        TEXT NOT NULL,
    garment_index  INTEGER NOT NULL,
    store          TEXT NOT NULL,
    kind           TEXT NOT NULL,
    referrer       TEXT,
    created_at     TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS looks_created_at ON looks(created_at);
CREATE INDEX IF NOT EXISTS clicks_look ON clicks(look_id);
"""


def _now() -> str:
    return datetime.now(UTC).isoformat(timespec="seconds")


def new_id() -> str:
    return secrets.token_urlsafe(8)


@dataclass(frozen=True)
class LookRecord:
    id: str
    image_hash: str
    context: SceneContext
    analysis: LookAnalysis
    model: str
    created_at: str


@dataclass(frozen=True)
class SceneRecord:
    id: str
    movie: str
    year: int | None
    scene: str | None
    look_id: str
    image_file: str
    created_at: str


class Repository:
    """SQLite storage. One short-lived connection per call keeps it thread-safe."""

    def __init__(self, path: Path):
        self._path = path
        path.parent.mkdir(parents=True, exist_ok=True)
        with self._conn() as conn:
            conn.execute("PRAGMA journal_mode=WAL")
            conn.executescript(SCHEMA)

    @contextmanager
    def _conn(self):
        conn = sqlite3.connect(self._path, timeout=10)
        conn.row_factory = sqlite3.Row
        try:
            with conn:
                yield conn
        finally:
            conn.close()

    # --- looks ---

    @staticmethod
    def _look(row: sqlite3.Row) -> LookRecord:
        return LookRecord(
            id=row["id"],
            image_hash=row["image_hash"],
            context=SceneContext.model_validate_json(row["context"]),
            analysis=LookAnalysis.model_validate_json(row["analysis"]),
            model=row["model"],
            created_at=row["created_at"],
        )

    def get_look(self, look_id: str) -> LookRecord | None:
        with self._conn() as conn:
            row = conn.execute("SELECT * FROM looks WHERE id = ?", (look_id,)).fetchone()
        return self._look(row) if row else None

    def get_look_by_hash(self, image_hash: str) -> LookRecord | None:
        with self._conn() as conn:
            row = conn.execute("SELECT * FROM looks WHERE image_hash = ?", (image_hash,)).fetchone()
        return self._look(row) if row else None

    def save_look(self, image_hash: str, context: SceneContext, analysis: LookAnalysis, model: str) -> LookRecord:
        """Insert a look, or return the existing one if another worker saved this image first."""
        with self._conn() as conn:
            conn.execute(
                "INSERT OR IGNORE INTO looks (id, image_hash, context, analysis, model, created_at)"
                " VALUES (?, ?, ?, ?, ?, ?)",
                (new_id(), image_hash, context.model_dump_json(), analysis.model_dump_json(), model, _now()),
            )
            row = conn.execute("SELECT * FROM looks WHERE image_hash = ?", (image_hash,)).fetchone()
        return self._look(row)

    def count_looks_since(self, since_iso: str) -> int:
        with self._conn() as conn:
            return conn.execute("SELECT COUNT(*) FROM looks WHERE created_at >= ?", (since_iso,)).fetchone()[0]

    # --- scenes ---

    @staticmethod
    def _scene(row: sqlite3.Row) -> SceneRecord:
        return SceneRecord(**{k: row[k] for k in row.keys()})

    def add_scene(self, movie: str, year: int | None, scene: str | None, look_id: str, image_file: str) -> SceneRecord:
        record = SceneRecord(new_id(), movie, year, scene, look_id, image_file, _now())
        with self._conn() as conn:
            conn.execute(
                "INSERT INTO scenes (id, movie, year, scene, look_id, image_file, created_at)"
                " VALUES (?, ?, ?, ?, ?, ?, ?)",
                (record.id, movie, year, scene, look_id, image_file, record.created_at),
            )
        return record

    def get_scene(self, scene_id: str) -> SceneRecord | None:
        with self._conn() as conn:
            row = conn.execute("SELECT * FROM scenes WHERE id = ?", (scene_id,)).fetchone()
        return self._scene(row) if row else None

    def list_scenes(self, query: str | None = None, limit: int = 50) -> list[SceneRecord]:
        sql, params = "SELECT * FROM scenes", []
        if query:
            sql += " WHERE movie LIKE ? OR scene LIKE ?"
            like = f"%{query}%"
            params = [like, like]
        sql += " ORDER BY created_at DESC LIMIT ?"
        params.append(limit)
        with self._conn() as conn:
            return [self._scene(r) for r in conn.execute(sql, params).fetchall()]

    # --- clicks ---

    def record_click(self, look_id: str, garment_index: int, store: str, kind: str, referrer: str | None) -> None:
        with self._conn() as conn:
            conn.execute(
                "INSERT INTO clicks (look_id, garment_index, store, kind, referrer, created_at)"
                " VALUES (?, ?, ?, ?, ?, ?)",
                (look_id, garment_index, store, kind, (referrer or "")[:500] or None, _now()),
            )

    def click_stats(self) -> dict:
        with self._conn() as conn:
            by_store = conn.execute(
                "SELECT store, kind, COUNT(*) AS n FROM clicks GROUP BY store, kind ORDER BY n DESC"
            ).fetchall()
            top_looks = conn.execute(
                "SELECT look_id, COUNT(*) AS n FROM clicks GROUP BY look_id ORDER BY n DESC LIMIT 20"
            ).fetchall()
            totals = conn.execute(
                "SELECT (SELECT COUNT(*) FROM looks) AS looks, (SELECT COUNT(*) FROM scenes) AS scenes,"
                " (SELECT COUNT(*) FROM clicks) AS clicks"
            ).fetchone()
        return {
            "totals": dict(totals),
            "clicks_by_store": [dict(r) for r in by_store],
            "top_looks": [dict(r) for r in top_looks],
        }
