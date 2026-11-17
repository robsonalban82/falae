// Backgrounds and the eight scenes of the story video (1920×1080 SVG markup).
import { crab, girl, INK } from './characters.mjs';

/** Seeded random numbers, so every render places the same bubbles, stars and grains. */
function seeded(seed) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

const fishShape = (cls, x, y, s, color, stripe) =>
  `<g transform="translate(${x} ${y}) scale(${s})"><g class="${cls}">
    <path d="M-30 0 L-58 -20 L-52 0 L-58 20 Z" fill="${color}" stroke="${INK}" stroke-width="4" stroke-linejoin="round"/>
    <ellipse cx="0" cy="0" rx="40" ry="26" fill="${color}" stroke="${INK}" stroke-width="4"/>
    <path d="M-6 -24 Q-2 0 -6 24" stroke="${stripe}" stroke-width="9" fill="none"/>
    <path d="M14 -20 Q0 -36 -14 -24" fill="${color}" stroke="${INK}" stroke-width="3.5"/>
    <circle cx="22" cy="-6" r="7" fill="#fff" stroke="${INK}" stroke-width="2.5"/><circle cx="24" cy="-5" r="3.5" fill="${INK}"/>
    <ellipse cx="-4" cy="-10" rx="12" ry="5" fill="#fff" opacity=".45"/>
  </g></g>`;

const seaweed = (x, y, h, color, cls = 'weed') =>
  `<g class="${cls}" data-ox="${x}" data-oy="${y}">
    <path d="M${x} ${y} C${x - 30} ${y - h * 0.3} ${x + 30} ${y - h * 0.6} ${x} ${y - h}" stroke="${color}" stroke-width="16" stroke-linecap="round" fill="none"/>
    <path d="M${x - 4} ${y - h * 0.3} q-30 -10 -34 -36 M${x + 4} ${y - h * 0.55} q30 -10 32 -36 M${x - 2} ${y - h * 0.8} q-24 -8 -26 -30" stroke="${color}" stroke-width="11" stroke-linecap="round" fill="none"/>
  </g>`;

