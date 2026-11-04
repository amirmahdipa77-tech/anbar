#!/usr/bin/env python3
"""Draw Anbar's app icons — a branch mark, flat, no gradients.

    python tools/make_icons.py

Writes the files Expo expects into assets/: icon.png, adaptive foreground and
background, a monochrome layer, the splash mark and the favicon.
"""
import os
from PIL import Image, ImageDraw

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ASSETS = os.path.join(ROOT, "assets")
BG = (15, 16, 18)          # #0F1012
INK = (236, 237, 239)      # #ECEDEF


def mark(size, color, weight=0.052, scale=1.0):
    """A git-branch glyph: two nodes on a trunk, one on a branch."""
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    s = size
    cx, cy = s / 2, s / 2
    span = s * 0.46 * scale
    trunk_x = cx - span * 0.42
    branch_x = cx + span * 0.42
    top_y, mid_y, bot_y = cy - span * 0.55, cy, cy + span * 0.55
    w = max(2, int(s * weight))
    r = span * 0.19

    draw.line([(trunk_x, top_y), (trunk_x, bot_y)], fill=color, width=w)
    draw.line([(trunk_x, mid_y), (branch_x - span * 0.16, mid_y - span * 0.05)], fill=color, width=w)
    draw.line([(branch_x - span * 0.16, mid_y - span * 0.05), (branch_x, mid_y + span * 0.02)], fill=color, width=w)
    for px, py in [(trunk_x, top_y), (trunk_x, bot_y), (branch_x, mid_y + span * 0.02)]:
        draw.ellipse([px - r, py - r, px + r, py + r], fill=color)
    return img


def save(img, name):
    path = os.path.join(ASSETS, name)
    img.save(path)
    print("wrote", os.path.relpath(path, ROOT))


# full-bleed icon
icon = Image.new("RGBA", (1024, 1024), BG + (255,))
icon.alpha_composite(mark(1024, INK + (255,), scale=0.62))
save(icon, "icon.png")

# adaptive icon layers
foreground = mark(1024, INK + (255,), scale=0.46)
save(foreground, "android-icon-foreground.png")
save(Image.new("RGBA", (1024, 1024), BG + (255,)), "android-icon-background.png")
save(mark(1024, (255, 255, 255, 255), scale=0.46), "android-icon-monochrome.png")

# splash + favicon
save(mark(512, INK + (255,), scale=0.9), "splash-icon.png")
save(icon.resize((64, 64), Image.LANCZOS), "favicon.png")
