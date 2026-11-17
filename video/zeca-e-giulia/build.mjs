// Builds the HyperFrames composition (index.html) of the story video.
// Usage: node build.mjs <out_dir> <gsap.min.js>
// Expects <out_dir>/lines.json and <out_dir>/assets/voice|sound from lines.mjs, tts.py and sound.py.
import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { defs } from './characters.mjs';
import { scenes } from './scenes.mjs';

const here = import.meta.dirname;
const [out, gsapJs] = process.argv.slice(2);
if (!out || !gsapJs) throw new Error('usage: node build.mjs <out_dir> <gsap.min.js>');
const require = createRequire(join(here, '../../package.json'));

/** Scene start times (s); each scene cross-fades into the next for FADE seconds. */
const STARTS = [0, 12, 21, 31, 40, 48.5, 57.5, 67];
const TOTAL = 78;
const FADE = 0.7;
/** When each scene's narration line begins. */
const NARRATION = [3.6, 12.7, 21.6, 31.6, 40.6, 49.2, 58.1, 67.8];
const TITLE_VOICE = 0.8;
const END_CARD = 74.5;
const END_VOICE = 74.9;

const lines = Object.fromEntries(
  JSON.parse(readFileSync(join(out, 'lines.json'), 'utf8')).map((l) => [l.id, l.text]),
);
const voice = JSON.parse(readFileSync(join(out, 'assets/voice/durations.json'), 'utf8'));
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

mkdirSync(join(out, 'assets'), { recursive: true });
copyFileSync(gsapJs, join(out, 'assets/gsap.min.js'));
copyFileSync(join(here, 'animate.js'), join(out, 'assets/animate.js'));
const fonts = {
  'fredoka-600.woff2': '@fontsource/fredoka/files/fredoka-latin-600-normal.woff2',
  'atkinson-700.woff2':
    '@fontsource/atkinson-hyperlegible/files/atkinson-hyperlegible-latin-700-normal.woff2',
};
for (const [name, path] of Object.entries(fonts))
  copyFileSync(require.resolve(path), join(out, 'assets', name));

const sceneEnd = (i) => (i + 1 < STARTS.length ? STARTS[i + 1] + FADE : TOTAL);

const sceneClips = scenes
  .map(
    (draw, i) => `
      <div id="scene-${i}" class="clip scene" style="z-index:${i + 1}" data-start="${STARTS[i]}" data-duration="${(sceneEnd(i) - STARTS[i]).toFixed(2)}" data-track-index="0">
        <svg viewBox="0 0 1920 1080" width="1920" height="1080" xmlns="http://www.w3.org/2000/svg">${draw()}</svg>
      </div>`,
  )
  .join('');

const captions = NARRATION.map((at, i) => {
  const d = (voice[`scene-${i}`] ?? 4) + 1.2;
  return `
      <p id="cap-${i}" class="clip caption" data-start="${at}" data-duration="${d.toFixed(2)}" data-track-index="1">${esc(lines[`scene-${i}`])}</p>`;
}).join('');

const title = esc(lines.title.replace(/\.$/, ''))
  .split('')
  .map((ch) => (ch === ' ' ? '<span class="gap"></span>' : `<span class="letter">${ch}</span>`))
  .join('');

let track = 3;
const audio = (id, src, start, duration, volume = 1, extra = '') =>
  `
      <audio id="${id}" src="${src}" data-start="${start}" data-duration="${duration.toFixed(2)}" data-volume="${volume}" data-track-index="${track++}" ${extra}></audio>`;

const sfx = [
  ['bubbles', 9.1, 0.5],
  ['surprise', STARTS[1] + 4.2, 0.55],
  ['snap', STARTS[2] + 1.25, 0.7],
  ['twinkle', STARTS[2] + 8.4, 0.4],
  ['dig', STARTS[3] + 0.3, 0.45],
  ['plop', STARTS[3] + 1.6, 0.6],
  ['pop', STARTS[3] + 2.4, 0.45],
  ['pop', STARTS[3] + 3.2, 0.5],
  ...Array.from({ length: 7 }, (_, k) => ['boing', STARTS[4] + 0.3 + k * 0.85 + 0.75, 0.32]),
  ['twinkle', STARTS[6] + 2.3, 0.45],
  ['wave', STARTS[6] + 7.5, 0.6],
  ['bubbles', STARTS[7] + 0.2, 0.45],
  ['whoosh', STARTS[7] + 2.0, 0.4],
  ['twinkle', STARTS[7] + 3.6, 0.4],
  ['twinkle', END_CARD, 0.35],
];
const sfxLength = {
  bubbles: 1.6,
  surprise: 0.5,
  snap: 0.25,
  twinkle: 1.8,
  dig: 1.4,
  plop: 0.25,
  pop: 0.12,
  boing: 0.55,
  wave: 2.4,
  whoosh: 0.8,
};

