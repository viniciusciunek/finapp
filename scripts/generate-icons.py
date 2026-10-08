#!/usr/bin/env python3
"""
Gera os ícones do PWA (favicon, ícones do manifest e apple-touch-icon).

Por que um script e não arquivos "mágicos" soltos no repositório:
  - a origem do design fica versionada e **reproduzível** (ajustou a cor do
    app? roda o script de novo e todos os ícones são regerados);
  - evita "ícone desatualizado" quando alguém mudar a identidade visual.

Usa apenas Python 3 + Pillow (já disponível no ambiente de desenvolvimento).

Uso:
    python3 scripts/generate-icons.py

Saídas:
    src/app/favicon.ico     16/32/48 (cantos arredondados) — convenção do App Router
    src/app/icon.png        192x192 — convenção do App Router
    src/app/apple-icon.png  180x180 — convenção do App Router (iOS)
    public/icons/icon-192.png       192x192 — referenciado pelo manifest, "any"
    public/icons/icon-512.png       512x512 — referenciado pelo manifest, "any"
    public/icons/maskable-512.png   512x512 — referenciado pelo manifest, "maskable"

Por que duas pastas:
  - `src/app/` usa a **convenção de arquivo** do App Router: o Next gera sozinho
    as tags `<link rel="icon">` e `<link rel="apple-touch-icon">`.
  - `public/icons/` é referenciado **à mão** pelo manifest (`src/app/manifest.ts`),
    que precisa de URLs fixas.
"""

from __future__ import annotations

import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

# ---------------------------------------------------------------------------
# Identidade visual do ícone
# ---------------------------------------------------------------------------

# Verde esmeralda: combina com um app de finanças sem competir com a interface
# (que é neutra, base do shadcn/ui).
GRADIENT_TOP = (16, 185, 129)  # #10B981
GRADIENT_BOTTOM = (4, 120, 87)  # #047857
GLYPH = "R$"
GLYPH_COLOR = (255, 255, 255, 255)

# Cantos arredondados (proporção do lado). iOS/Android aplicam suas próprias
# máscaras; ícones "any" com cantos arredondados ficam melhores no desktop.
CORNER_RATIO = 0.22

# Fontes em negrito candidatas, na ordem de preferência. O script falha com
# mensagem clara se nenhuma existir (em vez de gerar um ícone feio).
FONT_CANDIDATES = [
    "/usr/share/fonts/open-sans/OpenSans-ExtraBold.ttf",
    "/usr/share/fonts/open-sans/OpenSans-Bold.ttf",
    "/usr/share/fonts/liberation-sans-fonts/LiberationSans-Bold.ttf",
    "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
]

ROOT = Path(__file__).resolve().parent.parent
PUBLIC = ROOT / "public"
ICONS = PUBLIC / "icons"
APP = ROOT / "src" / "app"


def load_font(size: int) -> ImageFont.FreeTypeFont:
    for candidate in FONT_CANDIDATES:
        if Path(candidate).exists():
            return ImageFont.truetype(candidate, size)

    raise SystemExit(
        "Nenhuma fonte em negrito encontrada. Instale uma das fontes de "
        f"FONT_CANDIDATES ou ajuste a lista no script.\nTentei: {FONT_CANDIDATES}"
    )


def vertical_gradient(size: int) -> Image.Image:
    """Fundo em gradiente vertical, de cima para baixo."""
    gradient = Image.new("RGB", (1, size))
    draw = ImageDraw.Draw(gradient)

    for y in range(size):
        t = y / max(size - 1, 1)
        color = tuple(
            round(top + (bottom - top) * t)
            for top, bottom in zip(GRADIENT_TOP, GRADIENT_BOTTOM)
        )
        draw.point((0, y), fill=color)

    return gradient.resize((size, size))


def rounded_mask(size: int, radius: int) -> Image.Image:
    mask = Image.new("L", (size, size), 0)
    ImageDraw.Draw(mask).rounded_rectangle((0, 0, size - 1, size - 1), radius=radius, fill=255)
    return mask


def draw_glyph(image: Image.Image, font_ratio: float) -> None:
    """Desenha o 'R$' centralizado. `font_ratio` é o tamanho da fonte sobre o lado."""
    size = image.width
    font = load_font(round(size * font_ratio))
    draw = ImageDraw.Draw(image)

    # `anchor="mm"` centraliza o texto na coordenada (meio horizontal, meio vertical).
    draw.text((size / 2, size / 2), GLYPH, font=font, fill=GLYPH_COLOR, anchor="mm")


def icon(size: int, *, rounded: bool, font_ratio: float, opaque_background: bool) -> Image.Image:
    background = vertical_gradient(size).convert("RGBA")
    draw_glyph(background, font_ratio)

    if not rounded:
        return background if opaque_background else background

    radius = round(size * CORNER_RATIO)
    canvas = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    canvas.paste(background, (0, 0), rounded_mask(size, radius))
    return canvas


def main() -> None:
    ICONS.mkdir(parents=True, exist_ok=True)

    # ------------------------------------------------------------------
    # src/app/ — convenção de arquivo do App Router (Next gera as tags <link>)
    # ------------------------------------------------------------------

    # iOS: quadrado, sem transparência (o iOS pinta preto onde há transparência).
    icon(180, rounded=False, font_ratio=0.50, opaque_background=True).save(APP / "apple-icon.png")

    # Ícone geral (favicon/atalho). 192 é um bom meio-termo de nitidez e peso.
    icon(192, rounded=True, font_ratio=0.50, opaque_background=False).save(APP / "icon.png")

    # Favicon com vários tamanhos dentro de um único .ico
    icon(48, rounded=True, font_ratio=0.50, opaque_background=False).save(
        APP / "favicon.ico", sizes=[(16, 16), (32, 32), (48, 48)]
    )

    # ------------------------------------------------------------------
    # public/icons/ — URLs fixas usadas pelo manifest
    # ------------------------------------------------------------------

    # Ícones "any" do manifest: cantos arredondados, glifo grande.
    icon(192, rounded=True, font_ratio=0.50, opaque_background=False).save(ICONS / "icon-192.png")
    icon(512, rounded=True, font_ratio=0.50, opaque_background=False).save(ICONS / "icon-512.png")

    # Maskable: o sistema recorta a imagem (círculo, squircle...), então o fundo
    # precisa ir até a borda e o glifo tem de caber na "zona segura" (80% centrais).
    icon(512, rounded=False, font_ratio=0.40, opaque_background=True).save(
        ICONS / "maskable-512.png"
    )

    generated = [
        APP / "favicon.ico",
        APP / "icon.png",
        APP / "apple-icon.png",
        ICONS / "icon-192.png",
        ICONS / "icon-512.png",
        ICONS / "maskable-512.png",
    ]

    print("Ícones gerados:")
    for path in generated:
        print(f"  {path.relative_to(ROOT)}  ({path.stat().st_size} bytes)")


if __name__ == "__main__":
    sys.exit(main())
