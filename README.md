# Amirmahdi Sound Library

**A free, open sound-effect library for games, apps and videos — by Amirmahdi Pop.**

Every sound here is synthesized from pure maths with numpy and scipy. There are no
recordings, no downloaded samples and no third-party material anywhere in this
repository, so the whole library is genuinely original work and can be used
commercially without asking anyone's permission.

کتابخانهٔ آزاد و متن‌باز افکت صوتی برای بازی، اپلیکیشن و ویدیو — ساختهٔ **امیرمهدی پاپ**.
همهٔ صداها از صفر با ریاضیات و کد ساخته شده‌اند: هیچ سمپل آماده یا فایل دانلودشده‌ای در کار نیست.

| | |
|---|---|
| Sounds | **21** files, 37.0 seconds in total |
| Format | WAV, 44.1 kHz, 16-bit PCM, mono, normalised to −1 dBFS |
| Folders | `games/` · `nature/` · `ui/` · `movement/` |
| Loops | 3 seamless loops (wind, rain, stream) |
| Audio license | CC BY 4.0 — free for commercial use, credit **Amirmahdi Pop** |
| Code license | MIT |
| Repo size | about 3 MB |

---

## Catalog

| Category | Sound | Length | Loop | What it sounds like |
|---|---|---|---|---|
| Games | [`coin.wav`](sounds/games/coin.wav) | 0.55s | no | Short bright two-note pickup chime for collecting coins or points. |
| Games | [`powerup.wav`](sounds/games/powerup.wav) | 0.95s | no | Rising six-note arpeggio for power-ups, upgrades and unlocks. |
| Games | [`explosion.wav`](sounds/games/explosion.wav) | 1.7s | no | Deep blast with a low sub tail and a sharp crack on the attack. |
| Games | [`laser.wav`](sounds/games/laser.wav) | 0.55s | no | Fast descending laser zap for sci-fi weapons. |
| Games | [`gunshot.wav`](sounds/games/gunshot.wav) | 0.9s | no | Punchy single gunshot: crack, body and short room tail. |
| Games | [`hit.wav`](sounds/games/hit.wav) | 0.28s | no | Impact thud for bullets, punches and collisions. |
| Games | [`game-over.wav`](sounds/games/game-over.wav) | 1.5s | no | Three descending minor tones for a game-over screen. |
| Games | [`level-up.wav`](sounds/games/level-up.wav) | 1.4s | no | Ascending bell arpeggio for levelling up or completing a stage. |
| Nature | [`wind.wav`](sounds/nature/wind.wav) | 6.65s | yes | Rolling wind ambience, seamless loop. |
| Nature | [`rain.wav`](sounds/nature/rain.wav) | 6.65s | yes | Steady rainfall with individual droplets, seamless loop. |
| Nature | [`thunder.wav`](sounds/nature/thunder.wav) | 4.5s | no | Distant thunder roll with a crackle on the attack. |
| Nature | [`stream.wav`](sounds/nature/stream.wav) | 6.65s | yes | Small running stream with bubbling water, seamless loop. |
| Interface | [`notification.wav`](sounds/ui/notification.wav) | 1.0s | no | Two-tone bell notification, clean and familiar. |
| Interface | [`click.wav`](sounds/ui/click.wav) | 0.09s | no | Very short tactile click for buttons and toggles. |
| Interface | [`success.wav`](sounds/ui/success.wav) | 0.9s | no | Three ascending bell notes for a completed action. |
| Interface | [`error.wav`](sounds/ui/error.wav) | 0.55s | no | Two descending buzzy tones for an invalid action. |
| Interface | [`message.wav`](sounds/ui/message.wav) | 0.3s | no | Soft pop for a new chat message. |
| Movement | [`footstep-gravel.wav`](sounds/movement/footstep-gravel.wav) | 0.45s | no | Three crunching gravel steps for walking on dirt or rocks. |
| Movement | [`footstep-wood.wav`](sounds/movement/footstep-wood.wav) | 0.4s | no | Single footstep on a wooden floor with body resonance. |
| Movement | [`jump.wav`](sounds/movement/jump.wav) | 0.5s | no | Short upward blip with air for jumping. |
| Movement | [`land.wav`](sounds/movement/land.wav) | 0.55s | no | Low thump and dust for landing after a jump. |

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

- **Code** (`tools/generate_sounds.py`, `tools/build_docs.py`): MIT — see `LICENSE-CODE`.

The copyright line and the exact scope of each license are in [`NOTICE`](NOTICE).

No warranty of any kind; the library is provided as-is.

## Contributing

Issues and pull requests are welcome — a new sound, a better envelope, a fix for a
click you heard. Please keep the rule that makes this library useful: every sound must
be generated by code in this repository, never sampled from someone else's recording.

---

## فارسی

**کتابخانهٔ صداهای امیرمهدی** یک مجموعهٔ کامل و متن‌باز از افکت‌های صوتی برای بازی، اپلیکیشن و ویدیو است.
21 صدا در چهار پوشه، مجموعاً 37 ثانیه صدا، همه با کد و ریاضیات از صفر ساخته شده‌اند؛
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
