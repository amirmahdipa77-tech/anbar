#!/usr/bin/env python3
"""
Amirmahdi Sound Library — sound generator.

Every sound in this library is synthesized from scratch with plain DSP maths
(numpy + scipy). No third-party samples, no recordings, no copyrighted material
are used anywhere, which is why the whole library can be released into the
public domain.

Usage:
    pip install numpy scipy soundfile
    python tools/generate_sounds.py

Output:
    sounds/<category>/<name>.wav   (44.1 kHz, 16-bit PCM, mono)
    sounds.csv                     (catalog: metadata for every file)
"""

import csv
import os
import numpy as np
from scipy import signal
import soundfile as sf

SR = 44100
OUT = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "sounds")
PEAK = 0.89  # -1 dBFS
rng = np.random.default_rng(20261104)


# ---------------------------------------------------------------- utilities
def n_samples(seconds):
    return int(round(seconds * SR))


def tt(seconds):
    return np.arange(n_samples(seconds)) / SR


def white(seconds):
    return rng.standard_normal(n_samples(seconds))


def pink(seconds):
    """1/f noise via spectral shaping."""
    x = white(seconds)
    X = np.fft.rfft(x)
    f = np.fft.rfftfreq(len(x), 1 / SR)
    f[0] = f[1]
    X = X / np.sqrt(f)
    y = np.fft.irfft(X, n=len(x))
    return y / (np.max(np.abs(y)) + 1e-9)


def brown(seconds):
    """1/f^2 noise (integrated white noise, leaky)."""
    x = white(seconds)
    y = signal.lfilter([1.0], [1.0, -0.995], x)
    return y / (np.max(np.abs(y)) + 1e-9)


def filt(x, kind, cutoff, order=2):
    if kind == "band":
        lo, hi = cutoff
        sos = signal.butter(order, [lo / (SR / 2), hi / (SR / 2)], btype="band", output="sos")
    else:
        sos = signal.butter(order, cutoff / (SR / 2), btype=kind, output="sos")
    return signal.sosfilt(sos, x)


def sweep(f0, f1, seconds, curve="exp"):
    """Phase-continuous frequency sweep."""
    t = tt(seconds)
    if curve == "exp":
        f = f0 * (f1 / f0) ** (t / max(seconds, 1e-9))
    else:
        f = f0 + (f1 - f0) * (t / max(seconds, 1e-9))
    phase = 2 * np.pi * np.cumsum(f) / SR
    return phase


def tone(freq, seconds, wave="sine", detune=0.0):
    ph = 2 * np.pi * freq * (1 + detune) * tt(seconds)
    if wave == "sine":
        return np.sin(ph)
    if wave == "tri":
        return 2 * np.abs(2 * ((ph / (2 * np.pi)) % 1) - 1) - 1
    if wave == "square":
        return np.sign(np.sin(ph))
    if wave == "saw":
        return 2 * ((ph / (2 * np.pi)) % 1) - 1
    raise ValueError(wave)


def env_ad(n, attack, decay, curve=4.0):
    a = max(1, n_samples(attack))
    d = max(1, n - a)
    e = np.concatenate([
        np.linspace(0, 1, a, endpoint=False),
        np.exp(-curve * np.linspace(0, 1, d)),
    ])
    return e[:n]


def fade(x, ms_in=3.0, ms_out=8.0):
    x = x.copy()
    a, b = n_samples(ms_in / 1000), n_samples(ms_out / 1000)
    if a > 1:
        x[:a] *= np.linspace(0, 1, a)
    if b > 1:
        x[-b:] *= np.linspace(1, 0, b)
    return x


def place(buf, x, at):
    i = n_samples(at)
    end = min(len(buf), i + len(x))
    if end > i:
        buf[i:end] += x[: end - i]
    return buf


