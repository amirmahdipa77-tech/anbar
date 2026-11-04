#!/usr/bin/env python3
"""Bundle Anbar into one self-contained HTML file.

Handy when you want a single file you can double-click on Windows, drop on a USB
stick, or email to someone. Everything (CSS, JS, icons) is inlined, so the file
works with no server and no network.

Usage:
    python tools/build_single_file.py [--out dist/anbar.html]
"""
import argparse
import base64
import os
import re

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def read(*parts):
    with open(os.path.join(ROOT, *parts), encoding="utf-8") as handle:
        return handle.read()


def data_uri(path):
    with open(os.path.join(ROOT, path), "rb") as handle:
        return "data:image/png;base64," + base64.b64encode(handle.read()).decode()


def build():
    html = read("index.html")

    css = read("assets", "css", "anbar.css")
    html = re.sub(
        r'<link rel="stylesheet" href="assets/css/anbar.css">',
        "<style>\n" + css + "\n</style>",
        html,
    )

    for script in ("diff.js", "store.js", "app.js"):
        source = read("assets", "js", script)
        html = html.replace(
            '<script src="assets/js/%s"></script>' % script,
            "<script>\n" + source + "\n</script>",
        )

    # icons become data URIs
    for icon in ("icon-192.png", "icon-512.png", "icon-maskable-512.png"):
        html = html.replace("assets/icons/" + icon, data_uri(os.path.join("assets", "icons", icon)))

    # the manifest and service worker make no sense inside a single file
    html = re.sub(r'\s*<link rel="manifest"[^>]*>', "", html)
    html = html.replace(
        '<meta name="theme-color" content="#0a0d14">',
        '<meta name="theme-color" content="#0a0d14">\n<!-- Single-file build: no manifest, no service worker. -->',
    )
    return html


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--out", default=os.path.join("dist", "anbar.html"))
    args = parser.parse_args()

    html = build()
    out = os.path.join(ROOT, args.out)
    os.makedirs(os.path.dirname(out), exist_ok=True)
    with open(out, "w", encoding="utf-8") as handle:
        handle.write(html)
    print("wrote %s (%.1f KB)" % (out, len(html.encode("utf-8")) / 1024))


if __name__ == "__main__":
    main()
