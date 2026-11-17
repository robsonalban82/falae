// Rigged SVG characters for the story video. Every movable part has an id
// (`<id>-part`) so the GSAP timeline in animate.js can drive it.

export const INK = '#2a1a2e';

/** Gradients shared by every scene. Kept in an always-rendered SVG (gradients in hidden SVGs do not paint). */
export function defs() {
  const radial = (id, stops, cx = '35%', cy = '30%', r = '75%') =>
    `<radialGradient id="${id}" cx="${cx}" cy="${cy}" r="${r}">${stops
      .map(([o, c, a = 1]) => `<stop offset="${o}" stop-color="${c}" stop-opacity="${a}"/>`)
      .join('')}</radialGradient>`;
  const linear = (id, stops, x2 = 0, y2 = 1) =>
    `<linearGradient id="${id}" x1="0" y1="0" x2="${x2}" y2="${y2}">${stops
      .map(([o, c, a = 1]) => `<stop offset="${o}" stop-color="${c}" stop-opacity="${a}"/>`)
      .join('')}</linearGradient>`;
  return [
    radial('gShell', [
      [0, '#ffa27a'],
      [0.45, '#f4572d'],
      [1, '#b8301a'],
    ]),
    radial('gShellMom', [
      [0, '#ffab8a'],
      [0.45, '#ef6040'],
      [1, '#b23a24'],
    ]),
    radial('gShellDad', [
      [0, '#ff9570'],
      [0.45, '#e04a24'],
      [1, '#9c2a14'],
    ]),
    radial('gClaw', [
      [0, '#ffb08c'],
      [0.5, '#f4572d'],
      [1, '#b8301a'],
    ]),
    radial('gEyeW', [
      [0, '#ffffff'],
      [0.7, '#f4f6fb'],
      [1, '#d6dbe8'],
    ]),
    radial(
      'gIris',
      [
        [0, '#5a3b2a'],
        [0.55, '#2a1a1c'],
        [1, '#0e0a10'],
      ],
      '40%',
      '35%',
    ),
    radial(
      'gHazel',
      [
        [0, '#d9b45a'],
        [0.45, '#8a7a34'],
        [1, '#4a4420'],
      ],
      '45%',
      '45%',
      '60%',
    ),
    radial('gSkin', [
      [0, '#ffe2c8'],
      [0.6, '#f8cba4'],
      [1, '#e9aa80'],
    ]),
    linear('gHair', [
      [0, '#fff0a8'],
      [0.45, '#f6d468'],
      [1, '#d9a83a'],
    ]),
    linear('gDress', [
      [0, '#fff6b8'],
      [0.5, '#ffe47e'],
      [1, '#f2c544'],
    ]),
    linear('gPaj', [
      [0, '#e2eaff'],
      [1, '#a9bdf2'],
    ]),
    linear('gJacket', [
      [0, '#a8dccd'],
      [1, '#5f9a8b'],
    ]),
    linear('gSkyDay', [
      [0, '#5cc4ff'],
      [0.7, '#b6e6ff'],
      [1, '#e6f7ff'],
    ]),
    linear('gSkyNight', [
      [0, '#070a26'],
      [0.6, '#1c2160'],
      [1, '#3a3f86'],
    ]),
    linear('gSeaDay', [
      [0, '#1aa6c4'],
      [0.5, '#34c4d4'],
      [1, '#7fe0e0'],
    ]),
    linear('gSeaNight', [
      [0, '#0f1a4a'],
      [1, '#2a3a7a'],
    ]),
    linear('gSandDay', [
      [0, '#f9e2a8'],
      [1, '#eac27c'],
    ]),
    linear('gSandNight', [
      [0, '#8a86ae'],
      [1, '#5e5a82'],
    ]),
    linear('gWetDay', [
      [0, '#d9b678'],
      [1, '#f0d496'],
    ]),
    linear('gWaterDay', [
      [0, '#7fdcff'],
      [0.35, '#2aa6dc'],
      [1, '#0e5e9c'],
    ]),
    linear('gWaterNight', [
      [0, '#2a4a9a'],
      [0.35, '#12266a'],
      [1, '#060c34'],
    ]),
    linear('gRay', [
      [0, '#ffffff', 0.55],
      [1, '#ffffff', 0],
    ]),
    linear('gRayNight', [
      [0, '#cfe0ff', 0.4],
      [1, '#cfe0ff', 0],
    ]),
    radial(
      'gGlow',
      [
        [0, '#9effe9', 0.9],
        [0.4, '#5ff2d6', 0.45],
        [1, '#5ff2d6', 0],
      ],
      '50%',
      '50%',
      '50%',
    ),
    radial(
      'gGlowPink',
      [
        [0, '#ffc2f0', 0.9],
        [0.4, '#ff7fd8', 0.4],
        [1, '#ff7fd8', 0],
      ],
      '50%',
      '50%',
      '50%',
    ),
    radial(
      'gSunGlow',
      [
        [0, '#fff6c2', 0.95],
        [0.35, '#ffe27a', 0.6],
        [1, '#ffe27a', 0],
      ],
      '50%',
      '50%',
      '50%',
    ),
    radial(
      'gMoonGlow',
      [
        [0, '#fffbe6', 0.8],
        [0.3, '#e8ecff', 0.35],
        [1, '#e8ecff', 0],
      ],
      '50%',
      '50%',
      '50%',
    ),
    radial(
      'gSpark',
      [
        [0, '#ffffff', 1],
        [0.3, '#fff3b0', 0.8],
        [1, '#fff3b0', 0],
      ],
      '50%',
      '50%',
      '50%',
    ),
    radial(
      'gLamp',
      [
        [0, '#ffd88a', 0.55],
        [1, '#ffd88a', 0],
      ],
      '50%',
      '50%',
      '50%',
    ),
    linear('gWallDay', [
      [0, '#ffe9d6'],
      [1, '#ffd9bd'],
    ]),
    linear('gWallNight', [
      [0, '#22285e'],
      [1, '#2e2f6e'],
    ]),
    linear('gBed', [
      [0, '#ffc2da'],
      [1, '#f48ab6'],
    ]),
    linear('gWood', [
      [0, '#c88a52'],
      [1, '#94582c'],
    ]),
    linear('gMelon', [
      [0, '#ff6b7a'],
      [1, '#e8364a'],
    ]),
  ].join('');
}