def loopify(x, crossfade=0.35):
    """Make a buffer loop seamlessly by folding its tail into its head."""
    c = n_samples(crossfade)
    if c * 2 >= len(x):
        return x
    head, tail = x[:c].copy(), x[-c:].copy()
    ramp = np.linspace(0, 1, c)
    body = x[:-c].copy()
    body[:c] = tail * (1 - ramp) + head * ramp
    return body


def finish(x, loop=False, peak=PEAK):
    x = np.nan_to_num(x)
    x = filt(x, "high", 25.0)  # kill DC / rumble
    if loop:
        x = loopify(x)
    else:
        x = fade(x, 2.0, 15.0)
    x = x / (np.max(np.abs(x)) + 1e-9) * peak
    return x.astype(np.float32)


# ---------------------------------------------------------------- games
def coin():
    n = n_samples(0.55)
    buf = np.zeros(n)
    a = tone(988, 0.09, "tri") * env_ad(n_samples(0.09), 0.001, 0.09, 2)
    b = tone(1319, 0.40, "tri") * env_ad(n_samples(0.40), 0.001, 0.40, 5)
    b += 0.3 * tone(2637, 0.40, "sine") * env_ad(n_samples(0.40), 0.001, 0.40, 7)
    place(buf, a, 0.0)
    place(buf, b, 0.075)
    return buf, False


def powerup():
    n = n_samples(0.95)
    buf = np.zeros(n)
    notes = [392, 523, 659, 784, 1047, 1319]
    for i, f in enumerate(notes):
        d = 0.10
        x = 0.6 * tone(f, d, "square") + 0.4 * tone(f, d, "tri")
        x *= env_ad(n_samples(d), 0.004, d, 2.5)
        place(buf, x, i * 0.075)
    shimmer = filt(white(0.95), "high", 4000) * np.linspace(0, 0.25, n)
    buf += shimmer * 0.25
    return buf, False


def explosion():
    n = n_samples(1.7)
    t = tt(1.7)
    body = filt(white(1.7), "low", 2200)
    body *= np.exp(-5.0 * t)
    sub = np.sin(sweep(110, 28, 1.7)) * np.exp(-3.2 * t)
    crack = filt(white(0.09), "high", 2500) * env_ad(n_samples(0.09), 0.0005, 0.09, 5)
    x = 0.9 * body + 0.85 * sub
    x = np.tanh(1.8 * x) / np.tanh(1.8)
    place(x, crack * 0.8, 0.0)
    return x, False


def laser():
    n = n_samples(0.55)
    t = tt(0.55)
    ph = sweep(2600, 320, 0.55)
    x = np.sin(ph) + 0.35 * np.sign(np.sin(ph * 1.0))
    x *= np.exp(-6.5 * t)
    x += 0.15 * filt(white(0.55), "high", 3000) * np.exp(-18 * t)
    return x, False


def gunshot():
    n = n_samples(0.9)
    t = tt(0.9)
    blast = filt(white(0.9), "low", 3200) * np.exp(-14 * t)
    thump = np.sin(sweep(95, 38, 0.9)) * np.exp(-7 * t)
    crack = filt(white(0.05), "high", 2000) * env_ad(n_samples(0.05), 0.0002, 0.05, 6)
    tail = filt(white(0.9), "band", (400, 2500)) * np.exp(-3.0 * t) * 0.18
    x = 0.95 * blast + 0.9 * thump + tail
    x = np.tanh(2.2 * x) / np.tanh(2.2)
    place(x, crack * 1.0, 0.0)
    return x, False


def hit():
    n = n_samples(0.28)
    t = tt(0.28)
    x = filt(white(0.28), "band", (900, 4500)) * np.exp(-22 * t)
    x += 0.7 * np.sin(sweep(180, 70, 0.28)) * np.exp(-16 * t)
    return x, False


def game_over():
    n = n_samples(1.5)
    buf = np.zeros(n)
    for i, f in enumerate([330, 262, 196]):
        d = 0.55
        x = 0.7 * tone(f, d, "square") + 0.3 * tone(f, d, "sine", detune=0.002)
        x *= env_ad(n_samples(d), 0.005, d, 3.0)
        place(buf, x, i * 0.28)
    return buf, False


