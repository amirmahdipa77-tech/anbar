#!/usr/bin/env python3
"""Shrink the Android release build before Gradle runs.

`expo prebuild` writes a plain React Native project with minification off and
every CPU architecture bundled. This script turns on R8 + resource shrinking and
keeps only the 64-bit ARM libraries, which is where nearly all the megabytes go.

    python tools/trim_android.py android/app/build.gradle android/gradle.properties
"""
import re
import sys


def patch(path, replacements, inserts=None):
    with open(path, encoding="utf-8") as handle:
        text = handle.read()
    for old, new in replacements:
        if old in text:
            text = text.replace(old, new)
            print(f"  {path}: {old.strip()[:60]} -> on")
        else:
            print(f"  {path}: pattern not found, skipped: {old.strip()[:60]}")
    for anchor, block in (inserts or []):
        if block.strip() in text:
            print(f"  {path}: already has the block after {anchor.strip()[:40]}")
            continue
        if anchor in text:
            text = text.replace(anchor, anchor + block, 1)
            print(f"  {path}: inserted block after {anchor.strip()[:40]}")
        else:
            print(f"  {path}: anchor missing, skipped: {anchor.strip()[:40]}")
    with open(path, "w", encoding="utf-8") as handle:
        handle.write(text)


def main():
    gradle = sys.argv[1] if len(sys.argv) > 1 else "android/app/build.gradle"
    properties = sys.argv[2] if len(sys.argv) > 2 else "android/gradle.properties"

    patch(
        gradle,
        [
            ("def enableProguardInReleaseBuilds = false", "def enableProguardInReleaseBuilds = true"),
            ("def enableShrinkResourcesInReleaseBuilds = false", "def enableShrinkResourcesInReleaseBuilds = true"),
        ],
        inserts=[
            (
                "defaultConfig {",
                '\n        ndk {\n            abiFilters "arm64-v8a"\n        }\n',
            )
        ],
    )

    patch(
        properties,
        [
            ("android.enableR8.fullMode=false", "android.enableR8.fullMode=true"),
        ],
        inserts=[
            ("android.useAndroidX=true", "\nandroid.enableR8.fullMode=true\n"),
        ],
    )

    # verify the two switches really landed
    with open(gradle, encoding="utf-8") as handle:
        text = handle.read()
    ok = "enableProguardInReleaseBuilds = true" in text and "abiFilters" in text
    print("trim ok" if ok else "trim incomplete — check the patterns above")
    return 0 if ok else 1


if __name__ == "__main__":
    raise SystemExit(main())