function reef({ night = false, rockForZeca = false, seed = 1 } = {}) {
  const r = seeded(seed);
  const sand = night ? 'url(#gSandNight)' : 'url(#gSandDay)';
  const far = night ? '#0c1a56' : '#1d78b4';
  const ray = night ? 'url(#gRayNight)' : 'url(#gRay)';
  const coral = night
    ? { pink: '#4ad8c0', yellow: '#7fe8ff', purple: '#c08aff' }
    : { pink: '#ff6f9a', yellow: '#ffc94d', purple: '#9a6be0' };
  const bubbles = Array.from({ length: 22 }, (_, i) => {
    const x = 60 + r() * 1800;
    const y = 700 + r() * 400;
    const rad = 5 + r() * 12;
    return `<circle class="bubble" data-i="${i}" cx="${x.toFixed(0)}" cy="${y.toFixed(0)}" r="${rad.toFixed(1)}" fill="${night ? '#9fd4ff' : '#ffffff'}" fill-opacity=".18" stroke="#fff" stroke-opacity=".7" stroke-width="3"/>`;
  }).join('');
  const glows = night
    ? [
        [300, 800, 170, 'gGlow'],
        [470, 830, 120, 'gGlowPink'],
        [1180, 820, 160, 'gGlow'],
        [1840, 760, 130, 'gGlowPink'],
      ]
        .map(
          ([x, y, rad, g], i) =>
            `<circle class="glow" data-i="${i}" cx="${x}" cy="${y}" r="${rad}" fill="url(#${g})"/>`,
        )
        .join('')
    : '';
  return `
  <rect width="1920" height="1080" fill="${night ? 'url(#gWaterNight)' : 'url(#gWaterDay)'}"/>
  ${night ? `<circle cx="1500" cy="-60" r="260" fill="url(#gMoonGlow)"/>` : ''}
  <g class="rays">
    <path d="M300 0 L120 980 L330 980 L470 0 Z" fill="${ray}"/>
    <path d="M760 0 L700 980 L900 980 L880 0 Z" fill="${ray}"/>
    <path d="M1240 0 L1300 980 L1440 980 L1340 0 Z" fill="${ray}"/>
    <path d="M1620 0 L1760 980 L1880 980 L1700 0 Z" fill="${ray}" opacity=".7"/>
  </g>
  <path d="M0 760 Q160 640 340 720 Q480 600 640 700 Q820 640 980 720 Q1180 620 1380 700 Q1560 640 1720 690 Q1840 650 1920 680 V900 H0 Z" fill="${far}" opacity=".55"/>
  ${glows}
  ${seaweed(80, 900, 300, night ? '#1f8a6a' : '#2f9e5a')}
  ${seaweed(190, 900, 220, night ? '#17705a' : '#3fb86c')}
  ${seaweed(1060, 900, 260, night ? '#1f8a6a' : '#2f9e5a')}
  ${seaweed(1880, 900, 320, night ? '#17705a' : '#3fb86c')}
  <g stroke="${INK}" stroke-width="5" stroke-linejoin="round" class="corals">
    <path d="M250 900 V800 q0 -26 22 -26 q22 0 22 26 v34 q26 -10 26 -46 q0 -22 22 -22 q22 0 22 22 q0 70 -48 86 v26 Z" fill="${coral.pink}"/>
    <path d="M330 790 q0 -18 12 -18" stroke="#fff" stroke-opacity=".5" stroke-width="6" fill="none"/>
    <ellipse cx="440" cy="880" rx="70" ry="48" fill="${coral.yellow}"/>
    <path d="M392 876 q16 -26 34 0 q16 26 34 0 q16 -26 34 0" stroke-width="4" fill="none" stroke-opacity=".6"/>
    <path d="M1150 900 q-60 -110 0 -170 q24 54 44 0 q60 70 0 170 Z" fill="${coral.purple}"/>
    <path d="M1160 890 L1158 760 M1180 890 L1196 790 M1140 890 L1116 800" stroke-width="3.5" stroke-opacity=".6"/>
    <path d="M1260 900 v-80 a14 14 0 0 1 28 0 v80 Z M1296 900 v-120 a14 14 0 0 1 28 0 v120 Z" fill="${coral.pink}"/>
  </g>
  <path d="M0 880 Q240 840 520 870 Q820 900 1100 866 Q1420 830 1700 870 Q1820 884 1920 860 V1080 H0 Z" fill="${sand}" stroke="${INK}" stroke-width="5"/>
  <g stroke="${night ? '#4c4870' : '#d9b16a'}" stroke-width="5" stroke-linecap="round" fill="none" opacity=".7">
    <path d="M120 960 q40 -12 80 0 M520 1000 q50 -14 100 0 M980 950 q40 -10 80 0 M1500 1010 q50 -14 100 0 M1720 940 q30 -10 60 0"/>
  </g>
  <g stroke="${INK}" stroke-width="4" stroke-linejoin="round">
    <path d="M700 1020 l10 -26 10 26 -26 -16 h32 Z" fill="${night ? '#c08aff' : '#ff9f2e'}"/>
    <path d="M1590 980 q20 -30 40 0 Z" fill="${night ? '#9aa0d8' : '#ffd0b0'}"/>
  </g>
  <g class="cave">
    <path d="M1380 900 Q1360 640 1560 600 Q1760 560 1880 680 Q1940 760 1920 900 Z" fill="${night ? '#3c3f66' : '#7c7f95'}" stroke="${INK}" stroke-width="6"/>
    <path d="M1780 620 Q1930 720 1920 900 H1860 Q1880 760 1780 620 Z" fill="${night ? '#2a2c4c' : '#5b5e75'}"/>
    <path d="M1440 720 q40 -60 120 -80" stroke="#fff" stroke-opacity=".35" stroke-width="10" stroke-linecap="round" fill="none"/>
    <path d="M1500 900 Q1490 740 1620 730 Q1750 740 1740 900 Z" fill="${night ? '#0b0c22' : '#26283e'}" stroke="${INK}" stroke-width="5"/>
    ${seaweed(1560, 612, 90, night ? '#17705a' : '#3fb86c')}
    ${seaweed(1700, 590, 70, night ? '#1f8a6a' : '#2f9e5a')}
  </g>
  ${
    rockForZeca
      ? `<path d="M480 900 Q470 740 600 720 Q740 704 780 790 Q810 850 800 900 Z" fill="#7c7f95" stroke="${INK}" stroke-width="6"/>
         <path d="M720 716 Q820 790 800 900 H760 Q770 800 720 716 Z" fill="#5b5e75"/>
         <path d="M520 800 q20 -50 70 -60" stroke="#fff" stroke-opacity=".4" stroke-width="10" stroke-linecap="round" fill="none"/>`
      : ''
  }
  ${bubbles}`;
}

