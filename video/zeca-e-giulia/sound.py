"""Synthesizes the original music and sound effects of the story video (numpy only).

Usage: python sound.py out_dir
Writes music-day.wav, music-night.wav and sfx-*.wav (44.1 kHz, mono).
"""

import sys
from pathlib import Path

import numpy as np
import soundfile as sf

RATE = 44100
rng = np.random.default_rng(7)


def note_hz(name: str) -> float:
    names = {"C": 0, "C#": 1, "D": 2, "D#": 3, "E": 4, "F": 5, "F#": 6, "G": 7, "G#": 8, "A": 9, "A#": 10, "B": 11}
    pitch, octave = name[:-1], int(name[-1])
    return 440.0 * 2 ** ((names[pitch] + 12 * (octave + 1) - 69) / 12)


def tone(hz: float, dur: float, partials=((1, 1.0),), decay=3.0, attack=0.005) -> np.ndarray:
    t = np.arange(int(dur * RATE)) / RATE
    wave = sum(a * np.sin(2 * np.pi * hz * k * t) for k, a in partials)
    env = np.minimum(1, t / attack) * np.exp(-decay * t)
    return wave * env


def marimba(hz, dur=0.9):
    return tone(hz, dur, ((1, 1.0), (4, 0.25), (10, 0.05)), decay=5.5)


def music_box(hz, dur=1.6):
    return tone(hz, dur, ((1, 1.0), (2, 0.35), (3, 0.12), (5.4, 0.06)), decay=2.6)


def pluck_bass(hz, dur=0.8):
    return tone(hz, dur, ((1, 1.0), (2, 0.3)), decay=4.0, attack=0.01)


def pad(hzs, dur, attack=0.6):
    t = np.arange(int(dur * RATE)) / RATE
    wave = sum(np.sin(2 * np.pi * hz * t + np.sin(2 * np.pi * 0.3 * t) * 0.4) for hz in hzs) / len(hzs)
    env = np.minimum(1, t / attack) * np.minimum(1, (dur - t) / attack)
    return wave * env


def place(track: np.ndarray, clip: np.ndarray, at: float, gain=1.0):
    i = int(at * RATE)
    j = min(len(track), i + len(clip))
    if i < len(track):
        track[i:j] += clip[: j - i] * gain


def chord(root: str):
    # Triads used by the two cues.
    table = {
        "C": ["C4", "E4", "G4"],
        "G": ["G3", "B3", "D4"],
        "Am": ["A3", "C4", "E4"],
        "F": ["F3", "A3", "C4"],
        "Dm": ["D4", "F4", "A4"],
        "Em": ["E4", "G4", "B4"],
    }
    return [note_hz(n) for n in table[root]]


