#!/usr/bin/env python3
"""Generate the Anbar app icons (no external assets, pure PIL drawing)."""
import os
import numpy as np
from PIL import Image, ImageDraw

OUT = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "assets", "icons")
os.makedirs(OUT, exist_ok=True)


def gradient(size, top=(143, 125, 255), bottom=(70, 56, 224)):
    h = size
    ramp = np.linspace(0, 1, h)[:, None]
    rows = np.zeros((h, size, 3), dtype=np.uint8)
    for c in range(3):
        col = (top[c] * (1 - ramp) + bottom[c] * ramp).astype(np.uint8)[:, 0]
        rows[:, :, c] = col[:, None]
    return Image.fromarray(rows, "RGB")


def rounded_mask(size, radius):
    mask = Image.new("L", (size, size), 0)
    d = ImageDraw.Draw(mask)
    d.rounded_rectangle([0, 0, size - 1, size - 1], radius=radius, fill=255)
    return mask


def draw_mark(img, size, pad):
    """A git-branch mark: two dots on a trunk, one on a branch."""
    d = ImageDraw.Draw(img, "RGBA")
    s = size
    w = max(2, int(s * 0.045))              # stroke width
    left_x = s * 0.36
    right_x = s * 0.64
    top_y, mid_y, bot_y = s * 0.30, s * 0.50, s * 0.70
    r = s * 0.085

    white = (255, 255, 255, 245)
    # trunk
    d.line([(left_x, top_y), (left_x, bot_y)], fill=white, width=w)
    # branch curve
    d.line([(left_x, mid_y), (right_x - s * 0.06, mid_y - s * 0.02)], fill=white, width=w)
    d.line([(right_x - s * 0.06, mid_y - s * 0.02), (right_x, mid_y + s * 0.02)], fill=white, width=w)
    # nodes
    for cx, cy in [(left_x, top_y), (left_x, bot_y), (right_x, mid_y + s * 0.02)]:
        d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=white)
    return img


def build(size, maskable=False):
    base = gradient(size)
    mark = draw_mark(base.copy(), size, 0)
    if maskable:
        canvas = Image.new("RGB", (size, size), (11, 13, 18))
        inner = int(size * 0.72)
        small = mark.resize((inner, inner), Image.LANCZOS)
        offset = (size - inner) // 2
        canvas.paste(small, (offset, offset), rounded_mask(inner, int(inner * 0.22)))
        return canvas
    out = Image.new("RGB", (size, size), (11, 13, 18))
    out.paste(mark, (0, 0), rounded_mask(size, int(size * 0.24)))
    return out


for size in (192, 512):
    build(size).save(os.path.join(OUT, f"icon-{size}.png"))
build(512, maskable=True).save(os.path.join(OUT, "icon-maskable-512.png"))
print("icons:", sorted(os.listdir(OUT)))