/**
 * Zeca and his parents. Origin: middle of the shell; feet at y≈62.
 * kind: 'zeca' (white star), 'mom' (eyelashes and a bow), 'dad' (bushy brows).
 */
export function crab(id, { x, y, s = 1, flip = false, kind = 'zeca' } = {}) {
  const shell = kind === 'mom' ? 'gShellMom' : kind === 'dad' ? 'gShellDad' : 'gShell';
  const dark = '#8a2412';
  const leg = (side, k) => {
    const sx = side;
    const hipX = 40 + k * 4;
    const hipY = 12 + k * 13;
    const kneeX = 86 + k * 6;
    const kneeY = -8 + k * 14;
    const footX = 96 + k * 4;
    const footY = 60;
    const d = `M${sx * hipX} ${hipY} Q${sx * kneeX} ${kneeY} ${sx * footX} ${footY}`;
    const name = `${id}-leg-${side < 0 ? 'l' : 'r'}${k}`;
    return `<g id="${name}" class="leg ${k % 2 ? 'leg-b' : 'leg-a'}" data-ox="${sx * hipX}" data-oy="${hipY}">
      <path d="${d}" stroke="${dark}" stroke-width="15" stroke-linecap="round" fill="none"/>
      <path d="${d}" stroke="#e84a26" stroke-width="9" stroke-linecap="round" fill="none"/>
    </g>`;
  };
  const arm = (side) => {
    const sx = side;
    const n = side < 0 ? 'l' : 'r';
    const elbow = `${sx * 86} -22`;
    const wrist = `${sx * 98} -62`;
    const armD = `M${sx * 50} 0 Q${elbow} ${wrist}`;
    // Pincer: fixed lower jaw + upper jaw that opens around the hinge.
    const cx = sx * 104;
    const cy = -84;
    return `<g id="${id}-arm-${n}" data-ox="${sx * 50}" data-oy="0">
      <path d="${armD}" stroke="${dark}" stroke-width="17" stroke-linecap="round" fill="none"/>
      <path d="${armD}" stroke="#e84a26" stroke-width="11" stroke-linecap="round" fill="none"/>
      <g id="${id}-claw-${n}">
        <path d="M${cx - sx * 26} ${cy + 18} Q${cx - sx * 30} ${cy - 10} ${cx} ${cy - 6} Q${cx + sx * 30} ${cy - 2} ${cx + sx * 30} ${cy + 10} Q${cx + sx * 10} ${cy + 4} ${cx + sx * 4} ${cy + 16} Q${cx - sx * 4} ${cy + 34} ${cx - sx * 26} ${cy + 18} Z"
          fill="url(#gClaw)" stroke="${dark}" stroke-width="5" stroke-linejoin="round"/>
        <g id="${id}-pin-${n}" data-ox="${cx - sx * 8}" data-oy="${cy - 8}">
          <path d="M${cx - sx * 10} ${cy - 6} Q${cx - sx * 4} ${cy - 42} ${cx + sx * 26} ${cy - 40} Q${cx + sx * 40} ${cy - 30} ${cx + sx * 32} ${cy - 16} Q${cx + sx * 16} ${cy - 24} ${cx + sx * 4} ${cy - 6} Z"
            fill="url(#gClaw)" stroke="${dark}" stroke-width="5" stroke-linejoin="round"/>
          <path d="M${cx + sx * 2} ${cy - 30} q${sx * 10} -6 ${sx * 18} -4" stroke="#fff" stroke-width="4" stroke-linecap="round" fill="none" opacity=".55"/>
        </g>
        <path d="M${cx - sx * 16} ${cy + 6} q${sx * 8} -8 ${sx * 20} -6" stroke="#fff" stroke-width="4" stroke-linecap="round" fill="none" opacity=".5"/>
      </g>
    </g>`;
  };
  const eye = (side) => {
    const ex = side * 30;
    const ey = -88;
    return `<g>
      <path d="M${side * 16} -30 Q${side * 22} -52 ${ex} ${ey + 16}" stroke="${dark}" stroke-width="14" stroke-linecap="round" fill="none"/>
      <path d="M${side * 16} -30 Q${side * 22} -52 ${ex} ${ey + 16}" stroke="#e84a26" stroke-width="8" stroke-linecap="round" fill="none"/>
      <circle cx="${ex}" cy="${ey}" r="27" fill="url(#gEyeW)" stroke="${dark}" stroke-width="5"/>
      <g class="look">
        <circle cx="${ex + 2}" cy="${ey + 3}" r="16" fill="url(#gIris)"/>
        <circle cx="${ex - 5}" cy="${ey - 4}" r="6.5" fill="#fff"/>
        <circle cx="${ex + 8}" cy="${ey + 10}" r="3" fill="#fff" opacity=".9"/>
      </g>
      <circle class="lid" cx="${ex}" cy="${ey}" r="28.5" fill="#e84a26" stroke="${dark}" stroke-width="5" data-ox="${ex}" data-oy="${ey - 28}"/>
      ${
        kind === 'mom'
          ? `<path d="M${ex + side * 18} ${ey - 20} l${side * 10} -10 M${ex + side * 24} ${ey - 10} l${side * 12} -5 M${ex + side * 8} ${ey - 26} l${side * 6} -12" stroke="${INK}" stroke-width="4.5" stroke-linecap="round"/>`
          : ''
      }
    </g>`;
  };
  const brows =
    kind === 'dad'
      ? `<path d="M-56 -128 Q-32 -140 -10 -126 M56 -128 Q32 -140 10 -126" stroke="${INK}" stroke-width="10" stroke-linecap="round" fill="none"/>`
      : `<path d="M-48 -126 Q-32 -134 -16 -126 M48 -126 Q32 -134 16 -126" stroke="${dark}" stroke-width="5" stroke-linecap="round" fill="none"/>`;
  return `<g transform="translate(${x} ${y}) scale(${flip ? -s : s} ${s})">
  <g id="${id}">
    <ellipse id="${id}-shadow" cx="0" cy="64" rx="92" ry="14" fill="#1b1030" opacity=".2"/>
    <g id="${id}-body" data-ox="0" data-oy="62">
      ${[0, 1, 2].map((k) => leg(-1, k) + leg(1, k)).join('')}
      ${arm(-1)}${arm(1)}
      <ellipse cx="0" cy="10" rx="70" ry="52" fill="url(#${shell})" stroke="${dark}" stroke-width="6"/>
      <path d="M-58 28 Q0 74 58 28 Q40 48 0 50 Q-40 48 -58 28 Z" fill="#ffb38f" opacity=".7"/>
      <g fill="#c23a1e" opacity=".55">
        <circle cx="-38" cy="-8" r="6"/><circle cx="-22" cy="-24" r="4"/><circle cx="40" cy="20" r="5"/>
      </g>
      <ellipse cx="-30" cy="-18" rx="20" ry="9" fill="#fff" opacity=".55" transform="rotate(-24 -30 -18)"/>
      <circle cx="-48" cy="-2" r="4" fill="#fff" opacity=".6"/>
      ${
        kind === 'zeca'
          ? `<path d="M34 -16 l5 11 12 1 -9 8 3 12 -11 -6 -11 6 3 -12 -9 -8 12 -1 Z" fill="#fff" stroke="${dark}" stroke-width="2.5" stroke-linejoin="round"/>`
          : ''
      }
      ${
        kind === 'mom'
          ? `<g transform="translate(-52 -40) rotate(-20)"><path d="M0 0 L-18 -12 L-18 12 Z M0 0 L18 -12 L18 12 Z" fill="#ff7fb8" stroke="${INK}" stroke-width="3.5" stroke-linejoin="round"/><circle r="6" fill="#ff5ca0" stroke="${INK}" stroke-width="3"/></g>`
          : ''
      }
      <g id="${id}-eyes" data-ox="0" data-oy="-30">
        ${eye(-1)}${eye(1)}
        <g id="${id}-brows" data-ox="0" data-oy="-128">${brows}</g>
      </g>
      <g id="${id}-blush" opacity=".45">
        <ellipse cx="-44" cy="16" rx="12" ry="7" fill="#ff7f8f"/>
        <ellipse cx="44" cy="16" rx="12" ry="7" fill="#ff7f8f"/>
      </g>
      <g class="mouth" id="${id}-m-smile"><path d="M-24 14 Q0 44 24 14 Q0 26 -24 14 Z" fill="${INK}"/><path d="M-10 28 Q0 22 10 28 Q0 36 -10 28 Z" fill="#ff7f8f"/></g>
      <g class="mouth" id="${id}-m-small" opacity="0"><path d="M-14 20 Q0 32 14 20" stroke="${INK}" stroke-width="5.5" stroke-linecap="round" fill="none"/></g>
      <g class="mouth" id="${id}-m-open" opacity="0"><ellipse cx="0" cy="26" rx="15" ry="19" fill="${INK}"/><ellipse cx="0" cy="36" rx="9" ry="6" fill="#ff7f8f"/></g>
      <g class="mouth" id="${id}-m-sad" opacity="0"><path d="M-16 30 Q0 16 16 30" stroke="${INK}" stroke-width="5.5" stroke-linecap="round" fill="none"/></g>
      <g class="mouth" id="${id}-m-grin" opacity="0"><path d="M-30 10 Q0 58 30 10 Q0 22 -30 10 Z" fill="${INK}"/><path d="M-14 32 Q0 22 14 32 Q0 44 -14 32 Z" fill="#ff7f8f"/></g>
      <path id="${id}-tear" d="M-30 -56 Q-38 -42 -30 -36 Q-22 -42 -30 -56 Z" fill="#9ad8ff" stroke="#4a8ac0" stroke-width="2" opacity="0"/>
    </g>
  </g>
</g>`;
}