def level_up():
    n = n_samples(1.4)
    buf = np.zeros(n)
    for i, f in enumerate([523, 659, 784, 1047]):
        d = 0.9
        x = tone(f, d, "sine") + 0.35 * tone(2 * f, d, "sine") + 0.15 * tone(3 * f, d, "sine")
        x *= env_ad(n_samples(d), 0.004, d, 4.0)
        place(buf, x, i * 0.11)
    return buf, False


# ---------------------------------------------------------------- nature
def wind():
    n = n_samples(7.0)
    base = brown(7.0)
    x = filt(base, "low", 700, order=3)
    t = tt(7.0)
    lfo = 0.55 + 0.45 * np.sin(2 * np.pi * 0.17 * t + 0.4) * np.sin(2 * np.pi * 0.07 * t)
    x *= lfo
    x += 0.18 * filt(brown(7.0), "band", (300, 1400)) * (0.5 + 0.5 * np.sin(2 * np.pi * 0.31 * t))
    return x, True


def rain():
    n = n_samples(7.0)
    x = filt(white(7.0), "high", 700)
    x = filt(x, "low", 9000)
    t = tt(7.0)
    x *= 0.85 + 0.15 * np.sin(2 * np.pi * 0.12 * t)
    # droplets
    drops = np.zeros(n)
    for _ in range(220):
        at = rng.uniform(0, 6.8)
        d = rng.uniform(0.01, 0.05)
        f = rng.uniform(1800, 5200)
        g = filt(white(d), "band", (f * 0.7, f * 1.4)) * env_ad(n_samples(d), 0.0005, d, 6)
        place(drops, g * rng.uniform(0.05, 0.28), at)
    return x + drops, True


def thunder():
    n = n_samples(4.5)
    t = tt(4.5)
    rumble = filt(brown(4.5), "low", 160, order=3)
    env = (1 - np.exp(-9 * t)) * np.exp(-0.9 * t)
    x = rumble * env
    for _ in range(14):
        at = rng.uniform(0.0, 1.2)
        d = rng.uniform(0.03, 0.12)
        c = filt(white(d), "band", (500, 3500)) * env_ad(n_samples(d), 0.001, d, 4)
        place(x, c * rng.uniform(0.1, 0.5), at)
    return x, False


def stream():
    n = n_samples(7.0)
    t = tt(7.0)
    x = filt(pink(7.0), "band", (350, 3200))
    mod = 0.7 + 0.3 * np.sin(2 * np.pi * 0.9 * t) * np.sin(2 * np.pi * 0.23 * t + 1.1)
    x *= mod
    bub = np.zeros(n)
    for _ in range(90):
        at = rng.uniform(0, 6.8)
        d = rng.uniform(0.03, 0.09)
        f = rng.uniform(400, 1400)
        g = np.sin(2 * np.pi * f * tt(d)) * env_ad(n_samples(d), 0.002, d, 5)
        place(bub, g * rng.uniform(0.05, 0.2), at)
    return x + bub, True


# ---------------------------------------------------------------- ui
def notification():
    n = n_samples(1.0)
    buf = np.zeros(n)
    for at, f, amp in [(0.0, 1568, 1.0), (0.055, 2093, 0.75)]:
        d = 0.85
        x = tone(f, d, "sine") + 0.28 * tone(2.0 * f, d, "sine") + 0.1 * tone(3.01 * f, d, "sine")
        x *= env_ad(n_samples(d), 0.003, d, 4.5)
        place(buf, x * amp, at)
    return buf, False


def click():
    n = n_samples(0.09)
    x = filt(white(0.09), "band", (1500, 7000)) * env_ad(n_samples(0.09), 0.0004, 0.09, 8)
    x += 0.6 * tone(1900, 0.09, "sine") * env_ad(n_samples(0.09), 0.0004, 0.09, 12)
    return x, False