function beach({ night = false, seed = 2 } = {}) {
  const r = seeded(seed);
  const stars = night
    ? Array.from({ length: 46 }, (_, i) => {
        const x = r() * 1920;
        const y = r() * 400;
        const rad = 1.5 + r() * 3.5;
        return `<circle class="star" data-i="${i}" cx="${x.toFixed(0)}" cy="${y.toFixed(0)}" r="${rad.toFixed(1)}" fill="#fffbe6"/>`;
      }).join('')
    : '';
  return `
  <rect width="1920" height="460" fill="${night ? 'url(#gSkyNight)' : 'url(#gSkyDay)'}"/>
  ${stars}
  ${
    night
      ? `<circle cx="1500" cy="170" r="260" fill="url(#gMoonGlow)"/>
         <circle cx="1500" cy="170" r="72" fill="#fffbe6"/>
         <g fill="#e6e2c8"><circle cx="1478" cy="150" r="14"/><circle cx="1520" cy="196" r="10"/><circle cx="1530" cy="146" r="7"/></g>`
      : `<circle class="sunglow" cx="1560" cy="170" r="240" fill="url(#gSunGlow)"/>
         <circle cx="1560" cy="170" r="84" fill="#ffe066" stroke="#ffb02e" stroke-width="6"/>
         ${[0, 1, 2]
           .map(
             (i) =>
               `<g class="cloud" data-i="${i}"><path transform="translate(${[180, 760, 1180][i]} ${[120, 210, 90][i]}) scale(${[1.2, 0.9, 1][i]})" d="M0 40 q0 -40 44 -40 q16 -34 60 -26 q34 -24 66 6 q44 -6 48 34 q30 4 26 26 H-2 Q-26 52 0 40 Z" fill="#fff" stroke="#cfe6f5" stroke-width="5"/></g>`,
           )
           .join('')}
         <g class="gulls" stroke="${INK}" stroke-width="6" stroke-linecap="round" fill="none">
           <path class="gull" d="M820 150 q20 -22 40 0 q20 -22 40 0"/>
           <path class="gull" d="M920 200 q14 -16 28 0 q14 -16 28 0"/>
         </g>`
  }
  <path d="M0 450 Q120 380 260 420 Q320 360 380 440 Z" fill="${night ? '#141a46' : '#4a9a6a'}"/>
  <rect y="440" width="1920" height="270" fill="${night ? 'url(#gSeaNight)' : 'url(#gSeaDay)'}"/>
  ${
    night
      ? `<g class="moonpath" stroke="#fffbe6" stroke-linecap="round" opacity=".7">
          <path d="M1440 480 h120 M1410 520 h180 M1450 560 h100 M1400 610 h200 M1460 660 h80" stroke-width="8"/>
         </g>`
      : `<g class="sparkle" stroke="#fff" stroke-linecap="round" opacity=".8">
          <path d="M1480 490 h70 M1620 530 h50 M1520 580 h90 M300 520 h50 M900 600 h60" stroke-width="7"/>
         </g>`
  }
  <g class="waves" stroke="#fff" stroke-width="7" stroke-linecap="round" fill="none" opacity="${night ? 0.35 : 0.85}">
    <path d="M60 520 q30 -16 60 0 M460 560 q30 -16 60 0 M1080 500 q30 -16 60 0 M1260 640 q30 -16 60 0 M700 650 q30 -16 60 0 M1720 560 q30 -16 60 0"/>
  </g>
  <path d="M0 690 Q300 660 640 684 Q980 708 1300 676 Q1640 648 1920 680 V780 H0 Z" fill="${night ? '#4a4a7a' : 'url(#gWetDay)'}"/>
  <path class="foam" d="M-40 696 Q120 672 280 694 Q460 716 640 690 Q820 666 1000 694 Q1180 718 1360 686 Q1560 660 1760 690 Q1880 704 1980 688 L1980 676 Q1760 650 1560 646 Q1360 660 1000 676 Q640 650 280 676 Q120 656 -40 680 Z"
    fill="#fff" opacity="${night ? 0.45 : 0.95}"/>
  <path d="M0 760 Q400 730 900 754 Q1400 778 1920 740 V1080 H0 Z" fill="${night ? 'url(#gSandNight)' : 'url(#gSandDay)'}" stroke="${INK}" stroke-width="5"/>
  <g stroke="${INK}" stroke-width="4" stroke-linejoin="round">
    <path d="M1700 980 l14 -34 14 34 -34 -21 h40 Z" fill="${night ? '#b07ad8' : '#ff8a3a'}"/>
    <path d="M300 1010 q26 -40 52 0 Z" fill="${night ? '#9aa0d8' : '#ffd0e0'}"/>
    <path d="M308 1008 l12 -28 M330 1008 l2 -32 M344 1008 l-6 -26" stroke-width="2.5"/>
  </g>
  <g fill="${night ? '#5e5a82' : '#e2bb72'}">
    <ellipse cx="1500" cy="860" rx="16" ry="6"/><ellipse cx="1180" cy="1040" rx="12" ry="5"/><ellipse cx="200" cy="870" rx="14" ry="5"/>
  </g>
  <g class="palm" data-ox="120" data-oy="1000">
    <path d="M120 1000 Q90 760 190 560" stroke="${INK}" stroke-width="44" stroke-linecap="round" fill="none"/>
    <path d="M120 1000 Q90 760 190 560" stroke="${night ? '#5a4060' : '#a8703f'}" stroke-width="34" stroke-linecap="round" fill="none"/>
    <path d="M104 940 h30 M98 860 h30 M104 780 h30 M120 700 h30 M140 630 h28" stroke="${INK}" stroke-width="4" opacity=".5"/>
    <g class="fronds" data-ox="190" data-oy="560" fill="${night ? '#1f6a5a' : '#2f9e5a'}" stroke="${INK}" stroke-width="5" stroke-linejoin="round">
      <path d="M190 560 Q300 480 420 560 Q300 520 190 570 Z"/>
      <path d="M190 560 Q240 420 360 400 Q260 470 196 566 Z"/>
      <path d="M190 560 Q100 440 -10 470 Q100 490 184 568 Z"/>
      <path d="M190 560 Q60 560 -20 640 Q90 600 184 572 Z"/>
      <path d="M190 560 Q170 430 220 360 Q200 460 196 562 Z"/>
    </g>
    <g fill="#7a4a2a" stroke="${INK}" stroke-width="4"><circle cx="178" cy="584" r="16"/><circle cx="206" cy="590" r="15"/></g>
  </g>`;
}

