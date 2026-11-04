#!/usr/bin/env python3
"""Build the repo's documentation (README, category READMEs) from sounds.csv."""
import csv, os, textwrap

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
rows = list(csv.DictReader(open(os.path.join(ROOT, "sounds.csv"), encoding="utf-8")))

CATS = [
    ("games", "Games", "بازی‌ها",
     "Classic arcade and shooter feedback: pickups, power-ups, weapons, impacts, win and lose stings.",
     "بازخورد کلاسیک بازی: برداشتن آیتم، پاورآپ، سلاح، برخورد، برد و باخت."),
    ("nature", "Nature", "طبیعت",
     "Ambience beds and weather. The wind, rain and stream files loop seamlessly.",
     "صدای محیط و آب‌وهوا. فایل‌های باد، باران و جوی آب بی‌درز لوپ می‌شوند."),
    ("ui", "Interface", "رابط کاربری",
     "Notifications, taps, confirmations and errors for apps and websites.",
     "نوتیف، کلیک، تأیید و خطا برای اپلیکیشن و وب‌سایت."),
    ("movement", "Movement", "حرکت",
     "Footsteps, jumping and landing for characters.",
     "قدم، پرش و فرود برای شخصیت‌ها."),
]

def cat_rows(cat):
    return [r for r in rows if r["category"] == cat]

# ------------------------------------------------------------ category READMEs
for slug, en, fa, desc_en, desc_fa in CATS:
    items = cat_rows(slug)
    lines = [f"# {en} sounds — صدای {fa}", "", desc_en, "", desc_fa, ""]
    lines += ["| File | Length | Loop | Description | توضیح |", "|---|---|---|---|---|"]
    for r in items:
        lines.append(
            f"| [`{r['name']}.wav`]({r['name']}.wav) | {r['duration_s']}s | "
            f"{'yes' if r['loop'] == 'yes' else 'no'} | {r['description_en']} | {r['description_fa']} |"
        )
    lines += ["", "All files: 44.1 kHz, 16-bit PCM, mono, normalised to -1 dBFS.",
              "همه فایل‌ها: ۴۴٫۱ کیلوهرتز، ۱۶ بیت، مونو، نرمال‌شده روی ۱- دسی‌بل.",
              "", "License: CC BY 4.0 — credit **Amirmahdi Pop**. See the root `LICENSE`.",
              "لایسنس: CC BY 4.0 با ذکر نام **امیرمهدی پاپ**.", ""]
    d = os.path.join(ROOT, "sounds", slug)
    open(os.path.join(d, "README.md"), "w", encoding="utf-8").write("\n".join(lines))

# ------------------------------------------------------------ root README
table = ["| Category | Sound | Length | Loop | What it sounds like |", "|---|---|---|---|---|"]
for slug, en, fa, _, _ in CATS:
    for r in cat_rows(slug):
        table.append(
            f"| {en} | [`{r['name']}.wav`](sounds/{slug}/{r['name']}.wav) | {r['duration_s']}s | "
            f"{'yes' if r['loop'] == 'yes' else 'no'} | {r['description_en']} |"
        )
table = "\n".join(table)

total_s = sum(float(r["duration_s"]) for r in rows)
loops = sum(1 for r in rows if r["loop"] == "yes")