def success():
    n = n_samples(0.9)
    buf = np.zeros(n)
    for i, f in enumerate([1047, 1319, 1568]):
        d = 0.75
        x = tone(f, d, "sine") + 0.3 * tone(2 * f, d, "sine")
        x *= env_ad(n_samples(d), 0.003, d, 4.5)
        place(buf, x, i * 0.085)
    return buf, False


def error():
    n = n_samples(0.55)
    buf = np.zeros(n)
    for i, f in enumerate([440, 330]):
        d = 0.24
        x = 0.65 * tone(f, d, "square") + 0.35 * tone(f, d, "tri", detune=0.004)
        x = filt(x, "low", 3000)
        x *= env_ad(n_samples(d), 0.004, d, 3)
        place(buf, x, i * 0.16)
    return buf, False


def message():
    n = n_samples(0.3)
    t = tt(0.3)
    ph = sweep(950, 480, 0.3)
    x = np.sin(ph) * np.exp(-16 * t)
    x += 0.4 * filt(white(0.3), "band", (600, 3000)) * np.exp(-40 * t)
    return x, False


# ---------------------------------------------------------------- movement
def footstep_gravel():
    n = n_samples(0.45)
    buf = np.zeros(n)
    for at, amp in [(0.0, 1.0), (0.045, 0.7), (0.095, 0.45)]:
        d = 0.14
        g = filt(white(d), "band", (1200, 6000)) * env_ad(n_samples(d), 0.001, d, 9)
        place(buf, g * amp, at)
    place(buf, np.sin(sweep(120, 60, 0.2)) * env_ad(n_samples(0.2), 0.002, 0.2, 8) * 0.5, 0.0)
    return buf, False


def footstep_wood():
    n = n_samples(0.4)
    buf = np.zeros(n)
    knock = filt(white(0.06), "band", (300, 4000)) * env_ad(n_samples(0.06), 0.0006, 0.06, 7)
    body = tone(210, 0.35, "sine") * env_ad(n_samples(0.35), 0.002, 0.35, 7)
    body += 0.35 * tone(880, 0.35, "sine") * env_ad(n_samples(0.35), 0.002, 0.35, 10)
    place(buf, knock, 0.0)
    place(buf, body * 0.7, 0.004)
    return buf, False


def jump():
    n = n_samples(0.5)
    t = tt(0.5)
    ph = sweep(260, 720, 0.5, curve="lin")
    x = np.sin(ph) * np.exp(-7 * t)
    x += 0.25 * filt(white(0.5), "band", (600, 4000)) * np.exp(-14 * t)
    x += 0.2 * tone(520, 0.5, "tri") * np.exp(-9 * t)
    return x, False


def land():
    n = n_samples(0.55)
    t = tt(0.55)
    x = np.sin(sweep(120, 45, 0.55)) * np.exp(-11 * t)
    x += 0.55 * filt(white(0.55), "low", 1800) * np.exp(-20 * t)
    x = np.tanh(1.5 * x) / np.tanh(1.5)
    return x, False