const teddy = (id, x, y, s = 1) =>
  `<g transform="translate(${x} ${y}) scale(${s})"><g id="${id}" data-ox="0" data-oy="0">
    <g stroke="${INK}" stroke-width="5" stroke-linejoin="round">
      <ellipse cx="-34" cy="-14" rx="18" ry="14" fill="#a8703f"/><ellipse cx="34" cy="-14" rx="18" ry="14" fill="#a8703f"/>
      <ellipse cx="0" cy="-46" rx="44" ry="46" fill="#c98d55"/>
      <ellipse cx="0" cy="-36" rx="24" ry="26" fill="#f2d2a8"/>
      <circle cx="-38" cy="-116" r="18" fill="#c98d55"/><circle cx="38" cy="-116" r="18" fill="#c98d55"/>
      <circle cx="-38" cy="-116" r="8" fill="#f2b8a0" stroke-width="0"/><circle cx="38" cy="-116" r="8" fill="#f2b8a0" stroke-width="0"/>
      <circle cx="0" cy="-96" r="42" fill="#c98d55"/>
      <ellipse cx="0" cy="-84" rx="20" ry="15" fill="#f2d2a8"/>
    </g>
    <circle cx="-15" cy="-104" r="6" fill="${INK}"/><circle cx="15" cy="-104" r="6" fill="${INK}"/>
    <circle cx="-17" cy="-106" r="2" fill="#fff"/><circle cx="13" cy="-106" r="2" fill="#fff"/>
    <ellipse cx="0" cy="-90" rx="7" ry="5" fill="${INK}"/>
    <path d="M-7 -80 Q0 -74 7 -80" stroke="${INK}" stroke-width="3.5" fill="none" stroke-linecap="round"/>
    <path d="M-22 -60 l22 10 22 -10 -10 22 h-24 Z" fill="#ff7fb8" stroke="${INK}" stroke-width="3.5" stroke-linejoin="round"/>
  </g></g>`;

function room({ night = false } = {}) {
  const wall = night ? 'url(#gWallNight)' : 'url(#gWallDay)';
  const dots = Array.from({ length: 60 }, (_, i) => {
    const x = (i % 12) * 170 + (Math.floor(i / 12) % 2 ? 85 : 0) + 40;
    const y = Math.floor(i / 12) * 160 + 60;
    return `<path transform="translate(${x} ${y}) scale(.9)" d="M0 -12 L3.5 -4 12 -3.5 5.5 2 7.5 11 0 6 -7.5 11 -5.5 2 -12 -3.5 -3.5 -4 Z"/>`;
  }).join('');
  return `
  <rect width="1920" height="1080" fill="${wall}"/>
  <g fill="${night ? '#3a3f86' : '#ffcfa8'}" opacity=".7">${dots}</g>
  <rect y="880" width="1920" height="200" fill="${night ? '#3b3560' : 'url(#gWood)'}"/>
  <g stroke="${night ? '#2a2548' : '#7a4a2a'}" stroke-width="4" opacity=".5"><path d="M0 930 H1920 M0 990 H1920 M0 1040 H1920 M300 880 v50 M900 930 v60 M1500 880 v50 M600 990 v50 M1300 990 v50"/></g>
  <rect y="868" width="1920" height="20" fill="${night ? '#2a2548' : '#c88a52'}" stroke="${INK}" stroke-width="4"/>
  <ellipse cx="760" cy="1000" rx="420" ry="60" fill="${night ? '#5a4a8a' : '#9ad0c0'}" stroke="${INK}" stroke-width="5"/>
  <ellipse cx="760" cy="1000" rx="340" ry="42" fill="none" stroke="#fff" stroke-width="6" stroke-dasharray="20 18" opacity=".7"/>`;
}

