"""Narrates each line with Kokoro (pt-BR voice) and writes WAV files plus their durations.

Usage: python tts.py lines.json out_dir model_dir
"""

import json
import sys
from pathlib import Path

import soundfile as sf
from kokoro_onnx import Kokoro

VOICE = "pf_dora"
SPEED = 0.9
# Spelled the way a Brazilian reads them, so the voice does not guess an Italian or English sound.
RESPELL = {"Giulia": "Júlia"}


def main() -> None:
    lines_path, out_dir, model_dir = map(Path, sys.argv[1:4])
    out_dir.mkdir(parents=True, exist_ok=True)
    kokoro = Kokoro(str(model_dir / "kokoro-v1.0.onnx"), str(model_dir / "voices-v1.0.bin"))
    durations = {}
    for line in json.loads(lines_path.read_text()):
        text = line["text"]
        for word, spoken in RESPELL.items():
            text = text.replace(word, spoken)
        samples, rate = kokoro.create(text, voice=VOICE, speed=SPEED, lang="pt-br")
        sf.write(out_dir / f"{line['id']}.wav", samples, rate)
        durations[line["id"]] = round(len(samples) / rate, 3)
    (out_dir / "durations.json").write_text(json.dumps(durations, indent=2))
    print(json.dumps(durations))


if __name__ == "__main__":
    main()
