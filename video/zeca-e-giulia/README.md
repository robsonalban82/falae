# Vídeo "Zeca e Giulia"

Fonte do vídeo `video/zeca-e-giulia.mp4` (1920×1080, 1 min 18 s, narração em PT-BR). Não faz parte do app: nada aqui entra no build.

| Arquivo          | O que faz                                                                   |
| ---------------- | --------------------------------------------------------------------------- |
| `characters.mjs` | Zeca, os pais e a Giulia em SVG, com partes móveis (olhos, garras, braços…) |
| `scenes.mjs`     | Cenários e as 8 cenas                                                       |
| `animate.js`     | Coreografia em GSAP (uma linha do tempo com tempos absolutos)               |
| `build.mjs`      | Monta a composição HyperFrames (`index.html`): cenas, legendas, áudio       |
| `lines.mjs`      | Tira a narração de `src/i18n/pt-BR.ts` (`t.story`), a mesma da tela do app  |
| `tts.py`         | Narração com Kokoro (voz `pf_dora`)                                         |
| `sound.py`       | Música original e efeitos sonoros, sintetizados com numpy                   |

## Gerar de novo

Ferramentas fora do projeto (não entram no `package.json`): Python com `kokoro-onnx` e `soundfile`, os arquivos `kokoro-v1.0.onnx` e `voices-v1.0.bin` (release `model-files-v1.0` do repositório `thewh1teagle/kokoro-onnx`), o pacote `hyperframes` e o `gsap@3.15.0` numa pasta à parte, e o ffmpeg.

```bash
OUT=/caminho/da/saida
npx tsx video/zeca-e-giulia/lines.mjs > $OUT/lines.json
python video/zeca-e-giulia/tts.py $OUT/lines.json $OUT/assets/voice /caminho/do/kokoro
python video/zeca-e-giulia/sound.py $OUT/assets/sound 51 31
node video/zeca-e-giulia/build.mjs $OUT /caminho/do/gsap.min.js
cd $OUT && npx hyperframes render -q delivery -o render.mp4
ffmpeg -i render.mp4 -c:v libx264 -crf 22 -af loudnorm=I=-16:TP=-1.5 -c:a aac -b:a 160k final.mp4
```

Antes do `render`, `npx hyperframes snapshot --at 5,15,25` gera quadros para conferir.