function windowView({ x, y, w, h, night }) {
  const r = seeded(9);
  const stars = night
    ? Array.from({ length: 14 }, (_, i) => {
        const sx = x + 20 + r() * (w - 40);
        const sy = y + 20 + r() * (h * 0.5);
        return `<circle class="star" data-i="${i}" cx="${sx.toFixed(0)}" cy="${sy.toFixed(0)}" r="${(2 + r() * 2.5).toFixed(1)}" fill="#fffbe6"/>`;
      }).join('')
    : '';
  const seaY = y + h * 0.62;
  return `
  <rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${night ? 'url(#gSkyNight)' : 'url(#gSkyDay)'}"/>
  ${stars}
  ${
    night
      ? `<circle cx="${x + w * 0.72}" cy="${y + h * 0.28}" r="140" fill="url(#gMoonGlow)"/><circle cx="${x + w * 0.72}" cy="${y + h * 0.28}" r="44" fill="#fffbe6"/>`
      : `<circle cx="${x + w * 0.75}" cy="${y + h * 0.3}" r="120" fill="url(#gSunGlow)"/><circle cx="${x + w * 0.75}" cy="${y + h * 0.3}" r="46" fill="#ffe066" stroke="#ffb02e" stroke-width="5"/>`
  }
  <rect x="${x}" y="${seaY}" width="${w}" height="${y + h - seaY}" fill="${night ? 'url(#gSeaNight)' : 'url(#gSeaDay)'}"/>
  ${
    night
      ? `<g class="moonpath" stroke="#fffbe6" stroke-width="6" stroke-linecap="round" opacity=".7"><path d="M${x + w * 0.66} ${seaY + 18} h80 M${x + w * 0.62} ${seaY + 46} h120 M${x + w * 0.68} ${seaY + 74} h60"/></g>`
      : `<g stroke="#fff" stroke-width="6" stroke-linecap="round" opacity=".8"><path d="M${x + 60} ${seaY + 30} h50 M${x + w * 0.5} ${seaY + 60} h60"/></g>`
  }
  <rect x="${x}" y="${y}" width="${w}" height="${h}" fill="none" stroke="${INK}" stroke-width="6"/>
  <path d="M${x + w / 2} ${y} V${y + h} M${x} ${y + h / 2} H${x + w}" stroke="${night ? '#5a4a6a' : '#a8703f'}" stroke-width="16"/>
  <rect x="${x - 14}" y="${y - 14}" width="${w + 28}" height="${h + 28}" fill="none" stroke="${night ? '#5a4a6a' : '#a8703f'}" stroke-width="22"/>
  <rect x="${x - 26}" y="${y + h + 8}" width="${w + 52}" height="22" rx="6" fill="${night ? '#5a4a6a' : '#c88a52'}" stroke="${INK}" stroke-width="5"/>
  <g class="curtain-l" data-ox="${x - 30}" data-oy="${y - 40}"><path d="M${x - 70} ${y - 40} H${x + 30} Q${x - 10} ${y + h * 0.45} ${x + 20} ${y + h + 40} H${x - 70} Z" fill="${night ? '#3a3a8a' : '#ff8a3a'}" stroke="${INK}" stroke-width="5"/></g>
  <g class="curtain-r" data-ox="${x + w + 30}" data-oy="${y - 40}"><path d="M${x + w + 70} ${y - 40} H${x + w - 30} Q${x + w + 10} ${y + h * 0.45} ${x + w - 20} ${y + h + 40} H${x + w + 70} Z" fill="${night ? '#3a3a8a' : '#ff8a3a'}" stroke="${INK}" stroke-width="5"/></g>
  <rect x="${x - 100}" y="${y - 56}" width="${w + 200}" height="18" rx="9" fill="${night ? '#5a4a6a' : '#a8703f'}" stroke="${INK}" stroke-width="4"/>`;
}

const heart = (cls, x, y, s = 1) =>
  `<g transform="translate(${x} ${y}) scale(${s})"><g class="${cls}"><path d="M0 22 Q-34 0 -26 -18 Q-14 -34 0 -16 Q14 -34 26 -18 Q34 0 0 22 Z" fill="#ff5c7a" stroke="${INK}" stroke-width="4.5" stroke-linejoin="round"/><ellipse cx="-12" cy="-14" rx="6" ry="4" fill="#fff" opacity=".7"/></g></g>`;

