#!/usr/bin/env python3
"""Shrink the Android release build before Gradle runs.

`expo prebuild` writes a React Native project that keeps every CPU architecture,
which is where most of the APK's size comes from. This script keeps only the
64-bit ARM libraries and, when the template still exposes them, forces R8 and
resource shrinking on. The expo-build-properties plugin already turns those on,
so a missing flag here is not an error — a missing ABI filter is.

    python tools/trim_android.py android/app/build.gradle android/gradle.properties
"""
import re
import sys

ABI_BLOCK = '\n        ndk {\n            abiFilters "arm64-v8a"\n        }\n'


def force_true(text: str, flag: str) -> tuple[str, bool]:
    """Set `<flag> = false` to true wherever the template declares it."""
    pattern = re.compile(rf"({re.escape(flag)}\s*=\s*)false")
    if pattern.search(text):
        return pattern.sub(r"\1true", text), True
    return text, False


def main() -> int:
    gradle = sys.argv[1] if len(sys.argv) > 1 else "android/app/build.gradle"
    properties = sys.argv[2] if len(sys.argv) > 2 else "android/gradle.properties"

    with open(gradle, encoding="utf-8") as handle:
        text = handle.read()

    text, proguard = force_true(text, "enableProguardInReleaseBuilds")
    text, shrink = force_true(text, "enableShrinkResourcesInReleaseBuilds")
    print(f"  proguard flag in build.gradle: {'set' if proguard else 'not present (plugin handles it)'}")
    print(f"  shrinkResources flag:          {'set' if shrink else 'not present (plugin handles it)'}")

    abi_ok = "abiFilters" in text
    if not abi_ok:
        if "defaultConfig {" in text:
            text = text.replace("defaultConfig {", "defaultConfig {" + ABI_BLOCK, 1)
            abi_ok = True
            print("  abiFilters: inserted into defaultConfig")
        else:
            print("  abiFilters: FAILED — no defaultConfig block found")

    with open(gradle, "w", encoding="utf-8") as handle:
        handle.write(text)

    with open(properties, encoding="utf-8") as handle:
        props = handle.read()
    if "android.enableR8.fullMode" not in props:
        props = props.rstrip("\n") + "\nandroid.enableR8.fullMode=true\n"
        with open(properties, "w", encoding="utf-8") as handle:
            handle.write(props)
        print("  gradle.properties: enabled R8 full mode")
    else:
        print("  gradle.properties: R8 full mode already set")

    if not abi_ok:
        print("trim failed: the APK would still carry every architecture")
        return 1
    print("trim ok: arm64-v8a only")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