readme = f"""# Amirmahdi Sound Library

**A free, open sound-effect library for games, apps and videos — by Amirmahdi Pop.**

Every sound here is synthesized from pure maths with numpy and scipy. There are no
recordings, no downloaded samples and no third-party material anywhere in this
repository, so the whole library is genuinely original work and can be used
commercially without asking anyone's permission.

کتابخانهٔ آزاد و متن‌باز افکت صوتی برای بازی، اپلیکیشن و ویدیو — ساختهٔ **امیرمهدی پاپ**.
همهٔ صداها از صفر با ریاضیات و کد ساخته شده‌اند: هیچ سمپل آماده یا فایل دانلودشده‌ای در کار نیست.

| | |
|---|---|
| Sounds | **{len(rows)}** files, {total_s:.1f} seconds in total |
| Format | WAV, 44.1 kHz, 16-bit PCM, mono, normalised to −1 dBFS |
| Folders | `games/` · `nature/` · `ui/` · `movement/` |
| Loops | {loops} seamless loops (wind, rain, stream) |
| Audio license | CC BY 4.0 — free for commercial use, credit **Amirmahdi Pop** |
| Code license | MIT |
| Repo size | about 3 MB |

---

## Catalog

{table}

## Folder structure

```
amirmahdi-sound-library/
├── sounds/
│   ├── games/       coin, powerup, explosion, laser, gunshot, hit, game-over, level-up
│   ├── nature/      wind, rain, thunder, stream  (wind/rain/stream loop)
│   ├── ui/          notification, click, success, error, message
│   └── movement/    footstep-gravel, footstep-wood, jump, land
├── sounds.csv       machine-readable catalog: category, name, duration, loop, license
├── tools/
│   └── generate_sounds.py   the generator that produces every file
├── LICENSE          CC BY 4.0 for the audio
├── LICENSE-CODE     MIT for the generator script
└── README.md
```

Each folder has its own `README.md` with the full description of every sound in it.

## Using the sounds

**Clone everything**

```bash
git clone https://github.com/amirmahdipa77-tech/amirmahdi-sound-library.git
```

**Or grab a single file** — open the folder you need on GitHub and click *Download*.
The files are plain WAV, so they drop into any engine without conversion.

Android (Kotlin, `SoundPool` — good for short UI and game sounds):

```kotlin
val pool = SoundPool.Builder().setMaxStreams(8).build()
val click = pool.load(context, R.raw.click, 1)
pool.play(click, 1f, 1f, 1, 0, 1f)
```

Unity — drop the WAV into `Assets/` and assign it to an `AudioSource`.
Godot 4 — drop it in the project, use an `AudioStreamPlayer`.
Web — `<audio src="sounds/ui/notification.wav"></audio>` or the Web Audio API.

For the looping files (wind, rain, stream) enable looping in your engine; they are
built to wrap without a click.

## Regenerating or extending the library

```bash
pip install numpy scipy soundfile
python tools/generate_sounds.py
```

The script rewrites every WAV and `sounds.csv` deterministically (fixed random seed),
so the same code always produces the same audio. To add a sound, write a small
function in `tools/generate_sounds.py`, add one line to its `CATALOG` list, and run it
again — the catalog, this README and the folder READMEs are all generated from that
one list.

## License

- **Audio files** (`sounds/**/*.wav`): [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/).
  Use them in personal, commercial and educational projects, modify them, ship them in
  your game. The only requirement is credit:

  > Sound effects by Amirmahdi Pop — Amirmahdi Sound Library (CC BY 4.0)
  > https://github.com/amirmahdipa77-tech/amirmahdi-sound-library

- **Code** (`tools/generate_sounds.py`): MIT — see `LICENSE-CODE`.

No warranty of any kind; the library is provided as-is.

## Contributing

Issues and pull requests are welcome — a new sound, a better envelope, a fix for a
click you heard. Please keep the rule that makes this library useful: every sound must
be generated by code in this repository, never sampled from someone else's recording.

---

## فارسی

**کتابخانهٔ صداهای امیرمهدی** یک مجموعهٔ کامل و متن‌باز از افکت‌های صوتی برای بازی، اپلیکیشن و ویدیو است.
{len(rows)} صدا در چهار پوشه، مجموعاً {total_s:.0f} ثانیه صدا، همه با کد و ریاضیات از صفر ساخته شده‌اند؛
هیچ فایل آماده یا سمپل شخص دیگری در این مخزن نیست، پس استفادهٔ تجاری از آن هیچ محدودیتی ندارد.

**ساختار پوشه‌ها**

- `sounds/games/` — صدای بازی‌ها: سکه، پاورآپ، انفجار، لیزر، شلیک، ضربه، باخت، بالا رفتن سطح
- `sounds/nature/` — طبیعت: باد، باران، رعد، جوی آب (باد و باران و جوی آب لوپ بی‌درز)
- `sounds/ui/` — رابط کاربری: نوتیفیکیشن، کلیک، موفقیت، خطا، پیام
- `sounds/movement/` — حرکت: قدم روی شن، قدم روی چوب، پرش، فرود

**مشخصات فنی:** همهٔ فایل‌ها WAV با نرخ ۴۴٫۱ کیلوهرتز، ۱۶ بیت، مونو و نرمال‌شده روی ۱- دسی‌بل هستند
و در هر موتور بازی یا اپلیکیشنی بدون تبدیل کار می‌کنند.

**لایسنس:** صداها با CC BY 4.0 منتشر شده‌اند؛ یعنی استفادهٔ آزاد و تجاری با ذکر نام سازنده.
کد سازندهٔ صداها هم با لایسنس MIT آزاد است. برای اعتباردهی کافی است این خط را جایی در پروژه یا
توضیحات بازی بنویسید:

> Sound effects by Amirmahdi Pop — Amirmahdi Sound Library (CC BY 4.0)

**ساخت دوبارهٔ صداها:** اگر پایتون داری، با `pip install numpy scipy soundfile` و بعد
`python tools/generate_sounds.py` همهٔ فایل‌ها دوباره ساخته می‌شوند. با تغییر همان اسکریپت
می‌توانی صدای تازه اضافه کنی؛ جدول‌ها و فهرست‌ها خودکار به‌روز می‌شوند.

---

Made by **Amirmahdi Pop** · [github.com/amirmahdipa77-tech](https://github.com/amirmahdipa77-tech)
"""

open(os.path.join(ROOT, "README.md"), "w", encoding="utf-8").write(readme)
print("README.md and 4 category READMEs written;", len(rows), "sounds,", f"{total_s:.1f}s total")