const sparkle = (cls, x, y, s = 1) =>
  `<g transform="translate(${x} ${y}) scale(${s})"><g class="${cls}"><path d="M0 -26 Q4 -4 26 0 Q4 4 0 26 Q-4 4 -26 0 Q-4 -4 0 -26 Z" fill="#fff6b0" stroke="#ffcc33" stroke-width="3"/></g></g>`;

const watermelon = (id, x, y) =>
  `<g transform="translate(${x} ${y})"><g id="${id}">
    <path d="M-50 0 A50 50 0 0 0 50 0 Z" fill="#3fae5a" stroke="${INK}" stroke-width="5" stroke-linejoin="round"/>
    <path d="M-42 0 A42 42 0 0 0 42 0 Z" fill="#e8ffd0"/>
    <path d="M-36 0 A36 36 0 0 0 36 0 Z" fill="url(#gMelon)"/>
    <g fill="${INK}"><ellipse cx="-16" cy="12" rx="3" ry="5"/><ellipse cx="0" cy="20" rx="3" ry="5"/><ellipse cx="16" cy="12" rx="3" ry="5"/></g>
  </g></g>`;

/** Each scene: its SVG body (inside the 1920×1080 stage). Ids are prefixed per scene. */
export const scenes = [
  // 0 — Zeca dreams of the surface; his parents tidy the seaweed by the cave.
  () => `<g id="s0-cam">
    ${reef({ rockForZeca: true, seed: 11 })}
    ${fishShape('fish fish-a', -200, 300, 1.1, '#ffb02e', '#fff')}
    ${fishShape('fish fish-b', -200, 470, 0.8, '#ff7fa3', '#ffe6f0')}
    ${fishShape('fish fish-c', -200, 220, 0.7, '#5bd1ff', '#fff')}
    ${crab('m0', { x: 1470, y: 840, s: 0.85, kind: 'mom' })}
    ${crab('d0', { x: 1700, y: 850, s: 0.95, kind: 'dad', flip: true })}
    ${seaweed(1600, 905, 120, '#3fb86c', 'weed tidy')}
    ${crab('z0', { x: 640, y: 660, s: 1.25 })}
  </g>`,
  // 1 — On the beach Giulia meets Zeca, who gets a big fright.
  () => `<g id="s1-cam">
    ${beach({ seed: 21 })}
    ${girl('g1', { x: 700, y: 1010, s: 1.05, pose: 'kneel' })}
    ${crab('z1', { x: 1180, y: 900, s: 1.0 })}
    <g id="s1-alert" opacity="0" stroke="${INK}" stroke-width="10" stroke-linecap="round">
      <path d="M1100 700 L1080 650 M1180 680 V620 M1260 700 L1280 650"/>
    </g>
  </g>`,
  // 2 — The pinch, the apology and the watermelon.
  () => `<g id="s2-cam">
    ${beach({ seed: 21 })}
    ${girl('g2', { x: 700, y: 1010, s: 1.05, pose: 'kneel' })}
    ${watermelon('melon', 900, 960)}
    ${crab('z2', { x: 1180, y: 900, s: 1.0 })}
    <g id="s2-ouch" opacity="0">
      <path d="M840 520 l40 -60 14 50 52 -40 -6 58 64 -6 -46 44 56 30 -64 10 22 56 -56 -30 -14 60 -30 -54 -46 40 6 -60 -60 6 46 -40 -50 -30 Z" fill="#fff36b" stroke="${INK}" stroke-width="6" stroke-linejoin="round"/>
      <text x="916" y="608" text-anchor="middle" font-family="Fredoka" font-weight="600" font-size="72" fill="${INK}">Ai!</text>
    </g>
    ${heart('s2-heart', 1010, 640, 1.6)}
  </g>`,
  // 3 — Sandcastle afternoon: Giulia lifts the bucket, Zeca digs a tunnel.
  () => {
    const r = seeded(31);
    const grains = Array.from(
      { length: 18 },
      (_, i) =>
        `<circle class="grain" data-i="${i}" cx="${1480 + r() * 40}" cy="${950 + r() * 20}" r="${(5 + r() * 6).toFixed(1)}" fill="#e6c57a" stroke="${INK}" stroke-width="2.5"/>`,
    ).join('');
    return `<g id="s3-cam">
    ${beach({ seed: 33 })}
    <g stroke="${INK}" stroke-width="6" stroke-linejoin="round">
      <path d="M840 1000 V860 h30 v-24 h34 v24 h40 v-24 h34 v24 h40 v-24 h34 v24 h30 V1000 Z" fill="#f2d28c"/>
      <path d="M940 1000 v-56 q42 -40 84 0 v56 Z" fill="#c9a060"/>
      <g id="tower" data-ox="1010" data-oy="836"><path d="M940 836 V720 h22 v-22 h26 v22 h22 v-22 h26 v22 h22 V836 Z" fill="#f6dc9a"/><path d="M990 790 v-30 q18 -18 36 0 v30 Z" fill="#c9a060"/></g>
      <g id="flag" data-ox="1012" data-oy="698"><path d="M1012 698 V610" stroke-width="6"/><path d="M1012 612 L1076 632 L1012 652 Z" fill="#e0392b"/></g>
    </g>
    <g transform="translate(1004 836)"><g id="bucket"><g id="bucket-in">
      <path d="M-70 0 L-56 -120 H56 L70 0 Z" fill="#e0392b" stroke="${INK}" stroke-width="6" stroke-linejoin="round"/>
      <path d="M-62 -60 H62" stroke="#ff8a7a" stroke-width="10"/>
      <path d="M-40 -110 l6 90" stroke="#fff" stroke-width="8" stroke-linecap="round" opacity=".45"/>
    </g></g></g>
    ${sparkle('s3-spark', 960, 700, 1.3)}${sparkle('s3-spark', 1070, 660, 1)}${sparkle('s3-spark', 1110, 760, 0.8)}
    ${girl('g3', { x: 740, y: 1010, s: 1.0, pose: 'kneel' })}
    <ellipse cx="1500" cy="990" rx="110" ry="30" fill="#c9a060" stroke="${INK}" stroke-width="5"/>
    <clipPath id="holeA"><rect x="1300" y="0" width="420" height="1000"/></clipPath>
    <clipPath id="holeB"><rect x="1040" y="0" width="420" height="1018"/></clipPath>
    <g clip-path="url(#holeA)">${crab('z3', { x: 1500, y: 930, s: 0.95 })}</g>
    <path d="M1380 990 Q1500 1050 1620 990 Q1620 1030 1500 1040 Q1380 1030 1380 990 Z" fill="#f2d28c" stroke="${INK}" stroke-width="5"/>
    <ellipse cx="1250" cy="1010" rx="96" ry="26" fill="#c9a060" stroke="${INK}" stroke-width="5"/>
    <g clip-path="url(#holeB)">${crab('z3b', { x: 1250, y: 950, s: 0.95 })}</g>
    <path d="M1140 1010 Q1250 1064 1360 1010 Q1360 1050 1250 1060 Q1140 1050 1140 1010 Z" fill="#f2d28c" stroke="${INK}" stroke-width="5"/>
    ${grains}
  </g>`;
  },
  // 4 — Giulia's bedroom: Zeca bounces on the fluffy bed.
  () => `<g id="s4-cam">
    ${room()}
    ${windowView({ x: 160, y: 140, w: 420, h: 360, night: false })}
    <path d="M200 500 L560 500 L900 880 L380 880 Z" fill="#fff6c2" opacity=".28"/>
    <g stroke="${INK}" stroke-width="5" stroke-linejoin="round">
      <rect x="760" y="250" width="200" height="150" rx="10" fill="#fff" />
      <rect x="776" y="266" width="168" height="118" fill="#bfe6ff"/>
      <ellipse cx="860" cy="340" rx="40" ry="26" fill="#f4572d"/><circle cx="846" cy="306" r="10" fill="#fff"/><circle cx="874" cy="306" r="10" fill="#fff"/>
      <path d="M836 350 q24 14 48 0" fill="none"/>
    </g>
    <g stroke="${INK}" stroke-width="6" stroke-linejoin="round">
      <rect x="1730" y="420" width="70" height="480" rx="20" fill="url(#gWood)"/>
      <rect x="1000" y="660" width="40" height="240" rx="14" fill="url(#gWood)"/>
      <rect x="1010" y="720" width="790" height="130" rx="30" fill="#e48ab0"/>
    </g>
    <g id="bedtop" data-ox="1400" data-oy="760">
      <path d="M1000 690 Q1400 650 1790 690 L1790 790 Q1740 820 1690 790 Q1640 820 1590 790 Q1540 820 1490 790 Q1440 820 1390 790 Q1340 820 1290 790 Q1240 820 1190 790 Q1140 820 1090 790 Q1040 820 1000 790 Z" fill="url(#gBed)" stroke="${INK}" stroke-width="6" stroke-linejoin="round"/>
      <g fill="#fff" opacity=".7"><circle cx="1120" cy="740" r="10"/><circle cx="1260" cy="730" r="10"/><circle cx="1400" cy="745" r="10"/><circle cx="1540" cy="732" r="10"/><circle cx="1680" cy="742" r="10"/></g>
      <rect x="1560" y="610" width="200" height="90" rx="40" fill="#fff" stroke="${INK}" stroke-width="6"/>
    </g>
    ${teddy('teddy-a', 1560, 700, 0.9)}
    ${teddy('teddy-b', 1680, 680, 1.0)}
    ${crab('z4', { x: 1260, y: 640, s: 0.95 })}
    ${girl('g4', { x: 560, y: 1030, s: 1.0 })}
  </g>`,
  // 5 — Nightfall: Zeca misses home and looks at the sea.
  () => `<g id="s5-cam">
    ${room({ night: true })}
    ${windowView({ x: 1130, y: 120, w: 620, h: 420, night: true })}
    <path d="M1150 540 L1730 540 L1900 880 L980 880 Z" fill="#bcd0ff" opacity=".12"/>
    <g stroke="${INK}" stroke-width="6" stroke-linejoin="round">
      <rect x="1000" y="640" width="900" height="34" rx="10" fill="#6a4a5a"/>
      <rect x="1040" y="674" width="34" height="210" fill="#4e3442"/><rect x="1820" y="674" width="34" height="210" fill="#4e3442"/>
      <rect x="1080" y="590" width="120" height="50" rx="6" fill="#5a6ac0"/><rect x="1090" y="556" width="100" height="34" rx="6" fill="#c05a8a"/>
      <path d="M1250 640 V540 h-40 l20 -70 h80 l20 70 h-40 V640 Z" fill="#ffd88a"/>
    </g>
    <circle class="lamp" cx="1270" cy="510" r="200" fill="url(#gLamp)"/>
    ${crab('z5', { x: 1540, y: 578, s: 0.9 })}
    ${girl('g5', { x: 700, y: 1040, s: 0.95, outfit: 'pajamas' })}
  </g>`,
  // 6 — Goodbye on the moonlit beach.
  () => `<g id="s6-cam">
    ${beach({ night: true, seed: 61 })}
    ${girl('g6', { x: 700, y: 1010, s: 1.05, pose: 'kneel', outfit: 'jacket' })}
    <circle id="touchglow" cx="940" cy="800" r="70" fill="url(#gSpark)" opacity="0"/>
    ${sparkle('s6-spark', 910, 740, 0.9)}${sparkle('s6-spark', 990, 770, 0.7)}${sparkle('s6-spark', 950, 860, 0.6)}
    ${crab('z6', { x: 1180, y: 900, s: 1.0 })}
    <g id="bigwave" opacity="0">
      <path d="M1080 790 Q1090 700 1170 668 Q1230 606 1310 626 Q1390 588 1460 646 Q1530 676 1540 790 Z" fill="#8a9ee0" stroke="${INK}" stroke-width="5" stroke-linejoin="round"/>
      <path d="M1110 712 Q1180 650 1240 660 Q1310 604 1390 628 Q1460 622 1508 684" stroke="#fff" stroke-width="16" stroke-linecap="round" fill="none" opacity=".85"/>
      <g fill="#fff" opacity=".85"><circle cx="1200" cy="740" r="9"/><circle cx="1330" cy="700" r="7"/><circle cx="1440" cy="740" r="10"/><circle cx="1270" cy="760" r="6"/></g>
    </g>
  </g>`,
  // 7 — Back home: the family hug.
  () => `<g id="s7-cam">
    ${reef({ night: true, seed: 71 })}
    <g id="jelly" transform="translate(300 260)">
      <g id="jelly-in"><circle r="110" fill="url(#gGlowPink)"/><path d="M-50 0 Q-50 -56 0 -56 Q50 -56 50 0 Q25 10 0 0 Q-25 10 -50 0 Z" fill="#ffb8f0" stroke="${INK}" stroke-width="4"/>
      <path d="M-30 6 q-6 40 6 70 M0 8 q8 44 -4 80 M30 6 q6 40 -6 70" stroke="#ffb8f0" stroke-width="6" stroke-linecap="round" fill="none"/></g>
    </g>
    ${crab('m7', { x: 1560, y: 830, s: 1.0, kind: 'mom' })}
    ${crab('d7', { x: 1700, y: 840, s: 1.08, kind: 'dad', flip: true })}
    ${crab('z7', { x: 900, y: 860, s: 0.95 })}
    ${heart('s7-heart', 820, 600, 1.4)}${heart('s7-heart', 960, 560, 1.1)}${heart('s7-heart', 1100, 610, 1.3)}
  </g>`,
];
