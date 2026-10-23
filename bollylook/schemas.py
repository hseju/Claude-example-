from typing import Literal

from pydantic import BaseModel, Field

GarmentCategory = Literal[
    "saree", "blouse", "lehenga", "dupatta", "salwar_kameez", "kurta", "anarkali",
    "sherwani", "nehru_jacket", "dhoti", "shirt", "t_shirt", "top", "dress", "gown",
    "skirt", "jeans", "trousers", "shorts", "jacket", "blazer", "suit", "coat",
    "sweater", "hoodie", "sunglasses", "footwear", "jewellery", "watch", "bag",
    "belt", "hat", "scarf", "other",
]


# --- What Claude returns (used as the structured-output schema) ---

class Garment(BaseModel):
    category: GarmentCategory
    name: str = Field(description="Short shop-style name, e.g. 'Red sequinned chiffon saree'")
    worn_by: str = Field(description="Who wears it, by position/appearance only, e.g. 'woman in the centre'")
    gender: Literal["women", "men", "unisex", "kids"]
    colors: list[str]
    pattern: str = Field(description="e.g. 'solid', 'floral print', 'sequinned', 'checked'")
    material: str = Field(description="Best guess at fabric/material, or 'unknown'")
    details: str = Field(description="Cut, neckline, sleeves, embroidery, fit - whatever sets it apart")
    exact_query: str = Field(description="Store search query for the closest match")
    dupe_query: str = Field(description="Broader store search query for a budget-friendly dupe")
    confidence: Literal["high", "medium", "low"] = Field(description="How clearly the item is visible")


class LookAnalysis(BaseModel):
    summary: str = Field(description="One sentence on the overall look, or why no outfit could be read")
    garments: list[Garment]


# --- What the API returns ---

class SceneContext(BaseModel):
    movie: str | None = None
    scene: str | None = None
    notes: str | None = None


StoreKey = Literal["myntra", "ajio", "amazon"]
LinkKind = Literal["exact", "dupe"]


class ShopLink(BaseModel):
    store: StoreKey
    store_name: str
    kind: LinkKind
    query: str
    url: str


class GarmentOut(Garment):
    index: int
    links: list[ShopLink]


class LookOut(BaseModel):
    id: str
    cached: bool
    summary: str
    context: SceneContext
    garments: list[GarmentOut]
    created_at: str


class SceneOut(BaseModel):
    id: str
    movie: str
    year: int | None
    scene: str | None
    image_url: str
    look_id: str
    created_at: str


class SceneDetailOut(SceneOut):
    look: LookOut
