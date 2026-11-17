/* global gsap */
// Choreography of the story video. Reads window.STORY (scene starts) and registers
// one paused GSAP timeline for HyperFrames. Every tween sits at an absolute time.
(() => {
  const { starts: S, total: TOTAL, fade: FADE } = window.STORY;
  const tl = gsap.timeline({ paused: true });
  const $$ = (sel) => Array.from(document.querySelectorAll(sel));

  for (const el of $$('[data-ox]'))
    gsap.set(el, { svgOrigin: `${el.dataset.ox} ${el.dataset.oy}` });
  gsap.set('.lid', { scaleY: 0 });
  for (let i = 0; i < S.length; i++) gsap.set(`#s${i}-cam`, { svgOrigin: '960 540' });

  // Odd repeat count for yoyo loops, so a loop always ends back at rest.
  const odd = (dur, half) => Math.max(1, 2 * Math.round(dur / half / 2) - 1);
  const loop = (target, vars, t, dur, half, ease = 'sine.inOut') =>
    tl.to(target, { ...vars, duration: half, yoyo: true, repeat: odd(dur, half), ease }, t);

  // ---- character helpers ----
  const blink = (id, t) =>
    tl.to(
      `#${id} .lid`,
      { scaleY: 1, duration: 0.07, yoyo: true, repeat: 1, ease: 'power1.in' },
      t,
    );
  const blinks = (id, t0, t1, every = 3.2, phase = 0.9) => {
    for (let t = t0 + phase; t < t1 - 0.4; t += every) blink(id, t);
  };
  const mouth = (id, name, t) => {
    for (const m of $$(`#${id} .mouth`))
      tl.set(m, { opacity: m.id === `${id}-m-${name}` ? 1 : 0 }, t);
  };
  const look = (id, x, y, t, d = 0.3) =>
    tl.to(`#${id} .look`, { x, y, duration: d, ease: 'sine.inOut' }, t);
  const lids = (id, v, t, d = 0.3) => tl.to(`#${id} .lid`, { scaleY: v, duration: d }, t);
  const to = (sel, vars, t, d = 0.4, ease = 'sine.inOut') =>
    tl.to(sel, { ...vars, duration: d, ease }, t);
  const set = (sel, vars, t) => tl.set(sel, vars, t);
  const scuttle = (id, t, d, amp = 18, half = 0.07) => {
    loop(`#${id} .leg-a`, { rotation: amp }, t, d, half);
    loop(`#${id} .leg-b`, { rotation: -amp }, t, d, half);
    loop(`#${id}-body`, { y: -7 }, t, d, half);
  };
  const walk = (id, vars, t, d, ease = 'sine.inOut') => {
    to(`#${id}`, vars, t, d, ease);
    scuttle(id, t, d);
  };
  const hop = (id, t, h = 40, d = 0.36) => {
    tl.to(`#${id}-body`, { y: -h, duration: d / 2, ease: 'power2.out', yoyo: true, repeat: 1 }, t);
  };
  const crabIdle = (id, t0, t1, phase = 0.9) => {
    loop(`#${id}-eyes`, { y: -5 }, t0, t1 - t0, 1.1);
    blinks(id, t0, t1, 3.1, phase);
  };
  const girlIdle = (id, t0, t1, phase = 1.4) => {
    loop(`#${id}-head`, { rotation: 2 }, t0, t1 - t0, 1.6);
    blinks(id, t0, t1, 3.4, phase);
  };
  const finger = (id, on, t) =>
    set([`#${id}-finger-r`, `#${id}-fingerfill-r`], { opacity: on ? 1 : 0 }, t);
  const pop = (sel, t, d = 0.35) =>
    tl.fromTo(
      sel,
      { scale: 0, opacity: 1, transformOrigin: '50% 50%' },
      { scale: 1, duration: d, ease: 'back.out(2.2)' },
      t,
    );
  const shake = (sel, t, amp = 12, d = 0.5) =>
    tl.to(
      sel,
      { keyframes: { x: [0, -amp, amp, -amp * 0.7, amp * 0.5, 0] }, duration: d, ease: 'none' },
      t,
    );
  const zoom = (i, from, to2) => {
    const end = i + 1 < S.length ? S[i + 1] + FADE : TOTAL;
    tl.fromTo(
      `#s${i}-cam`,
      { scale: from },
      { scale: to2, duration: end - S[i], ease: 'none' },
      S[i],
    );
  };

  // ---- background loops (scoped to a scene) ----
  const ambient = (i) => {
    const t0 = S[i];
    const d = (i + 1 < S.length ? S[i + 1] + FADE : TOTAL) - t0;
    const c = `#s${i}-cam`;
    const has = (sel) => document.querySelector(c + ' ' + sel);
    if (has('.rays')) loop(`${c} .rays`, { opacity: 0.55, x: 24 }, t0, d, 2.4);
    $$(`${c} .weed`).forEach((el, k) =>
      loop(el, { rotation: k % 2 ? 5 : -5 }, t0 + k * 0.2, d - 1, 1.6 + (k % 3) * 0.3),
    );
    $$(`${c} .bubble`).forEach((el, k) => {
      const dur = 5 + (k % 5);
      tl.fromTo(
        el,
        { y: 0, opacity: 0 },
        {
          keyframes: { y: [0, -320, -640], opacity: [0, 1, 0] },
          duration: dur,
          ease: 'none',
          repeat: Math.ceil(d / dur),
        },
        t0 - (k % 4) * 0.8 + 0.8,
      );
    });
    $$(`${c} .glow`).forEach((el, k) =>
      loop(el, { opacity: 0.45, scale: 0.9, transformOrigin: '50% 50%' }, t0 + k * 0.3, d, 1.3),
    );
    $$(`${c} .star`).forEach((el, k) =>
      loop(el, { opacity: 0.25 }, t0 + (k % 7) * 0.25, d, 0.9 + (k % 4) * 0.3),
    );
    $$(`${c} .cloud`).forEach((el, k) => to(el, { x: 70 + k * 30 }, t0, d, 'none'));
    if (has('.gulls')) {
      to(`${c} .gulls`, { x: 520, y: -40 }, t0, d, 'none');
      $$(`${c} .gull`).forEach((el) =>
        loop(el, { scaleY: 0.6, transformOrigin: '50% 100%' }, t0, d, 0.25),
      );
    }
    if (has('.foam')) loop(`${c} .foam`, { y: 12, x: -16 }, t0, d, 1.8);
    if (has('.waves')) loop(`${c} .waves`, { x: 36 }, t0, d, 2.2);
    if (has('.sparkle')) loop(`${c} .sparkle`, { opacity: 0.3 }, t0, d, 0.8);
    if (has('.moonpath')) loop(`${c} .moonpath`, { opacity: 0.3 }, t0, d, 1.2);
    if (has('.fronds')) loop(`${c} .fronds`, { rotation: 3 }, t0, d, 1.8);
    if (has('.sunglow'))
      loop(`${c} .sunglow`, { scale: 1.08, transformOrigin: '50% 50%' }, t0, d, 2);
    if (has('.curtain-l')) {
      loop(`${c} .curtain-l`, { rotation: 1.5 }, t0, d, 2.2);
      loop(`${c} .curtain-r`, { rotation: -1.5 }, t0, d, 2.2);
    }
    if (has('.lamp')) loop(`${c} .lamp`, { opacity: 0.75 }, t0, d, 1.4);
    $$(`${c} .fish`).forEach((el, k) =>
      tl.fromTo(
        el,
        { x: 0 },
        { x: 2400, duration: [13, 17, 10][k % 3], ease: 'none' },
        t0 + k * 1.5,
      ),
    );
  };
  for (let i = 0; i < S.length; i++) ambient(i);

  // ---- scene cross-fades ----
  for (let i = 1; i < S.length; i++)
    tl.fromTo(`#scene-${i}`, { opacity: 0 }, { opacity: 1, duration: FADE, ease: 'none' }, S[i]);

  // ---- 0: Zeca dreams of the surface ----
  {
    const t = S[0];
    zoom(0, 1, 1.07);
    crabIdle('z0', t, S[1]);
    crabIdle('m0', t, S[1], 1.6);
    crabIdle('d0', t, S[1], 2.3);
    loop('#d0-arm-r', { rotation: -16 }, t + 0.5, 10, 0.5);
    loop('#d0-pin-r', { rotation: -18 }, t + 0.5, 10, 0.25);
    loop('.tidy', { rotation: 8 }, t + 0.5, 10, 0.5);
    look('m0', -8, 0, t);
    // Hello during the title.
    loop('#z0-arm-r', { rotation: -24 }, t + 0.6, 2.2, 0.28);
    look('z0', 0, -9, t + 3.6);
    to('#z0-eyes', { scaleY: 1.16 }, t + 3.6, 0.4);
    mouth('z0', 'small', t + 3.8);
    lids('z0', 0.35, t + 5.8, 0.5);
    set('#z0-blush', { opacity: 0.9 }, t + 5.8);
    mouth('z0', 'smile', t + 5.9);
    tl.to(
      '#z0-body',
      { scaleY: 0.92, scaleX: 1.04, duration: 0.6, yoyo: true, repeat: 1, ease: 'sine.inOut' },
      t + 6.8,
    );
    lids('z0', 0, t + 8.4, 0.15);
    mouth('z0', 'grin', t + 8.4);
    to('#z0-eyes', { scaleY: 1 }, t + 8.4, 0.2);
    hop('z0', t + 8.6, 50);
    to('#z0', { y: -900, x: 80 }, t + 9.1, 2.8, 'power1.in');
    scuttle('z0', t + 9.1, 2.8, 22, 0.09);
    loop('#z0-arm-l', { rotation: 24 }, t + 9.1, 2.8, 0.18);
    loop('#z0-arm-r', { rotation: -24 }, t + 9.1, 2.8, 0.18);
  }

  // ---- 1: the fright on the beach ----
  {
    const t = S[1];
    zoom(1, 1.04, 1);
    set('#z1', { x: 900 }, t);
    look('z1', -9, 0, t);
    walk('z1', { x: 0 }, t + 0.3, 2.3);
    crabIdle('z1', t + 2.6, S[2]);
    girlIdle('g1', t, S[2]);
    look('g1', 6, 2, t + 0.6, 0.6);
    mouth('g1', 'o', t + 2.2);
    to('#g1-brows', { y: -8 }, t + 2.2, 0.2);
    finger('g1', true, t + 2.8);
    to('#g1-arm-r', { rotation: -75 }, t + 2.8, 1.3, 'sine.inOut');
    to('#g1-head', { rotation: 6 }, t + 2.8, 1);
    // Fright!
    const f = t + 4.2;
    hop('z1', f, 110, 0.5);
    to('#z1-eyes', { scaleY: 1.35 }, f, 0.12, 'back.out(3)');
    mouth('z1', 'open', f);
    to('#z1-arm-l', { rotation: 24 }, f, 0.15);
    to('#z1-arm-r', { rotation: -24 }, f, 0.15);
    to('#z1-pin-l', { rotation: 28 }, f, 0.12);
    to('#z1-pin-r', { rotation: -28 }, f, 0.12);
    pop('#s1-alert', f + 0.05);
    shake('#z1', f + 0.5, 12, 0.8);
    shake('#s1-cam', f, 10, 0.4);
    to('#g1-arm-r', { rotation: -28 }, f + 0.1, 0.2, 'power2.out');
    to('#g1-head', { rotation: -5 }, f + 0.1, 0.2);
    look('g1', 6, -4, f + 0.1, 0.1);
    mouth('g1', 'laugh', f + 1.4);
    to('#g1-head', { rotation: 0 }, f + 1.4, 0.5);
    to('#g1-brows', { y: 0 }, f + 1.4, 0.3);
    to('#z1-eyes', { scaleY: 1.12 }, f + 1.8, 0.4);
    mouth('z1', 'small', f + 1.9);
    to('#z1-arm-l', { rotation: 10 }, f + 1.9, 0.5);
    to('#z1-arm-r', { rotation: -10 }, f + 1.9, 0.5);
    to(['#z1-pin-l', '#z1-pin-r'], { rotation: 0 }, f + 1.9, 0.3);
    to('#s1-alert', { opacity: 0 }, f + 1.9, 0.4);
  }

  // ---- 2: the pinch, sorry and the watermelon ----
  {
    const t = S[2];
    zoom(2, 1, 1.05);
    // Same pose as the end of scene 1.
    set('#z2-eyes', { scaleY: 1.12 }, t);
    set('#z2-arm-l', { rotation: 10 }, t);
    set('#z2-arm-r', { rotation: -10 }, t);
    mouth('z2', 'small', t);
    look('z2', -9, 0, t);
    set('#g2-arm-r', { rotation: -28 }, t);
    finger('g2', true, t);
    mouth('g2', 'laugh', t);
    look('g2', 6, -2, t);
    set('#melon', { x: 40, y: -190, opacity: 0, rotation: -20, transformOrigin: '50% 100%' }, t);
    set('.s2-heart', { opacity: 0 }, t);
    girlIdle('g2', t, S[3], 2.2);
    crabIdle('z2', t, S[3], 1.7);

    walk('z2', { x: -140 }, t + 0.1, 0.7);
    to(['#z2-arm-l', '#z2-arm-r'], { rotation: 0 }, t + 0.1, 0.4);
    mouth('g2', 'smile', t + 0.4);
    to('#g2-arm-r', { rotation: -75 }, t + 0.4, 0.6);
    to('#z2-pin-l', { rotation: 30 }, t + 0.9, 0.2);
    // Pinch!
    const p = t + 1.25;
    to('#z2-pin-l', { rotation: -6 }, p, 0.06, 'power3.in');
    mouth('g2', 'ouch', p + 0.05);
    lids('g2', 0.75, p + 0.05, 0.08);
    to('#g2-brows', { y: -10 }, p + 0.05, 0.1);
    to('#g2-arm-r', { rotation: -8 }, p + 0.05, 0.14, 'power3.out');
    loop('#g2-arm-r', { rotation: -20 }, p + 0.3, 1.0, 0.1);
    pop('#s2-ouch', p + 0.05, 0.3);
    shake('#s2-cam', p, 8, 0.35);
    to('#s2-ouch', { opacity: 0 }, p + 1.5, 0.4);
    to('#z2-pin-l', { rotation: 0 }, p + 0.3, 0.2);
    // Zeca is ashamed and hides behind his claws.
    to('#z2-arm-l', { rotation: 46 }, p + 0.5, 0.3);
    to('#z2-arm-r', { rotation: -46 }, p + 0.5, 0.3);
    mouth('z2', 'sad', p + 0.5);
    set('#z2-blush', { opacity: 1 }, p + 0.5);
    to('#z2-eyes', { scaleY: 1 }, p + 0.5, 0.3);
    // Giulia forgives him and offers a slice of watermelon.
    const g = t + 3.2;
    lids('g2', 0, g, 0.25);
    to('#g2-brows', { y: 0 }, g, 0.3);
    mouth('g2', 'smile', g);
    to('#g2-head', { rotation: 8 }, g, 0.6);
    finger('g2', false, g + 0.4);
    to('#melon', { opacity: 1 }, g + 0.5, 0.2);
    to('#g2-arm-r', { rotation: -50 }, g + 0.9, 0.9);
    to('#melon', { x: 0, y: 0, rotation: 0 }, g + 0.9, 0.9, 'power1.inOut');
    to('#g2-arm-r', { rotation: 0 }, g + 2.0, 0.6);
    // Zeca peeks, then goes for the fruit.
    to('#z2-arm-l', { rotation: 0 }, t + 5.2, 0.35);
    look('z2', -10, 8, t + 5.2);
    mouth('z2', 'small', t + 5.4);
    to('#z2-arm-r', { rotation: 0 }, t + 5.7, 0.35);
    set('#z2-blush', { opacity: 0.6 }, t + 5.7);
    walk('z2', { x: -190 }, t + 6.1, 1.2);
    to('#z2-body', { rotation: -6 }, t + 6.1, 0.6);
    to('#z2-arm-l', { rotation: -28 }, t + 6.6, 0.5);
    loop('#z2-pin-l', { rotation: 26 }, t + 7.3, 1.0, 0.12);
    mouth('z2', 'grin', t + 7.4);
    // A heart for the new friendship.
    const h = t + 8.4;
    tl.fromTo(
      '.s2-heart',
      { scale: 0, opacity: 1, transformOrigin: '50% 50%' },
      { scale: 1, y: -60, duration: 0.6, ease: 'back.out(2)' },
      h,
    );
    to('.s2-heart', { opacity: 0, y: -140 }, h + 0.9, 0.6);
    mouth('g2', 'laugh', h);
    to('#z2-body', { rotation: 0 }, h, 0.3);
    to('#z2-arm-l', { rotation: 0 }, h, 0.3);
    hop('z2', h + 0.1, 30);
  }

  // ---- 3: sandcastle afternoon ----
  {
    const t = S[3];
    zoom(3, 1.04, 1);
    set('#tower', { scaleY: 0 }, t);
    set('#flag', { scale: 0 }, t);
    set('.s3-spark', { opacity: 0 }, t);
    set('#z3b', { y: 230 }, t);
    set('.grain', { opacity: 0 }, t);
    gsap.set('#bucket-in', { transformOrigin: '50% 50%' });
    girlIdle('g3', t, S[4], 0.6);
    crabIdle('z3', t, t + 2);
    crabIdle('z3b', t + 3.3, S[4], 1.2);
    look('g3', 8, 0, t);
    mouth('g3', 'smile', t);
    // Zeca digs a tunnel, sand flying.
    look('z3', 0, 8, t);
    mouth('z3', 'grin', t);
    loop('#z3-body', { rotation: 10 }, t + 0.3, 1.6, 0.1);
    loop('#z3-arm-l', { rotation: -30 }, t + 0.3, 1.6, 0.1);
    loop('#z3-arm-r', { rotation: 30 }, t + 0.3, 1.6, 0.1);
    $$('#s3-cam .grain').forEach((el, k) => {
      const dir = k % 2 ? 1 : -1;
      const reach = 60 + ((k * 37) % 120);
      tl.fromTo(
        el,
        { x: 0, y: 0, opacity: 1 },
        {
          keyframes: {
            x: [0, dir * reach * 0.6, dir * reach],
            y: [0, -140 - (k % 4) * 20, 30],
            opacity: [1, 1, 0],
          },
          duration: 0.55,
          ease: 'none',
          repeat: 2,
        },
        t + 0.3 + (k % 6) * 0.09,
      );
    });
    to('#z3', { y: 230 }, t + 1.7, 0.5, 'power2.in');
    // Giulia lifts the bucket: a new tower!
    finger('g3', false, t);
    to('#g3-arm-r', { rotation: -74 }, t + 0.2, 0.6);
    to('#g3-arm-r', { rotation: -150 }, t + 1.3, 0.7, 'power2.out');
    to('#bucket', { y: -136, x: -104 }, t + 1.3, 0.7, 'power2.out');
    to('#bucket-in', { rotation: 24 }, t + 1.3, 0.7);
    tl.to('#tower', { scaleY: 1, duration: 0.5, ease: 'back.out(2)' }, t + 1.6);
    $$('#s3-cam .s3-spark').forEach((el, k) => {
      tl.fromTo(
        el,
        { scale: 0, opacity: 1, transformOrigin: '50% 50%' },
        { scale: 1.2, rotation: 90, duration: 0.35, ease: 'back.out(2)' },
        t + 1.9 + k * 0.12,
      );
      to(el, { opacity: 0, scale: 0.4 }, t + 2.6 + k * 0.12, 0.3);
    });
    tl.to('#flag', { scale: 1, duration: 0.4, ease: 'back.out(3)' }, t + 2.4);
    loop('#flag', { rotation: 6 }, t + 2.8, 5.5, 0.4);
    loop('#g3-arm-r', { rotation: -140 }, t + 2.2, 1.2, 0.3);
    loop('#bucket', { x: -80, y: -146 }, t + 2.2, 1.2, 0.3);
    // Zeca pops out next to the castle.
    to('#z3b', { y: 0 }, t + 3.2, 0.45, 'back.out(1.8)');
    mouth('z3b', 'grin', t + 3.2);
    to('#z3b-arm-l', { rotation: 24 }, t + 3.5, 0.2);
    to('#z3b-arm-r', { rotation: -24 }, t + 3.5, 0.2);
    look('z3b', -8, 0, t + 3.5);
    look('g3', 10, 2, t + 3.4);
    mouth('g3', 'laugh', t + 3.6);
    loop('#g3-body', { y: -14 }, t + 3.7, 1.6, 0.2);
    loop('#bucket', { y: -150 }, t + 3.7, 1.6, 0.2);
    hop('z3b', t + 4.6, 50);
    hop('z3b', t + 5.1, 50);
    loop('#z3b-arm-l', { rotation: 6 }, t + 4.6, 2.4, 0.2);
    loop('#z3b-arm-r', { rotation: -6 }, t + 4.6, 2.4, 0.2);
    mouth('g3', 'smile', t + 6.2);
  }

  // ---- 4: bouncing on the bed ----
  {
    const t = S[4];
    zoom(4, 1, 1.05);
    girlIdle('g4', t, S[5], 1.1);
    blinks('z4', t, S[5], 2.6, 1.5);
    mouth('z4', 'grin', t);
    gsap.set('#z4', { transformOrigin: '50% 50%' });
    look('g4', 10, -6, t);
    mouth('g4', 'laugh', t + 0.4);
    for (let k = 0; k < 7; k++) {
      const b = t + 0.3 + k * 0.85;
      const flip = k === 3;
      tl.to('#z4', { y: -250, duration: 0.4, ease: 'power2.out' }, b);
      tl.to('#z4', { y: 0, duration: 0.4, ease: 'power2.in' }, b + 0.4);
      if (flip)
        tl.fromTo('#z4', { rotation: 0 }, { rotation: 360, duration: 0.8, ease: 'sine.inOut' }, b);
      tl.to(
        '#z4-body',
        { scaleY: 0.76, scaleX: 1.16, duration: 0.07, yoyo: true, repeat: 1, ease: 'power1.out' },
        b + 0.8,
      );
      tl.to('#bedtop', { scaleY: 0.95, duration: 0.08, yoyo: true, repeat: 1 }, b + 0.8);
      tl.to(
        ['#teddy-a', '#teddy-b'],
        { rotation: k % 2 ? 7 : -7, duration: 0.12, yoyo: true, repeat: 1 },
        b + 0.82,
      );
      to('#z4-arm-l', { rotation: k % 2 ? 0 : 20 }, b, 0.4);
      to('#z4-arm-r', { rotation: k % 2 ? 0 : -20 }, b, 0.4);
    }
    loop('#g4-arm-l', { rotation: -28 }, t + 0.5, 5.6, 0.16);
    loop('#g4-arm-r', { rotation: 28 }, t + 0.5, 5.6, 0.16);
    loop('#g4-body', { y: -10 }, t + 0.5, 5.6, 0.32);
    mouth('z4', 'smile', t + 6.4);
    mouth('g4', 'smile', t + 6.6);
    look('g4', 8, 0, t + 6.6);
  }

  // ---- 5: missing home at nightfall ----
  {
    const t = S[5];
    zoom(5, 1.06, 1);
    mouth('z5', 'sad', t);
    set('#z5 .lid', { scaleY: 0.42 }, t);
    look('z5', 7, -8, t);
    set('#z5-eyes', { scaleY: 0.92 }, t);
    set('#z5-blush', { opacity: 0.2 }, t);
    loop('#z5-eyes', { y: 3 }, t, 8, 1.6);
    tl.to(
      '#z5-body',
      { scaleY: 0.93, scaleX: 1.03, duration: 0.7, yoyo: true, repeat: 1 },
      t + 1.1,
    );
    for (const tt of [t + 2.0, t + 4.8]) {
      tl.fromTo(
        '#z5-tear',
        { opacity: 0, y: 0 },
        { keyframes: { opacity: [0, 1, 1, 0], y: [0, 10, 50, 70] }, duration: 1.6, ease: 'none' },
        tt,
      );
    }
    // Giulia walks in.
    set('#g5', { x: -900 }, t);
    mouth('g5', 'smile', t);
    to('#g5', { x: 450 }, t + 0.5, 2.6, 'sine.out');
    loop('#g5-leg-l', { rotation: 14 }, t + 0.5, 2.6, 0.3);
    loop('#g5-leg-r', { rotation: -14 }, t + 0.5, 2.6, 0.3);
    loop('#g5-body', { y: -10 }, t + 0.5, 2.6, 0.15);
    loop('#g5-arm-l', { rotation: -10 }, t + 0.5, 2.6, 0.3);
    girlIdle('g5', t + 3.2, S[6], 0.6);
    look('g5', 10, -4, t + 2.6);
    mouth('g5', 'sad', t + 3.0);
    to('#g5-head', { rotation: 9 }, t + 3.0, 0.6);
    to('#g5-arm-r', { rotation: -64 }, t + 5.0, 1.0);
    look('z5', -10, 2, t + 5.6, 0.5);
    lids('z5', 0.15, t + 5.8, 0.4);
    to('#z5-eyes', { scaleY: 1 }, t + 5.8, 0.4);
    mouth('z5', 'small', t + 6.6);
    set('#z5-blush', { opacity: 0.6 }, t + 6.6);
    mouth('g5', 'smile', t + 6.8);
    blinks('z5', t + 6.4, S[6], 2.4, 0.5);
  }

  // ---- 6: goodbye on the moonlit beach ----
  {
    const t = S[6];
    zoom(6, 1, 1.06);
    girlIdle('g6', t, S[7], 3);
    crabIdle('z6', t, t + 6);
    mouth('g6', 'smile', t);
    look('g6', 8, 2, t);
    look('z6', -9, -2, t);
    mouth('z6', 'small', t);
    set('.s6-spark', { opacity: 0 }, t);
    walk('z6', { x: -140 }, t + 0.3, 0.8);
    finger('g6', true, t + 0.9);
    to('#g6-arm-r', { rotation: -75 }, t + 0.9, 1.1);
    to('#z6-arm-l', { rotation: 12 }, t + 1.5, 0.6);
    // The touch.
    const k = t + 2.3;
    tl.fromTo(
      '#touchglow',
      { opacity: 0, scale: 0.2, transformOrigin: '50% 50%' },
      {
        keyframes: { opacity: [0, 1, 0.8, 0], scale: [0.2, 1.6, 2.2, 2.6] },
        duration: 1.6,
        ease: 'none',
      },
      k,
    );
    $$('#s6-cam .s6-spark').forEach((el, i) => {
      tl.fromTo(
        el,
        { scale: 0, opacity: 1, transformOrigin: '50% 50%' },
        { scale: 1.3, rotation: 120, y: -40, duration: 0.5, ease: 'back.out(2)' },
        k + 0.1 + i * 0.12,
      );
      to(el, { opacity: 0 }, k + 0.8 + i * 0.12, 0.4);
    });
    lids('g6', 0.6, k + 0.2, 0.3);
    lids('z6', 0.55, k + 0.2, 0.3);
    mouth('z6', 'smile', k + 0.2);
    lids('g6', 0, k + 1.6, 0.3);
    lids('z6', 0, k + 1.6, 0.3);
    tl.fromTo(
      '#g6-tear',
      { opacity: 0, y: 0 },
      { keyframes: { opacity: [0, 1, 1, 0], y: [0, 10, 46, 60] }, duration: 2.2, ease: 'none' },
      k + 1.6,
    );
    // Zeca waves and goes back to the sea.
    to('#z6-arm-l', { rotation: 0 }, k + 2.0, 0.4);
    loop('#z6-arm-r', { rotation: -26 }, k + 2.2, 1.4, 0.2);
    finger('g6', false, k + 2.4);
    to('#g6-arm-r', { rotation: -150 }, k + 2.4, 0.5);
    loop('#g6-arm-r', { rotation: -132 }, k + 3.0, 4.0, 0.3);
    gsap.set('#z6', { transformOrigin: '50% 100%' });
    walk('z6', { x: 120, y: -190, scale: 0.68 }, k + 3.6, 2.2);
    const w = k + 5.4;
    tl.fromTo(
      '#bigwave',
      { opacity: 0, y: 60, x: 80 },
      {
        keyframes: { opacity: [0, 1, 1, 0], y: [60, -10, 0, 40], x: [80, 0, -20, -60] },
        duration: 1.8,
        ease: 'none',
      },
      w,
    );
    to('#z6', { opacity: 0 }, w + 0.4, 0.4);
    mouth('g6', 'smile', w + 0.6);
  }

  // ---- 7: the family hug ----
  {
    const t = S[7];
    zoom(7, 1, 1.08);
    loop('#jelly-in', { y: -40, rotation: 6 }, t, 11, 1.8);
    set('.s7-heart', { opacity: 0 }, t);
    set('#z7', { y: -1000 }, t);
    mouth('z7', 'grin', t);
    look('z7', 6, 6, t);
    to('#z7', { y: 0 }, t + 0.2, 2.2, 'power2.out');
    scuttle('z7', t + 0.2, 2.2, 14, 0.12);
    crabIdle('z7', t + 2.4, TOTAL);
    crabIdle('m7', t, TOTAL, 1.2);
    crabIdle('d7', t, TOTAL, 2.0);
    look('m7', -8, -6, t + 0.6);
    look('d7', 8, -6, t + 0.6);
    to(['#m7-eyes', '#d7-eyes'], { scaleY: 1.3 }, t + 1.4, 0.2, 'back.out(3)');
    mouth('m7', 'open', t + 1.4);
    mouth('d7', 'open', t + 1.4);
    look('z7', 9, 0, t + 1.6);
    walk('m7', { x: -420 }, t + 2.0, 1.4);
    // d7 is drawn mirrored and at 1.08 scale, so its local x runs the other way.
    walk('d7', { x: 954 }, t + 2.0, 1.6);
    to(['#m7-eyes', '#d7-eyes'], { scaleY: 1 }, t + 3.4, 0.3);
    // Hug!
    const h = t + 3.6;
    for (const id of ['m7', 'd7', 'z7']) {
      mouth(id, 'grin', h);
      lids(id, 0.58, h, 0.3);
      set(`#${id}-blush`, { opacity: 1 }, h);
    }
    to('#m7-arm-l', { rotation: 46 }, h, 0.35);
    to('#d7-arm-l', { rotation: 46 }, h, 0.35);
    to('#z7-arm-l', { rotation: 24 }, h, 0.35);
    to('#z7-arm-r', { rotation: -24 }, h, 0.35);
    to('#m7', { x: -450 }, h, 0.4);
    to('#d7', { x: 926 }, h, 0.4);
    for (const id of ['m7', 'd7', 'z7'])
      tl.to(
        `#${id}-body`,
        { scaleX: 1.07, scaleY: 0.95, duration: 0.3, yoyo: true, repeat: 5, ease: 'sine.inOut' },
        h + 0.3,
      );
    $$('#s7-cam .s7-heart').forEach((el, i) => {
      tl.fromTo(
        el,
        { scale: 0, opacity: 1, y: 0, transformOrigin: '50% 50%' },
        {
          keyframes: { scale: [0, 1.1, 1], y: [0, -80, -200], opacity: [1, 1, 0] },
          duration: 2.4,
          ease: 'none',
          repeat: 1,
        },
        h + 0.4 + i * 0.5,
      );
    });
    hop('z7', h + 3.4, 34);
    hop('z7', h + 3.9, 34);
  }

  // ---- title, captions and end card ----
  tl.fromTo(
    '#title',
    { opacity: 0, scale: 0.6 },
    { opacity: 1, scale: 1, duration: 0.6, ease: 'back.out(1.8)' },
    0.25,
  );
  $$('#title .letter').forEach((el, i) =>
    tl.fromTo(
      el,
      { y: 0 },
      { y: -26, duration: 0.18, yoyo: true, repeat: 1, ease: 'sine.out' },
      0.9 + i * 0.06,
    ),
  );
  tl.to('#title', { opacity: 0, y: -40, duration: 0.4 }, 3.0);
  for (const cap of $$('.caption')) {
    const s = Number(cap.dataset.start);
    const d = Number(cap.dataset.duration);
    tl.fromTo(
      cap,
      { opacity: 0, y: -20 },
      { opacity: 1, y: 0, duration: 0.35, ease: 'power2.out' },
      s,
    );
    tl.to(cap, { opacity: 0, duration: 0.3 }, s + d - 0.3);
  }
  const end = Number(document.getElementById('end').dataset.start);
  tl.fromTo(
    '#end',
    { opacity: 0, scale: 0.5 },
    { opacity: 1, scale: 1, duration: 0.6, ease: 'back.out(2)' },
    end,
  );
  tl.to(
    '#end',
    { rotation: 3, duration: 0.5, yoyo: true, repeat: 3, ease: 'sine.inOut' },
    end + 0.6,
  );

  window.__timelines = window.__timelines || {};
  window.__timelines.main = tl;
  tl.seek(0);
})();