const OUTFITS = {
  dress: { top: 'url(#gDress)', edge: '#c99a1c', leg: 'url(#gSkin)', sleeve: null },
  pajamas: { top: 'url(#gPaj)', edge: '#6a7fc0', leg: 'url(#gPaj)', sleeve: 'url(#gPaj)' },
  jacket: { top: 'url(#gJacket)', edge: '#3f7266', leg: 'url(#gPaj)', sleeve: 'url(#gJacket)' },
};

/**
 * Giulia, 5 years old, front view. Origin: between the feet. Standing height ≈ 560.
 * pose 'kneel' lowers the upper body so she kneels on the sand.
 */
export function girl(id, { x, y, s = 1, pose = 'stand', outfit = 'dress' } = {}) {
  const o = OUTFITS[outfit];
  const drop = pose === 'kneel' ? 128 : 0;
  const limb = (d, fill, w) =>
    `<path d="${d}" stroke="${INK}" stroke-width="${w + 7}" stroke-linecap="round" fill="none"/><path d="${d}" stroke="${fill}" stroke-width="${w}" stroke-linecap="round" fill="none"/>`;
  const skinStroke = '#f3bf96';
  const knees = `<g>
    <ellipse cx="-44" cy="-16" rx="42" ry="24" fill="${outfit === 'dress' ? 'url(#gSkin)' : 'url(#gPaj)'}" stroke="${INK}" stroke-width="5"/>
    <ellipse cx="44" cy="-16" rx="42" ry="24" fill="${outfit === 'dress' ? 'url(#gSkin)' : 'url(#gPaj)'}" stroke="${INK}" stroke-width="5"/>
    <path d="M-70 -30 q16 -8 34 -6 M70 -30 q-16 -8 -34 -6" stroke="#fff" stroke-width="5" stroke-linecap="round" fill="none" opacity=".5"/>
  </g>`;
  const legs =
    pose === 'kneel'
      ? `${outfit === 'dress' ? `<path d="M-104 -8 q-16 0 -18 -14 q2 -10 18 -8 Z M104 -8 q16 0 18 -14 q-2 -10 -18 -8 Z" fill="#8a5530" stroke="${INK}" stroke-width="4"/>` : ''}`
      : [-1, 1]
          .map((side) => {
            const legColor = o.leg === 'url(#gSkin)' ? skinStroke : '#b8c8f4';
            const strap =
              outfit === 'dress'
                ? `<path d="M${side * 46} -26 L${side * 16} -14" stroke="#6a3c1c" stroke-width="6" stroke-linecap="round"/>`
                : '';
            return `<g id="${id}-leg-${side < 0 ? 'l' : 'r'}" data-ox="${side * 24}" data-oy="-170">
              ${limb(`M${side * 24} -170 L${side * 26} -22`, legColor, 30)}
              <path d="M${side * 56} -4 Q${side * 56} -22 ${side * 28} -22 Q${side * 6} -22 ${side * 6} -4 Z" fill="#8a5530" stroke="${INK}" stroke-width="4" stroke-linejoin="round"/>
              ${strap}
            </g>`;
          })
          .join('');
  const sleeve = o.sleeve ? (outfit === 'jacket' ? '#7fb3a6' : '#bccbf4') : skinStroke;
  const arm = (side) => {
    const n = side < 0 ? 'l' : 'r';
    const sx = side;
    const d = `M${sx * 52} -378 Q${sx * 70} -320 ${sx * 66} -262`;
    return `<g id="${id}-arm-${n}" data-ox="${sx * 52}" data-oy="-378">
      ${limb(d, sleeve, 28)}
      ${o.sleeve ? '' : ''}
      <g id="${id}-hand-${n}">
        <circle cx="${sx * 66}" cy="-252" r="19" fill="url(#gSkin)" stroke="${INK}" stroke-width="5"/>
        <path id="${id}-finger-${n}" d="M${sx * 66} -238 q${sx * 2} 22 ${sx * 0} 30" stroke="${INK}" stroke-width="15" stroke-linecap="round" fill="none" opacity="0"/>
        <path id="${id}-fingerfill-${n}" d="M${sx * 66} -238 q${sx * 2} 22 ${sx * 0} 30" stroke="${skinStroke}" stroke-width="9" stroke-linecap="round" fill="none" opacity="0"/>
      </g>
    </g>`;
  };
  const top =
    outfit === 'dress'
      ? `<path d="M-60 -386 Q0 -402 60 -386 L54 -360 L-54 -360 Z" fill="url(#gSkin)" stroke="${INK}" stroke-width="5" stroke-linejoin="round"/>
         <path d="M-34 -392 L-30 -366 M34 -392 L30 -366" stroke="#e8b42a" stroke-width="7" stroke-linecap="round"/>
         <path d="M-52 -368 Q0 -380 52 -368 L56 -300 Q100 -230 112 -160 Q90 -146 56 -156 Q30 -144 0 -154 Q-30 -144 -56 -156 Q-90 -146 -112 -160 Q-100 -230 -56 -300 Z"
           fill="url(#gDress)" stroke="${INK}" stroke-width="5.5" stroke-linejoin="round"/>
         <path d="M-104 -168 Q-90 -156 -56 -164 Q-30 -152 0 -162 Q30 -152 56 -164 Q90 -156 104 -168" stroke="#fff" stroke-width="7" stroke-linecap="round" fill="none" opacity=".85"/>
         <path d="M-54 -302 Q0 -290 54 -302" stroke="${o.edge}" stroke-width="5" fill="none"/>
         <path d="M40 -250 Q70 -210 80 -170 Q60 -164 48 -168 Q50 -210 40 -250 Z" fill="#f2c544" opacity=".6"/>
         <g transform="translate(-30 -232)"><circle r="9" fill="#fff"/><circle cx="-11" cy="0" r="7" fill="#fff"/><circle cx="11" cy="0" r="7" fill="#fff"/><circle cx="0" cy="-11" r="7" fill="#fff"/><circle cx="0" cy="11" r="7" fill="#fff"/><circle r="5.5" fill="#ff9f2e"/></g>`
      : `<path d="M-62 -380 Q0 -398 62 -380 L76 -230 Q${outfit === 'jacket' ? '84 -180 80 -150' : '70 -170 66 -160'} Q0 -146 ${outfit === 'jacket' ? '-80 -150' : '-66 -160'} Q${outfit === 'jacket' ? '-84 -180' : '-70 -170'} -76 -230 Z"
           fill="${o.top}" stroke="${INK}" stroke-width="5.5" stroke-linejoin="round"/>
         ${
           outfit === 'jacket'
             ? `<path d="M0 -388 L0 -150" stroke="${o.edge}" stroke-width="5"/><path d="M-40 -390 Q-60 -420 -30 -430 M40 -390 Q60 -420 30 -430" stroke="${o.edge}" stroke-width="6" fill="none" stroke-linecap="round"/><rect x="-60" y="-236" width="30" height="24" rx="6" fill="none" stroke="${o.edge}" stroke-width="4"/>`
             : `<g fill="#fff8c8" stroke="#d8c060" stroke-width="2">${[
                 [-30, -320],
                 [26, -290],
                 [-12, -228],
                 [40, -200],
                 [-44, -186],
               ]
                 .map(
                   ([sx, sy]) =>
                     `<path transform="translate(${sx} ${sy}) scale(.7)" d="M0 -12 L3.5 -4 12 -3.5 5.5 2 7.5 11 0 6 -7.5 11 -5.5 2 -12 -3.5 -3.5 -4 Z"/>`,
                 )
                 .join('')}</g>`
         }`;
  const eye = (side) => {
    const ex = side * 30;
    const ey = -470;
    return `<g>
      <ellipse cx="${ex}" cy="${ey}" rx="21" ry="25" fill="url(#gEyeW)" stroke="${INK}" stroke-width="4"/>
      <g class="look">
        <circle cx="${ex + 1}" cy="${ey + 3}" r="15.5" fill="url(#gHazel)"/>
        <circle cx="${ex + 1}" cy="${ey + 3}" r="7.5" fill="#1a120e"/>
        <circle cx="${ex - 5}" cy="${ey - 5}" r="6" fill="#fff"/>
        <circle cx="${ex + 7}" cy="${ey + 9}" r="2.6" fill="#fff" opacity=".9"/>
      </g>
      <ellipse class="lid" cx="${ex}" cy="${ey}" rx="22.5" ry="26.5" fill="url(#gSkin)" stroke="${INK}" stroke-width="4" data-ox="${ex}" data-oy="${ey - 26}"/>
      <path d="M${ex + side * 16} ${ey - 18} l${side * 10} -8 M${ex + side * 21} ${ey - 9} l${side * 11} -3" stroke="${INK}" stroke-width="4" stroke-linecap="round"/>
    </g>`;
  };
  return `<g transform="translate(${x} ${y}) scale(${s})">
  <g id="${id}">
    <ellipse id="${id}-shadow" cx="0" cy="0" rx="${pose === 'kneel' ? 150 : 100}" ry="18" fill="#1b1030" opacity=".2"/>
    <g id="${id}-body" data-ox="0" data-oy="0">
      ${legs}
      <g transform="translate(0 ${drop})">
        <path d="M-88 -470 Q-98 -590 0 -598 Q98 -590 88 -470 L90 -360 Q66 -340 44 -362 L-44 -362 Q-66 -340 -90 -360 Z" fill="url(#gHair)" stroke="${INK}" stroke-width="5.5" stroke-linejoin="round"/>
        ${arm(-1)}
        <rect x="-16" y="-410" width="32" height="34" fill="url(#gSkin)" stroke="${INK}" stroke-width="4"/>
        ${top}
        ${arm(1)}
        <g id="${id}-head" data-ox="0" data-oy="-400">
          <circle cx="-80" cy="-462" r="16" fill="url(#gSkin)" stroke="${INK}" stroke-width="4.5"/>
          <circle cx="80" cy="-462" r="16" fill="url(#gSkin)" stroke="${INK}" stroke-width="4.5"/>
          <ellipse cx="0" cy="-466" rx="80" ry="78" fill="url(#gSkin)" stroke="${INK}" stroke-width="5.5"/>
          ${eye(-1)}${eye(1)}
          <g id="${id}-brows" data-ox="0" data-oy="-508">
            <path d="M-46 -506 Q-30 -516 -14 -508 M46 -506 Q30 -516 14 -508" stroke="#b8862a" stroke-width="6" stroke-linecap="round" fill="none"/>
          </g>
          <path d="M-4 -440 Q0 -434 5 -440" stroke="#c98a62" stroke-width="4" stroke-linecap="round" fill="none"/>
          <g id="${id}-blush" opacity=".55"><ellipse cx="-50" cy="-430" rx="15" ry="9" fill="#ff8f9a"/><ellipse cx="50" cy="-430" rx="15" ry="9" fill="#ff8f9a"/></g>
          <g class="mouth" id="${id}-m-smile"><path d="M-20 -418 Q0 -398 20 -418" stroke="${INK}" stroke-width="5" stroke-linecap="round" fill="none"/></g>
          <g class="mouth" id="${id}-m-laugh" opacity="0"><path d="M-24 -422 Q0 -380 24 -422 Q0 -414 -24 -422 Z" fill="${INK}" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/><path d="M-11 -402 Q0 -410 11 -402 Q0 -394 -11 -402 Z" fill="#ff7f8f"/></g>
          <g class="mouth" id="${id}-m-o" opacity="0"><ellipse cx="2" cy="-412" rx="9" ry="11" fill="${INK}"/></g>
          <g class="mouth" id="${id}-m-ouch" opacity="0"><path d="M-20 -404 L-10 -416 L0 -404 L10 -416 L20 -404 Q0 -392 -20 -404 Z" fill="${INK}" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/></g>
          <g class="mouth" id="${id}-m-sad" opacity="0"><path d="M-16 -404 Q0 -418 16 -404" stroke="${INK}" stroke-width="5" stroke-linecap="round" fill="none"/></g>
          <path id="${id}-tear" d="M38 -448 Q30 -432 38 -426 Q46 -432 38 -448 Z" fill="#9ad8ff" stroke="#4a8ac0" stroke-width="2" opacity="0"/>
          <path d="M-84 -470 Q-90 -560 0 -566 Q90 -560 84 -470 Q76 -520 40 -526 Q30 -500 6 -510 Q-6 -528 -30 -522 Q-50 -502 -70 -516 Q-82 -500 -84 -470 Z"
            fill="url(#gHair)" stroke="${INK}" stroke-width="5.5" stroke-linejoin="round"/>
          <path d="M-84 -470 Q-92 -420 -86 -372 Q-74 -380 -72 -420 Q-70 -450 -74 -470 Z M84 -470 Q92 -420 86 -372 Q74 -380 72 -420 Q70 -450 74 -470 Z" fill="url(#gHair)" stroke="${INK}" stroke-width="4.5" stroke-linejoin="round"/>
          <path d="M-40 -556 Q-60 -540 -64 -510 M20 -560 Q44 -548 54 -520 M-6 -562 Q-14 -540 -12 -520" stroke="#fff6c8" stroke-width="5" stroke-linecap="round" fill="none" opacity=".8"/>
          <g transform="translate(54 -536) rotate(20)"><ellipse rx="16" ry="11" fill="#ff6b8a" stroke="${INK}" stroke-width="4"/><circle cx="-4" cy="-2" r="3" fill="#fff" opacity=".8"/></g>
        </g>
      </g>
      ${pose === 'kneel' ? knees : ''}
    </g>
  </g>
</g>`;
}