const audioTags = [
  audio('voice-title', 'assets/voice/title.wav', TITLE_VOICE, voice.title),
  ...NARRATION.map((at, i) =>
    audio(`voice-${i}`, `assets/voice/scene-${i}.wav`, at, voice[`scene-${i}`]),
  ),
  audio('voice-end', 'assets/voice/end.wav', END_VOICE, voice.end),
  audio('music-day', 'assets/sound/music-day.wav', 0, 50, 0.28, 'data-fade-out="2"'),
  audio(
    'music-night',
    'assets/sound/music-night.wav',
    48.2,
    TOTAL - 48.2,
    0.32,
    'data-fade-in="1.5" data-fade-out="2"',
  ),
  ...sfx.map(([name, at, vol], k) =>
    audio(`sfx-${k}`, `assets/sound/sfx-${name}.wav`, +at.toFixed(2), sfxLength[name], vol),
  ),
].join('');

const html = `<!doctype html>
<html lang="pt-BR">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=1920, height=1080" />
    <script src="assets/gsap.min.js"></script>
    <style>
      @font-face { font-family: "Fredoka"; font-weight: 600; src: url("assets/fredoka-600.woff2") format("woff2"); }
      @font-face { font-family: "Atkinson"; font-weight: 700; src: url("assets/atkinson-700.woff2") format("woff2"); }
      * { margin: 0; padding: 0; box-sizing: border-box; }
      html, body { width: 1920px; height: 1080px; overflow: hidden; background: #0e0f24; }
      #root { position: relative; width: 1920px; height: 1080px; overflow: hidden; }
      .scene { position: absolute; inset: 0; }
      .scene svg { display: block; }
      #defs { position: absolute; width: 0; height: 0; }
      .caption {
        position: absolute; left: 50%; top: 36px; z-index: 30; transform: translateX(-50%);
        width: max-content; max-width: 1500px;
        padding: 20px 40px; border-radius: 32px; border: 5px solid #2a1a2e;
        background: rgba(255, 250, 240, 0.94); color: #2a1a2e; text-align: center;
        font-family: "Atkinson", sans-serif; font-weight: 700; font-size: 44px; line-height: 1.25;
        box-shadow: 0 8px 0 rgba(42, 26, 46, 0.25);
      }
      .card {
        position: absolute; left: 0; right: 0; z-index: 31; display: flex; justify-content: center;
        font-family: "Fredoka", sans-serif; font-weight: 600; color: #fff;
        -webkit-text-stroke: 10px #2a1a2e; paint-order: stroke fill;
        text-shadow: 0 10px 0 #2a1a2e;
      }
      #title { top: 120px; font-size: 168px; }
      #title .letter { display: inline-block; }
      #title .letter:nth-child(odd) { color: #ffcf3a; }
      #title .letter:nth-child(even) { color: #ff7a4a; }
      #title .gap { display: inline-block; width: 48px; }
      #end { top: 330px; font-size: 220px; color: #ffcf3a; }
    </style>
  </head>
  <body>
    <div id="root" data-composition-id="main" data-start="0" data-duration="${TOTAL}" data-width="1920" data-height="1080">
      <svg id="defs" width="0" height="0" aria-hidden="true"><defs>${defs()}</defs></svg>
${sceneClips}
${captions}
      <h1 id="title" class="clip card" data-start="0" data-duration="3.6" data-track-index="2">${title}</h1>
      <p id="end" class="clip card" data-start="${END_CARD}" data-duration="${(TOTAL - END_CARD).toFixed(1)}" data-track-index="2">${esc(lines.end)}</p>
${audioTags}
    </div>
    <script>window.STORY = ${JSON.stringify({ starts: STARTS, total: TOTAL, fade: FADE })};</script>
    <script src="assets/animate.js"></script>
  </body>
</html>
`;
writeFileSync(join(out, 'index.html'), html);
console.log(
  `index.html: ${(html.length / 1024).toFixed(0)} kB, ${scenes.length} scenes, ${TOTAL}s`,
);
