"""Themes for layout documents: the built-in ones and people's saved ones.

A theme is a partial @docforge/layout token set. Applying it is one `setTokens`
op (plus `setMeta` with its name), so the document keeps the values and never
depends on the theme afterwards. Every built-in theme sets the whole palette,
both fonts and the radii, so switching themes never leaves a value behind.
Saved themes are completed the same way when applied (`complete`).
"""

import copy
from typing import Any

# The library's defaults (src/schema/tokens.ts): what a theme falls back to.
DEFAULT_COLORS: dict[str, str] = {
    "text": "#1a1c1e",
    "muted": "#5b6168",
    "primary": "#1f4fd8",
    "surface": "#ffffff",
    "subtle": "#f3f4f6",
    "border": "#d9dce1",
    "success": "#1e8e3e",
    "danger": "#c5221f",
    "warning": "#b06000",
    "highlight": "#fff3b0",
    "chart1": "#1f4fd8",
    "chart2": "#e8710a",
    "chart3": "#1e8e3e",
    "chart4": "#9334e6",
    "chart5": "#d01884",
    "chart6": "#12a4af",
}
DEFAULT_FONTS: dict[str, str] = {"sans": "Inter", "heading": "Inter", "mono": "JetBrains Mono"}
DEFAULT_RADIUS: dict[str, int] = {"none": 0, "s": 4, "m": 8}

# Families the layout engine can measure (bundled with the library).
FONT_FAMILIES = ("Inter", "Source Serif 4", "Space Grotesk", "JetBrains Mono")


def _theme(key: str, name: str, description: str, colors: dict[str, str], fonts: dict[str, str] | None = None, radius: dict[str, int] | None = None) -> dict[str, Any]:
    return {
        "id": f"builtin:{key}",
        "key": key,
        "name": name,
        "description": description,
        "builtin": True,
        "tokens": {
            "color": {**DEFAULT_COLORS, **colors},
            "font": {**DEFAULT_FONTS, **(fonts or {})},
            "radius": {**DEFAULT_RADIUS, **(radius or {})},
        },
    }


BUILTIN_THEMES: list[dict[str, Any]] = [
    _theme(
        "sober", "Sóbrio", "Azul sobre branco, neutro para qualquer documento.",
        {"text": "#1a1c1e", "muted": "#5b6168", "primary": "#1f4fd8", "subtle": "#f3f4f6", "border": "#d9dce1", "highlight": "#fff3b0", "chart1": "#1f4fd8", "chart2": "#e8710a"},
    ),
    _theme(
        "executive", "Executivo", "Azul-marinho e âmbar, para diretoria e clientes.",
        {"text": "#14213d", "muted": "#4a5568", "primary": "#14213d", "subtle": "#eef1f6", "border": "#cfd6e2", "highlight": "#fde8b0", "chart1": "#14213d", "chart2": "#f2a20c", "chart3": "#5a7896", "chart4": "#8d99ae"},
    ),
    _theme(
        "green", "Verde", "Verde profundo, calmo, bom para sustentabilidade e finanças.",
        {"text": "#10241c", "muted": "#4f6159", "primary": "#0b6e4f", "subtle": "#eef5f1", "border": "#cfe0d7", "highlight": "#fdeec4", "chart1": "#0b6e4f", "chart2": "#d97706", "chart3": "#3d9970", "chart4": "#8fb9a8"},
    ),
    _theme(
        "forge", "Forja", "Laranja da DocForge com aço, enérgico.",
        {"text": "#1b1b1b", "muted": "#5c5c5c", "primary": "#d94100", "subtle": "#f4f2f0", "border": "#e0dcd8", "highlight": "#ffe8d9", "chart1": "#d94100", "chart2": "#5a7896", "chart3": "#f2a20c", "chart4": "#8a8a8a"},
    ),
    _theme(
        "editorial", "Editorial", "Títulos com serifa sobre papel creme, para relatórios e propostas longas.",
        {"text": "#22201c", "muted": "#6b645a", "primary": "#8a3b12", "surface": "#fbf8f3", "subtle": "#f1ebe1", "border": "#e2d9cb", "highlight": "#f7e3b5", "chart1": "#8a3b12", "chart2": "#3f6e8c", "chart3": "#b08d57", "chart4": "#6b645a", "chart5": "#a35d6a", "chart6": "#5b7f63"},
        fonts={"heading": "Source Serif 4"},
        radius={"s": 2, "m": 3},
    ),
    _theme(
        "tech", "Tech", "Títulos geométricos e violeta, para produto e engenharia.",
        {"text": "#16151d", "muted": "#5e5b6e", "primary": "#5b4fe0", "subtle": "#f2f1fb", "border": "#dcd9ef", "highlight": "#e6fbd8", "chart1": "#5b4fe0", "chart2": "#12a4af", "chart3": "#f25f5c", "chart4": "#ffb400", "chart5": "#9b8cff", "chart6": "#2bb673"},
        fonts={"heading": "Space Grotesk"},
        radius={"s": 6, "m": 12},
    ),
    _theme(
        "night", "Noite", "Página escura com texto claro; ótima para slides.",
        {"text": "#eef0f3", "muted": "#a4abb6", "primary": "#7aa2ff", "surface": "#14161a", "subtle": "#1f232a", "border": "#2e343d", "success": "#4ccf7a", "danger": "#ff6b6b", "warning": "#f5b84a", "highlight": "#3a3220", "chart1": "#7aa2ff", "chart2": "#f5b84a", "chart3": "#4ccf7a", "chart4": "#c792ea", "chart5": "#ff7eb6", "chart6": "#4dd0e1"},
        fonts={"heading": "Space Grotesk"},
    ),
]
BUILTIN_BY_ID = {t["id"]: t for t in BUILTIN_THEMES}


def builtin_themes() -> list[dict[str, Any]]:
    return copy.deepcopy(BUILTIN_THEMES)


def complete(tokens: dict[str, Any]) -> dict[str, Any]:
    """A saved theme's tokens with every color, font and radius filled in, so applying it resets what it does not set."""
    out = copy.deepcopy(tokens)
    out["color"] = {**DEFAULT_COLORS, **(tokens.get("color") or {})}
    out["font"] = {**DEFAULT_FONTS, **(tokens.get("font") or {})}
    out["radius"] = {**DEFAULT_RADIUS, **(tokens.get("radius") or {})}
    return out


def apply_ops(theme: dict[str, Any]) -> list[dict[str, Any]]:
    """The operations that apply a theme to a document."""
    return [
        {"op": "setTokens", "tokens": complete(theme["tokens"])},
        {"op": "setMeta", "meta": {"theme": theme["name"][:120]}},
    ]
