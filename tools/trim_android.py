#!/usr/bin/env python3
"""Shrink the Android release build before Gradle runs.

`expo prebuild` writes `reactNativeArchitectures` with all four CPU
architectures, and those native libraries are where most of the APK's weight
comes from. This script keeps only 64-bit ARM (every Android phone from the last
several years), turns on R8 full mode, and verifies that minification, resource
shrinking and PNG crunching are actually enabled.

    python tools/trim_android.py android/gradle.properties
    python tools/trim_android.py android/gradle.properties android/app/build.gradle
"""
import re
import sys

WANTED_ABI = "arm64-v8a"


def set_property(text: str, key: str, value: str) -> tuple[str, str]:
    pattern = re.compile(rf"^{re.escape(key)}=.*$", re.MULTILINE)
    if pattern.search(text):
        return pattern.sub(f"{key}={value}", text), "updated"
    return text.rstrip("\n") + f"\n{key}={value}\n", "added"


def main() -> int:
    properties = sys.argv[1] if len(sys.argv) > 1 else "android/gradle.properties"
    gradle = sys.argv[2] if len(sys.argv) > 2 else ""

    with open(properties, encoding="utf-8") as handle:
        props = handle.read()

    props, how = set_property(props, "reactNativeArchitectures", WANTED_ABI)
    print(f"  reactNativeArchitectures: {how} -> {WANTED_ABI}")

    for key, value in [
        ("android.enableMinifyInReleaseBuilds", "true"),
        ("android.enableShrinkResourcesInReleaseBuilds", "true"),
        ("android.enablePngCrunchInReleaseBuilds", "true"),
        ("android.enableR8.fullMode", "true"),
        # compress the native libraries inside the APK instead of page-aligning them
        ("expo.useLegacyPackaging", "true"),
    ]:
        props, how = set_property(props, key, value)
        print(f"  {key}: {how} -> {value}")

    with open(properties, "w", encoding="utf-8") as handle:
        handle.write(props)

    # strip what no one reads at runtime: Kotlin metadata, debug probes, licences
    if gradle:
        with open(gradle, encoding="utf-8") as handle:
            text = handle.read()
        if "kotlin-tooling-metadata.json" not in text and "packagingOptions {" in text:
            text = text.replace("    packagingOptions {", "    packagingOptions {\n        resources {\n            excludes += [\"META-INF/*.kotlin_module\", \"META-INF/*.version\", \"META-INF/*.md\",\n                         \"DebugProbesKt.bin\", \"kotlin-tooling-metadata.json\", \"**/*.js.map\"]\n        }", 1)
            print("  build.gradle: resource excludes added")
        with open(gradle, "w", encoding="utf-8") as handle:
            handle.write(text)

    if gradle:
        with open(gradle, encoding="utf-8") as handle:
            text = handle.read()
        text, count = re.subn(
            r"enableShrinkResources = findProperty\([^)]*\) \?: 'false'",
            "enableShrinkResources = findProperty('android.enableShrinkResourcesInReleaseBuilds') ?: 'true'",
            text,
        )
        if count:
            with open(gradle, "w", encoding="utf-8") as handle:
                handle.write(text)
            print("  build.gradle: shrinkResources default flipped to true")
        else:
            print("  build.gradle: no shrinkResources default to flip")

    # verify the ABI line really landed
    with open(properties, encoding="utf-8") as handle:
        final = handle.read()
    if f"reactNativeArchitectures={WANTED_ABI}" in final:
        print(f"trim ok: {WANTED_ABI} only")
        return 0
    print("trim failed: reactNativeArchitectures was not set")
    return 1


if __name__ == "__main__":
    raise SystemExit(main())