# ---------------------------------------------------------------- catalog
CATALOG = [
    # (category, name, fn, loop, duration_s, en, fa)
    ("games", "coin", coin, "Short bright two-note pickup chime for collecting coins or points.", "زنگ کوتاه و روشن برای برداشتن سکه یا امتیاز."),
    ("games", "powerup", powerup, "Rising six-note arpeggio for power-ups, upgrades and unlocks.", "آرپژ شش‌نتی صعودی برای پاورآپ و ارتقا."),
    ("games", "explosion", explosion, "Deep blast with a low sub tail and a sharp crack on the attack.", "انفجار بم با دنباله فرکانس پایین و شروع تیز."),
    ("games", "laser", laser, "Fast descending laser zap for sci-fi weapons.", "لیزر نزولی و سریع برای سلاح‌های علمی-تخیلی."),
    ("games", "gunshot", gunshot, "Punchy single gunshot: crack, body and short room tail.", "صدای شلیک تک: ترک، بدنه و دنباله کوتاه."),
    ("games", "hit", hit, "Impact thud for bullets, punches and collisions.", "ضربه برای برخورد گلوله، مشت و تصادم."),
    ("games", "game-over", game_over, "Three descending minor tones for a game-over screen.", "سه نت نزولی مینور برای صفحه پایان بازی."),
    ("games", "level-up", level_up, "Ascending bell arpeggio for levelling up or completing a stage.", "آرپژ زنگی صعودی برای بالا رفتن سطح."),
    ("nature", "wind", wind, "Rolling wind ambience, seamless loop.", "صدای باد غلتان، لوپ بی‌درز."),
    ("nature", "rain", rain, "Steady rainfall with individual droplets, seamless loop.", "باران یکنواخت با قطره‌های جدا، لوپ بی‌درز."),
    ("nature", "thunder", thunder, "Distant thunder roll with a crackle on the attack.", "رعد دور با ترق‌ترق در ابتدا."),
    ("nature", "stream", stream, "Small running stream with bubbling water, seamless loop.", "جوی آب کوچک با حباب، لوپ بی‌درز."),
    ("ui", "notification", notification, "Two-tone bell notification, clean and familiar.", "نوتیف دو نتی زنگی، تمیز و آشنا."),
    ("ui", "click", click, "Very short tactile click for buttons and toggles.", "کلیک بسیار کوتاه برای دکمه‌ها."),
    ("ui", "success", success, "Three ascending bell notes for a completed action.", "سه نت زنگی صعودی برای انجام موفق یک کار."),
    ("ui", "error", error, "Two descending buzzy tones for an invalid action.", "دو نت نزولی برای عمل نامعتبر."),
    ("ui", "message", message, "Soft pop for a new chat message.", "پاپ نرم برای پیام جدید."),
    ("movement", "footstep-gravel", footstep_gravel, "Three crunching gravel steps for walking on dirt or rocks.", "سه قدم روی شن و سنگ."),
    ("movement", "footstep-wood", footstep_wood, "Single footstep on a wooden floor with body resonance.", "یک قدم روی کف چوبی با رزونانس."),
    ("movement", "jump", jump, "Short upward blip with air for jumping.", "بلیپ صعودی کوتاه برای پرش."),
    ("movement", "land", land, "Low thump and dust for landing after a jump.", "ضربه بم برای فرود بعد از پرش."),
]

CATEGORY_FA = {
    "games": "بازی‌ها",
    "nature": "طبیعت",
    "ui": "رابط کاربری",
    "movement": "حرکت و قدم",
}


def main():
    rows = []
    for cat, name, fn, en, fa in CATALOG:
        x, loop = fn()
        x = finish(x, loop=loop)
        d = os.path.join(OUT, cat)
        os.makedirs(d, exist_ok=True)
        path = os.path.join(d, name + ".wav")
        sf.write(path, x, SR, subtype="PCM_16")
        dur = len(x) / SR
        rows.append({
            "category": cat,
            "name": name,
            "file": f"sounds/{cat}/{name}.wav",
            "duration_s": round(dur, 2),
            "sample_rate": SR,
            "channels": 1,
            "bit_depth": 16,
            "loop": "yes" if loop else "no",
            "description_en": en,
            "description_fa": fa,
            "license": "CC-BY-4.0",
            "author": "Amirmahdi Pop",
        })
        print(f"{cat}/{name}.wav  {dur:5.2f}s  peak={np.max(np.abs(x)):.3f}  loop={loop}")

    csv_path = os.path.join(os.path.dirname(OUT), "sounds.csv")
    with open(csv_path, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=list(rows[0].keys()), lineterminator="\n")
        w.writeheader()
        w.writerows(rows)
    print(f"\n{len(rows)} files -> {OUT}")
    print(f"catalog -> {csv_path}")


if __name__ == "__main__":
    main()