def music_day(seconds: float) -> np.ndarray:
    bpm = 104
    beat = 60 / bpm
    track = np.zeros(int(seconds * RATE))
    progression = ["C", "G", "Am", "F"]
    melody = [
        ["E5", None, "G5", "E5", "D5", None, "C5", None],
        ["D5", None, "B4", "D5", "G5", None, None, None],
        ["C5", None, "E5", "A5", "G5", None, "E5", None],
        ["F5", "E5", "D5", None, "C5", None, None, None],
    ]
    bar = 0
    t = 0.0
    while t < seconds:
        name = progression[bar % 4]
        hz = chord(name)
        place(track, pad(hz, beat * 4 + 0.4) * 0.16, t)
        place(track, pluck_bass(hz[0] / 2) * 0.35, t)
        place(track, pluck_bass(hz[0] / 2) * 0.22, t + beat * 2)
        arp = [hz[0], hz[1], hz[2], hz[1] * 2, hz[2], hz[1], hz[0] * 2, hz[2]]
        for k, f in enumerate(arp):
            place(track, marimba(f * 2) * 0.16, t + k * beat / 2)
        # The tune plays every other round, so the narration has room.
        if (bar // 4) % 2 == 1:
            for k, n in enumerate(melody[bar % 4]):
                if n:
                    place(track, music_box(note_hz(n)) * 0.18, t + k * beat / 2)
        # Soft shaker on the off-beats.
        for k in range(8):
            noise = rng.standard_normal(int(0.05 * RATE)) * np.exp(-np.arange(int(0.05 * RATE)) / RATE * 80)
            place(track, np.diff(noise, prepend=0) * 0.025, t + k * beat / 2 + beat / 4)
        t += beat * 4
        bar += 1
    return track


def music_night(seconds: float) -> np.ndarray:
    bpm = 72
    beat = 60 / bpm
    track = np.zeros(int(seconds * RATE))
    # Wistful at first, then it settles on C major for the reunion.
    progression = ["Am", "F", "C", "G", "Am", "F", "C", "G", "F", "G", "C", "C"]
    tune = {
        0: ["E5", "C5", "A4"],
        1: ["F5", "C5", "A4"],
        2: ["G5", "E5", "C5"],
        3: ["D5", "B4", "G4"],
        8: ["A5", "F5", "C5"],
        9: ["B5", "G5", "D5"],
        10: ["C6", "G5", "E5"],
    }
    t = 0.0
    bar = 0
    while t < seconds:
        name = progression[min(bar, len(progression) - 1)]
        hz = chord(name)
        place(track, pad(hz, beat * 4 + 0.8, attack=1.2) * 0.2, t)
        place(track, pluck_bass(hz[0] / 2, 1.6) * 0.25, t)
        for k, f in enumerate([hz[0] * 2, hz[1] * 2, hz[2] * 2, hz[1] * 2]):
            place(track, music_box(f, 2.0) * 0.13, t + k * beat)
        for k, n in enumerate(tune.get(bar, [])):
            place(track, music_box(note_hz(n), 2.4) * 0.17, t + k * beat * 1.33)
        t += beat * 4
        bar += 1
    return track


def sfx() -> dict[str, np.ndarray]:
    def sweep(f0, f1, dur, decay=8.0, partial2=0.0):
        t = np.arange(int(dur * RATE)) / RATE
        f = f0 * (f1 / f0) ** (t / dur)
        phase = 2 * np.pi * np.cumsum(f) / RATE
        return (np.sin(phase) + partial2 * np.sin(2 * phase)) * np.exp(-decay * t) * np.minimum(1, t / 0.003)

    out = {}
    out["pop"] = sweep(500, 1400, 0.12, 22)
    bubbles = np.zeros(int(1.6 * RATE))
    for k in range(9):
        f0 = rng.uniform(380, 700)
        place(bubbles, sweep(f0, f0 * 2.2, 0.07, 30) * rng.uniform(0.3, 0.7), k * 0.17 + rng.uniform(0, 0.06))
    out["bubbles"] = bubbles
    click = rng.standard_normal(int(0.03 * RATE)) * np.exp(-np.arange(int(0.03 * RATE)) / RATE * 160)
    snap = np.zeros(int(0.25 * RATE))
    place(snap, np.diff(click, prepend=0), 0)
    place(snap, sweep(1800, 900, 0.08, 40) * 0.5, 0.0)
    place(snap, np.diff(click, prepend=0) * 0.7, 0.07)
    out["snap"] = snap
    t = np.arange(int(0.55 * RATE)) / RATE
    f = 160 + 260 * (1 - np.exp(-t * 14)) + 30 * np.sin(2 * np.pi * 18 * t) * np.exp(-t * 4)
    out["boing"] = np.sin(2 * np.pi * np.cumsum(f) / RATE) * np.exp(-t * 5) * np.minimum(1, t / 0.004)
    surprise = np.zeros(int(0.5 * RATE))
    place(surprise, sweep(300, 1100, 0.18, 10, 0.3), 0)
    place(surprise, sweep(900, 1500, 0.12, 18) * 0.6, 0.12)
    out["surprise"] = surprise
    twinkle = np.zeros(int(1.8 * RATE))
    for k, n in enumerate(["C6", "E6", "G6", "C7", "E7"]):
        place(twinkle, tone(note_hz(n), 1.2, ((1, 1), (3, 0.1)), decay=4.0) * 0.5, k * 0.09)
    out["twinkle"] = twinkle
    n = int(2.4 * RATE)
    noise = rng.standard_normal(n)
    # Wave: low-passed noise that swells and recedes.
    smooth = np.convolve(noise, np.ones(60) / 60, mode="same")
    tt = np.arange(n) / RATE
    out["wave"] = smooth * np.sin(np.pi * tt / 2.4) ** 2 * 6
    dig = np.zeros(int(1.4 * RATE))
    for k in range(6):
        burst = np.convolve(rng.standard_normal(int(0.12 * RATE)), np.ones(8) / 8, mode="same")
        place(dig, burst * np.hanning(len(burst)) * 0.9, k * 0.22)
    out["dig"] = dig
    out["plop"] = sweep(220, 90, 0.25, 14, 0.4)
    whoosh_n = int(0.8 * RATE)
    w = np.convolve(rng.standard_normal(whoosh_n), np.ones(30) / 30, mode="same")
    out["whoosh"] = w * np.sin(np.pi * np.arange(whoosh_n) / whoosh_n) ** 2 * 4
    return out


def normalize(x: np.ndarray, peak=0.7) -> np.ndarray:
    m = np.max(np.abs(x)) or 1
    return x / m * peak


def fade(x: np.ndarray, fin=0.5, fout=2.0) -> np.ndarray:
    n_in, n_out = int(fin * RATE), int(fout * RATE)
    x = x.copy()
    x[:n_in] *= np.linspace(0, 1, n_in)
    x[-n_out:] *= np.linspace(1, 0, n_out)
    return x


def main() -> None:
    out = Path(sys.argv[1])
    out.mkdir(parents=True, exist_ok=True)
    day = float(sys.argv[2]) if len(sys.argv) > 2 else 50
    night = float(sys.argv[3]) if len(sys.argv) > 3 else 32
    sf.write(out / "music-day.wav", normalize(fade(music_day(day), 0.3, 2.5)), RATE)
    sf.write(out / "music-night.wav", normalize(fade(music_night(night), 2.0, 3.0)), RATE)
    for name, clip in sfx().items():
        sf.write(out / f"sfx-{name}.wav", normalize(clip, 0.8), RATE)


if __name__ == "__main__":
    main()
