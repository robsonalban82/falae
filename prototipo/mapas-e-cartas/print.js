// Print layouts for the PDFs. print.html?mapas (A4 landscape) or print.html?cartas (A4 portrait).
// Sets window.__PRINT_DONE__ when the layout is final and window.__PRINT_REPORT__ with checks.
(function () {
  'use strict';

  const D = window.FALAE_PROTO;
  const F = window.FALAE;
  const { icon, esc, rich, tagChip, renderNode, DOODLES, T } = F;
  const mode = /cartas/.test(location.search) ? 'cartas' : 'mapas';
  const doc = document.getElementById('doc');
  const MM = 96 / 25.4; // css px per mm
  const report = {
    mode,
    pages: 0,
    warnings: [],
    errors: [],
    maps: [],
    alignment: null,
    overflow: [],
  };
  window.__PRINT_REPORT__ = report;

  const pageCss = document.createElement('style');
  pageCss.textContent =
    mode === 'mapas'
      ? '@page { size: A4 landscape; margin: 0; }'
      : '@page { size: A4 portrait; margin: 0; }';
  document.head.appendChild(pageCss);
  document.title =
    mode === 'mapas' ? 'Falaê · Mapas mentais (A4)' : 'Falaê · Cartas para recortar (A4)';

  const collById = Object.fromEntries(D.collections.map((c) => [c.id, c]));

  function sheet(cls) {
    const el = document.createElement('section');
    el.className = `sheet ${cls}`;
    doc.appendChild(el);
    return el;
  }
  function footer(el, label, n) {
    el.insertAdjacentHTML(
      'beforeend',
      `<div class="pfoot"><span>${label}</span><span class="num">${n}</span></div>`,
    );
  }
  /** Ruled notebook paper as vector lines (w x h in mm). */
  function ruled(w, h) {
    let lines = '';
    for (let y = 14; y < h; y += 8) {
      lines += `<line x1="0" x2="${w}" y1="${y}" y2="${y}" />`;
    }
    return `<svg class="ruled" viewBox="0 0 ${w} ${h}" aria-hidden="true"><g stroke="#e8dcca" stroke-width="0.3">${lines}</g><line x1="18" x2="18" y1="0" y2="${h}" stroke="#e8a39c" stroke-width="0.5" /></svg>`;
  }
  const levelsOf = (items) => F.LEVELS.filter((l) => items.some((x) => x.level === l));
  const seals = (lv) => lv.map((l) => `<span class="seal">${l}</span>`).join('');

  // ------------------------------------------------------------------ maps
  const TAG_HELP = {
    regra: 'como se forma ou se usa',
    exemplo: 'frases-modelo para copiar',
    excecao: 'o que foge da regra',
    'erro-comum': 'erro típico de brasileiro: ✗ riscado → ✓ certo',
    vocabulario: 'palavras novas: inglês = português',
  };

  function buildMaps() {
    const maps = [
      ...D.maps.filter((m) => m.collection === 'mapas'),
      ...D.maps.filter((m) => m.collection !== 'mapas'),
    ];
    const cover = sheet('land cover-page');
    cover.innerHTML = `
      ${ruled(297, 210)}
      ${DOODLES.pencil}
      <p class="kicker">Falaê · apostila para imprimir</p>
      <h1><span class="marker">Mapas mentais<br />de inglês</span></h1>
      <p class="lead">${maps.length} mapas, um tema por mapa. Gramática, preposições, números e phrasal verbs, com exemplos, exceções e os erros mais comuns de quem fala português.</p>
      <div class="levels">${seals(levelsOf(maps))}</div>
      <div class="howto">
        <h2>Como estudar com os mapas</h2>
        <ol>
          <li>Comece pelo centro e leia um ramo de cada vez.</li>
          <li>Cubra os cartões com um papel e tente lembrar antes de olhar.</li>
          <li>Leia os exemplos em voz alta e escreva os seus em “Minhas anotações”.</li>
        </ol>
      </div>
      ${DOODLES.star}
      ${F.art('to-be-centro', 'art-cover')}
      <p class="brandmark">Falaê</p>`;
    const toc = sheet('land toc-page');

    let page = 3;
    const entries = [];
    for (const m of maps) {
      const n = layoutMap(m, page);
      entries.push({ m, page, last: page + n - 1 });
      page += n;
    }

    const groups = [...new Set(maps.map((m) => m.collection))].map((cid) => ({
      c: collById[cid],
      items: entries.filter((e) => e.m.collection === cid),
    }));
    toc.innerHTML = `
      <h1><span class="marker">Sumário</span></h1>
      ${groups
        .map(
          (g) =>
            `<h2>${icon(g.c.icon)}${esc(g.c.title)}</h2><ol class="toc">${g.items
              .map(
                (e) =>
                  `<li><span class="seal">${e.m.level}</span>${icon(e.m.icon || e.m.branches[0].icon, 'ticon')}<span class="t">${esc(e.m.title)}</span><span class="sub" lang="en">${esc(e.m.center.en.replace(/\.\.\./g, '…'))}</span><span class="dots"></span><span class="pg">${e.last > e.page ? `${e.page}–${e.last}` : e.page}</span></li>`,
              )
              .join('')}</ol>`,
        )
        .join('')}
      <div class="toc-legend">
        <span class="hand">tipos de cartão</span>
        <dl>${Object.keys(TAG_HELP)
          .map((t) => `<dt>${tagChip(t)}</dt><dd>${esc(TAG_HELP[t])}</dd>`)
          .join('')}</dl>
      </div>`;
    footer(toc, 'Falaê · Mapas mentais', 2);
  }

  const SCALES = [1, 0.95, 0.92, 0.89, 0.86];
  const HIGH = [1, 0.95]; // 10.5 and 10 pt: preferred
  const BASE_PT = 10.5;

  /**
   * Lays out one map; returns how many pages it used. The map tries 1 page at >= 10 pt, then
   * its branches over 2 pages at >= 10 pt, and only then smaller type (down to 9 pt).
   * The quick test always gets the next page of its own.
   */
  function layoutMap(m, pageNo) {
    const n = m.branches.length;
    const attempt = (branches, page, opts) => {
      const ok = tryMapPage(m, branches, page, opts);
      if (!ok) doc.lastElementChild.remove();
      return ok;
    };
    let used = 0;
    if (m.figureStyle === 'art') {
      // illustrated: 1 page with scenes of 24 -> 20 mm; otherwise 2 balanced pages with
      // bigger scenes and (if room) slightly bigger type, never a half-empty page
      for (const artMm of [24, 22, 20]) {
        if (attempt(m.branches, pageNo, { scales: HIGH, art: artMm })) return finish(1);
      }
      // 2 pages: same type size and scene size on both; search every split and keep the one
      // whose emptier page is fullest (ties: bigger type)
      let best = null;
      for (const artMm of [28, 26, 24]) {
        for (const sc of [1.1, 1.05, 1, 0.95]) {
          for (let k = 1; k < n; k++) {
            // each page: cards in two sub-columns or in one; keep the fuller variant that fits
            const page = (branches, pg, suffix) => {
              let pick = null;
              const variants = [
                { oneCol: false, art: artMm },
                { oneCol: true, art: artMm },
                { oneCol: true, art: artMm + 6 },
              ];
              for (const v of variants) {
                const o = { scales: [sc], fill: true, trial: true, suffix, ...v };
                if (!attempt(branches, pg, o)) continue;
                const f = report.lastFill;
                doc.lastElementChild.remove();
                if (!pick || f > pick.f) pick = { f, ...v };
              }
              return pick;
            };
            const p1 = page(m.branches.slice(0, k), pageNo, ' (1/2)');
            if (!p1) continue;
            const p2 = page(m.branches.slice(k), pageNo + 1, ' (2/2)');
            if (!p2) continue;
            const score = Math.min(p1.f, p2.f) + sc * 0.02;
            if (!best || score > best.score) best = { k, sc, score, p1, p2 };
          }
        }
      }
      if (best) {
        const opts = { scales: [best.sc], fill: true };
        const v1 = { oneCol: best.p1.oneCol, art: best.p1.art };
        const v2 = { oneCol: best.p2.oneCol, art: best.p2.art };
        tryMapPage(m, m.branches.slice(0, best.k), pageNo, { ...opts, ...v1, suffix: ' (1/2)' });
        tryMapPage(m, m.branches.slice(best.k), pageNo + 1, { ...opts, ...v2, suffix: ' (2/2)' });
        return finish(2);
      }
      report.errors.push(`mapa "${m.id}" (ilustrado) não coube nem em 2 páginas a 10 pt`);
      return finish(0);
    }
    function finish(pages) {
      if (m.exercise) quizPage(m, pageNo + pages);
      return pages + (m.exercise ? 1 : 0);
    }
    if (attempt(m.branches, pageNo, { scales: HIGH })) used = 1;
    // balanced split first (half the branches on each page), then less balanced ones
    const ks = [...Array(n - 1).keys()]
      .map((i) => i + 1)
      .sort((a, b) => Math.abs(a - n / 2) - Math.abs(b - n / 2) || b - a);
    for (const k of ks) {
      if (used) break;
      if (!attempt(m.branches.slice(0, k), pageNo, { suffix: ' (1/2)', scales: HIGH })) continue;
      if (attempt(m.branches.slice(k), pageNo + 1, { suffix: ' (2/2)', scales: HIGH })) used = 2;
      else doc.lastElementChild.remove();
    }
    if (!used && attempt(m.branches, pageNo, { scales: SCALES })) used = 1;
    if (!used) {
      const k = Math.ceil(n / 2);
      tryMapPage(m, m.branches.slice(0, k), pageNo, {
        suffix: ' (1/2)',
        scales: SCALES,
        force: true,
      });
      tryMapPage(m, m.branches.slice(k), pageNo + 1, {
        suffix: ' (2/2)',
        scales: SCALES,
        force: true,
      });
      used = 2;
    }
    if (m.exercise) {
      quizPage(m, pageNo + used);
      used += 1;
    }
    return used;
  }

  /** Quick test for paper: blanks with a writing line; the hint stays glued to its item. */
  function pquizHtml(ex) {
    const items = ex.items
      .map((it) => {
        const [before, after] = it.prompt.split('___');
        const letters = F.mainAnswer(it.answer).length;
        const w = Math.max(22, letters * 3 + 6);
        return `<li><span lang="en">${esc(before)}</span><span class="blank" style="width:${w}mm"></span><span lang="en">${esc(after)}</span>${it.hintPt ? ` <span class="pq-hint">${esc(/^\(.*\)$/.test(it.hintPt.trim()) ? it.hintPt.trim() : `(${it.hintPt.trim()})`)}</span>` : ''}</li>`;
      })
      .join('');
    return `<h2 class="pq-h">${icon('pencil')}${T.quizTitle}</h2><p class="pq-ins">${esc(ex.instruction)}</p><ol>${items}</ol>`;
  }

  /** Answer key, upside down, inside the test box. */
  function answersHtml(ex) {
    const list = ex.items
      .map(
        (it, i) =>
          `<span class="nw">${i + 1}. <span lang="en">${esc(F.mainAnswer(it.answer))}</span></span>`,
      )
      .join(' · ');
    return `<p class="answers"><b>${T.quizAnswersPrint}:</b> ${list}</p>`;
  }

  /** Page right after the map: the quick test, large, plus "write your own sentences". */
  function quizPage(m, pageNo) {
    const el = sheet('land quiz-page');
    const coll = collById[m.collection];
    el.innerHTML = `
      <header class="mhead">
        <h1><span class="marker">${esc(m.title)}</span></h1>
        <span class="hand mkicker">${icon('pencil')}${T.quizTitle.toLowerCase()} · nível ${m.level}</span>
      </header>
      <div class="qgrid">
        <section class="pquiz">${pquizHtml(m.exercise)}${answersHtml(m.exercise)}</section>
        <section class="own">
          <h2 class="pq-h">${icon('chat')}${T.ownTitle}</h2>
          <p class="pq-ins">${T.ownHint}</p>
          <ol class="own-lines"><li><span class="rule"></span><span class="rule"></span></li><li><span class="rule"></span><span class="rule"></span></li></ol>
          <div class="notes"><span class="hand">Minhas anotações</span></div>
        </section>
      </div>`;
    footer(el, `Falaê · ${esc(coll ? coll.title : '')}`, pageNo);
    ruleNotes(el.querySelector('.notes'));
    // the key must fit inside the box
    const box = el.querySelector('.pquiz').getBoundingClientRect();
    const key = el.querySelector('.answers').getBoundingClientRect();
    const ol = el.querySelector('.pquiz ol').getBoundingClientRect();
    if (key.left < box.left || key.bottom > box.bottom + 0.5 || key.top < ol.bottom) {
      report.errors.push(`teste de "${m.id}": a chave de respostas não cabe no quadro`);
    }
    checkMargins(el, m.id + ' (teste)');
  }

  function tryMapPage(m, branches, pageNo, opts) {
    const suffix = opts.suffix || '';
    const scales = opts.scales || SCALES;
    const force = !!opts.force;
    const el = sheet(`land map-page${m.figureStyle === 'art' ? ' is-art' : ''}`);
    if (opts.art) el.style.setProperty('--art', `${opts.art}mm`);
    const coll = collById[m.collection];
    const cfig = suffix.includes('2/2')
      ? ''
      : m.centerArt
        ? F.art(m.centerArt, 'art-center')
        : m.centerFigure
          ? F.figure(m.centerFigure, 'fig-center')
          : '';
    el.innerHTML = `
      <header class="mhead">
        <h1><span class="marker">${esc(m.title)}${suffix}</span></h1>
        <span class="hand mkicker">${icon(m.icon || m.branches[0].icon)}mapa mental · nível ${m.level}</span>
        <div class="chips">${F.legend()}</div>
      </header>
      <div class="mgrid">
        <svg class="mlinks" aria-hidden="true"></svg>
        <div class="mcol mleft"></div>
        <div class="mmid">
          <p class="start">${suffix.includes('2/2') ? 'continuação' : 'comece por aqui'}</p>
          <p class="center-node">${cfig}<span class="en" lang="en">${F.centerText(m.center.en)}</span><span class="pt">${esc(m.center.pt)}</span></p>
          ${m.doodle ? `<p class="note">${icon('bulb')}${esc(m.doodle)}</p>` : DOODLES.star}
          ${m.intro && !suffix.includes('2/2') ? `<p class="intro">${rich(m.intro)}</p>` : ''}
        </div>
        <div class="mcol mright"></div>
      </div>
`;
    footer(el, `Falaê · ${esc(coll ? coll.title : '')}`, pageNo);
    // the center label shrinks until it fits its column (clear of the connectors)
    const cen = el.querySelector('.mmid .center-node');
    const cenEn = cen.querySelector('.en');
    // measure the real glyph boxes (overflow:hidden would hide a cut letter, e.g. "friend|s")
    const fitsCenter = () => {
      const box = cen.getBoundingClientRect();
      const cs = getComputedStyle(cen);
      const left = box.left + parseFloat(cs.paddingLeft) - 0.5;
      const right = box.right - parseFloat(cs.paddingRight) + 0.5;
      const range = document.createRange();
      range.selectNodeContents(cenEn);
      return [...range.getClientRects()].every((r) => r.left >= left && r.right <= right);
    };
    for (let pt = 24; pt >= 12; pt -= 0.5) {
      el.style.setProperty('--cfs', `${pt}pt`);
      if (fitsCenter()) break;
    }
    if (!fitsCenter()) report.errors.push(`mapa "${m.id}": o título do centro não cabe no nó`);
    const grid = el.querySelector('.mgrid');
    const L = el.querySelector('.mleft');
    const R = el.querySelector('.mright');

    const nodesHtml = branches.map((b) => {
      const cards = b.nodes
        .map((n) => `<div class="node">${renderNode(n, { compact: true })}</div>`)
        .join('');
      // in 2-page illustrated maps, short branches get full-width cards (room for scenes)
      const one = b.nodes.length === 1 || opts.oneCol || (opts.fill && b.nodes.length <= 2);
      return `<section class="pbranch c-${b.color}"><h2 class="pribbon">${icon(b.icon)}<span>${esc(b.label)}</span>${b.figure ? F.figure(b.figure, 'fig-branch') : ''}</h2><div class="pcards${one ? ' one' : ''}"><div class="pcol">${cards}</div><div class="pcol"></div></div></section>`;
    });

    let chosen = null;
    let usedScale = null;
    for (const s of scales) {
      el.style.setProperty('--fs', `${(BASE_PT * s).toFixed(2)}pt`);
      L.innerHTML = nodesHtml.join('');
      R.innerHTML = '';
      // masonry inside each branch: cards in two sub-columns, order kept per column
      F.settleArt(L);
      L.querySelectorAll('.pcards:not(.one)').forEach(packCards);
      const gap = parseFloat(getComputedStyle(L).rowGap) || 0;
      const hs = [...L.children].map((c) => c.getBoundingClientRect().height);
      const avail = grid.getBoundingClientRect().height;
      const best = bestSplit(hs, gap, true);
      if (best.max <= avail + 0.5) {
        chosen = best;
        usedScale = s;
        break;
      }
      if (s === scales[scales.length - 1]) {
        chosen = best;
        usedScale = s;
        report.lastOver = best.max - avail;
        if (!force) return false;
        report.warnings.push(`mapa "${m.id}"${suffix}: conteúdo maior que a página`);
      }
    }

    // place branches
    const els = [...L.children];
    L.innerHTML = '';
    chosen.left.forEach((i) => L.appendChild(els[i]));
    chosen.right.forEach((i) => R.appendChild(els[i]));

    // how full the page is: average of both columns (used to balance 2-page maps)
    {
      const colH = (col) =>
        [...col.children].reduce((acc, c) => acc + c.getBoundingClientRect().height, 0);
      report.lastFill = (colH(L) + colH(R)) / (2 * grid.getBoundingClientRect().height);
    }
    // "Minhas anotações" in the leftover space
    for (const col of [L, R]) {
      const used = [...col.children].reduce((s, c) => s + c.getBoundingClientRect().height, 0);
      const free = col.getBoundingClientRect().height - used;
      // a small notes box only when little room is left (2-page illustrated maps)
      if (free >= 26 * MM) {
        col.insertAdjacentHTML(
          'beforeend',
          '<div class="notes"><span class="hand">Minhas anotações</span></div>',
        );
        // 2-page illustrated maps: a modest box, never a giant one
        if (opts.fill)
          col.lastElementChild.style.cssText = `flex:none;height:${Math.min(free - 3 * MM, 60 * MM)}px`;
        ruleNotes(col.lastElementChild);
      }
    }
    drawLinks(grid);
    const pt = BASE_PT * usedScale;
    // small type: darker translations so they stay legible on paper
    el.classList.toggle('small-type', pt < 9.95);
    if (opts.trial) return true;
    report.maps.push({ id: m.id + suffix, page: pageNo, fontPt: Number(pt.toFixed(2)) });
    if (pt < 9.95) report.warnings.push(`mapa "${m.id}"${suffix}: texto em ${pt.toFixed(1)}pt`);
    checkOverflow(el, m.id + suffix);
    checkMargins(el, m.id + suffix);
    return true;
  }

  /** Real ruled lines (gradients rasterize unevenly in PDFs). */
  function ruleNotes(box) {
    const h = box.getBoundingClientRect().height;
    const n = Math.floor((h - 9 * MM) / (7 * MM));
    box.insertAdjacentHTML('beforeend', '<span class="rule"></span>'.repeat(Math.max(0, n)));
  }

  /** Splits the cards of one branch over its two sub-columns (shortest tallest column). */
  function packCards(pcards) {
    const [a, b] = pcards.querySelectorAll('.pcol');
    const nodes = [...a.children];
    const gap = parseFloat(getComputedStyle(a).rowGap) || 0;
    const hs = nodes.map((n) => n.getBoundingClientRect().height);
    const best = bestSplit(hs, gap, false);
    best.right.forEach((i) => b.appendChild(nodes[i]));
  }

  /** Order-preserving 2-column split minimising the tallest column. */
  function bestSplit(hs, gap, alternate) {
    const n = hs.length;
    let best = null;
    for (let mask = 0; mask < 1 << n; mask++) {
      if (n > 1 && (mask === 0 || mask === (1 << n) - 1)) continue;
      if (mask & 1) continue; // item 1 always on the left (reading starts there)
      if (n > 12 && mask !== 0) break; // too many to try: keep one column
      const left = [];
      const right = [];
      for (let i = 0; i < n; i++) (mask >> i) & 1 ? right.push(i) : left.push(i);
      const h = (ids) => ids.reduce((s, i) => s + hs[i], 0) + Math.max(0, ids.length - 1) * gap;
      const max = Math.max(h(left), h(right));
      // ties: branches prefer balanced counts; cards prefer reading order (first ones left)
      const order = right.length ? right[0] : n;
      const score = alternate ? max + Math.abs(left.length - right.length) * 2 : max - order * 0.01;
      if (!best || score < best.score) best = { left, right, max, score };
    }
    return best;
  }

  function drawLinks(grid) {
    const svg = grid.querySelector('.mlinks');
    const g = grid.getBoundingClientRect();
    const node = grid.querySelector('.center-node').getBoundingClientRect();
    svg.setAttribute('viewBox', `0 0 ${g.width} ${g.height}`);
    const paths = [];
    for (const side of ['mleft', 'mright']) {
      const ribs = [...grid.querySelectorAll(`.${side} .pribbon`)];
      ribs.forEach((rib, i) => {
        const r = rib.getBoundingClientRect();
        const left = side === 'mleft';
        const spread = ribs.length > 1 ? (i / (ribs.length - 1) - 0.5) * node.height * 0.5 : 0;
        const sx = (left ? node.left : node.right) - g.left;
        const sy = node.top + node.height / 2 + spread - g.top;
        const ex = (left ? r.right - 3 : r.left + 3) - g.left;
        const ey = r.top + r.height / 2 - g.top;
        const dx = (ex - sx) * 0.55;
        const color = getComputedStyle(rib).getPropertyValue('--c-stroke').trim();
        paths.push(
          `<path d="M${sx} ${sy} C ${sx + dx} ${sy}, ${ex - dx} ${ey}, ${ex} ${ey}" fill="none" stroke="${color}" stroke-width="2.6" stroke-linecap="round"/>`,
        );
      });
    }
    svg.innerHTML = paths.join('');
  }

  /** Nothing printed closer than 8 mm to the sheet edge (printers clip there). */
  function checkMargins(el, id) {
    const box = el.getBoundingClientRect();
    const lim = 8 * MM - 0.5;
    el.querySelectorAll(
      '.mhead > *, .pfoot > *, .answers, .pquiz, .own, .mcol > *, .mmid > *',
    ).forEach((n) => {
      const r = n.getBoundingClientRect();
      if (!r.width) return;
      if (
        r.left - box.left < lim ||
        box.right - r.right < lim ||
        r.top - box.top < lim ||
        box.bottom - r.bottom < lim
      ) {
        report.errors.push(
          `${id}: elemento a menos de 8 mm da borda (${n.className || n.tagName})`,
        );
      }
    });
  }

  function checkOverflow(el, id) {
    const box = el.getBoundingClientRect();
    el.querySelectorAll('.node, .pribbon, .mmid > *').forEach((n) => {
      const r = n.getBoundingClientRect();
      if (r.bottom > box.bottom - 8 * MM + 1 || r.right > box.right - 9 * MM + 1) {
        report.warnings.push(`mapa "${id}": elemento passa da margem`);
      }
    });
  }

  // ------------------------------------------------------------------ cards
  const CELL_W = 95;
  const CELL_H = 67;
  const GRID_X = 10;
  const GRID_Y = 16;
  const COLOR_OF = Object.fromEntries(D.collections.map((c) => [c.id, c.color]));

  function cardFront(d, c) {
    const bv = c.baseVerb
      ? `<p class="bv">verbo base: <b lang="en">${esc(c.baseVerb)}</b></p>`
      : '';
    return `<div class="pcard front"><div class="ptop"><span class="seal">${c.level}</span><span>${esc(collById[d.collection].title)}</span></div><div class="pmain"><span class="pic" aria-hidden="true">${esc(c.emoji)}</span><p class="phrase" lang="en">${esc(c.en)}</p>${bv}</div><span class="brand">Falaê</span></div>`;
  }

  function cardBack(d, c) {
    const f = [];
    if (c.example) {
      f.push(
        `<p class="f"><span class="fl">${icon('chat')}${T.example}</span><span class="ex-en" lang="en">${esc(c.example.en)}</span><br /><span class="ex-pt">${esc(c.example.pt)}</span></p>`,
      );
    }
    if (c.pronunciation) {
      f.push(
        `<p class="f"><span class="fl">${icon('speaker')}${T.pronunciation}</span><span class="pron">${esc(c.pronunciation)}</span></p>`,
      );
    }
    if (c.situation) {
      f.push(
        `<p class="f"><span class="fl">${icon('pin')}${T.situation}</span>${esc(c.situation)}</p>`,
      );
    }
    if (c.dontUse) {
      f.push(
        `<p class="pbox c-manga"><span class="fl">${icon('ban')}${T.dontUse}</span>${esc(c.dontUse)}</p>`,
      );
    }
    if (c.falseFriend) {
      const txt = typeof c.falseFriend === 'string' ? c.falseFriend : T.falseFriendDefault;
      f.push(
        `<p class="pbox c-acerola"><span class="fl">${icon('warn')}${T.falseFriend}</span>${esc(txt)}</p>`,
      );
    }
    const formal = c.formality
      ? `<span class="formal formal-${c.formality}">${esc(T.formality[c.formality])}</span>`
      : '';
    return `<div class="pcard back"><div class="pmain"><div class="ans"><span class="emo" aria-hidden="true">${esc(c.emoji)}</span><div class="ans-t"><p class="big">${esc(c.pt)}</p><p class="small" lang="en">${esc(c.en)}</p></div><div class="ans-m"><span class="seal">${c.level}</span>${formal}</div></div>${f.join('')}</div></div>`;
  }

  function cutLines(n) {
    const lines = [];
    for (let i = 0; i < n; i++) {
      const r = Math.floor(i / 2);
      const c = i % 2;
      lines.push(
        `<rect x="${GRID_X + c * CELL_W}" y="${GRID_Y + r * CELL_H}" width="${CELL_W}" height="${CELL_H}" fill="none" stroke="#8c7c66" stroke-width="0.3" stroke-dasharray="2.2 1.6"/>`,
      );
    }
    // scissors hint on the first line
    return `<svg class="cutlines" viewBox="0 0 210 297" aria-hidden="true">${lines.join('')}<g transform="translate(${GRID_X + 2} ${GRID_Y - 2.6}) scale(0.16)" fill="none" stroke="#5b5a6e" stroke-width="2.2" stroke-linecap="round"><circle cx="5" cy="5" r="4"/><circle cx="5" cy="27" r="4"/><path d="M8.5 7.5 30 24M8.5 24.5 30 8"/></g></svg>`;
  }

  function buildCards() {
    const decks = D.decks;
    const all = decks.flatMap((d) => d.cards);
    const cover = sheet('port cover-page');
    cover.innerHTML = `
      ${ruled(210, 297)}
      ${DOODLES.pencil}
      <p class="kicker">Falaê · para recortar</p>
      <h1><span class="marker">Cartas de inglês</span></h1>
      <p class="lead">${all.length} cartas em ${decks.length} baralhos. Na frente, a figura e o inglês; no verso, a tradução, um exemplo, a pronúncia e quando usar.</p>
      <div class="levels">${seals(levelsOf(all))}</div>
      <div class="howto">
        <h2>Como imprimir</h2>
        <ol>
          <li>Papel A4, <b>frente e verso</b>, virando pela <b>borda longa</b> (o padrão da maioria das impressoras).</li>
          <li>Tamanho real (100%). Desligue “ajustar à página”.</li>
          <li>Recorte nas linhas tracejadas: cada carta tem 9,5 × 6,7 cm.</li>
          <li>Papel mais grosso (120–180 g) deixa as cartas firmes.</li>
        </ol>
      </div>
      <p class="brandmark">Falaê</p>`;
    const toc = sheet('port toc-page');
    let page = 3;
    const entries = [];
    let alignErr = 0;
    let checked = 0;
    for (const d of decks) {
      const first = page;
      const color = COLOR_OF[d.collection];
      const sheets = Math.ceil(d.cards.length / 8);
      for (let s = 0; s < sheets; s++) {
        const chunk = d.cards.slice(s * 8, s * 8 + 8);
        const label = `${esc(d.title)}`;
        const front = sheet(`port cards-page c-${color}`);
        const back = sheet(`port cards-page c-${color}`);
        const head = (side, ico) =>
          `<div class="chead"><strong>${label}</strong><span>folha ${s + 1} de ${sheets}</span><span class="side">${icon(ico)}${side}</span></div>`;
        front.innerHTML = head('frente', 'eye') + cutLines(chunk.length);
        back.innerHTML = head('verso (imprima atrás da frente)', 'flip');
        chunk.forEach((c, i) => {
          const r = Math.floor(i / 2);
          const col = i % 2;
          const y = GRID_Y + r * CELL_H;
          front.insertAdjacentHTML(
            'beforeend',
            `<div class="cell" data-card="${esc(c.id)}" style="left:${GRID_X + col * CELL_W}mm;top:${y}mm">${cardFront(d, c)}</div>`,
          );
          // long-edge duplex: the back is mirrored left/right
          back.insertAdjacentHTML(
            'beforeend',
            `<div class="cell" data-card="${esc(c.id)}" style="left:${GRID_X + (1 - col) * CELL_W}mm;top:${y}mm">${cardBack(d, c)}</div>`,
          );
        });
        footer(front, `Falaê · ${esc(collById[d.collection].title)}`, page);
        footer(back, `Falaê · ${esc(collById[d.collection].title)}`, page + 1);
        fitCards(front, back);
        // alignment check: back cell must be the mirror image of the front cell
        const fb = front.getBoundingClientRect();
        const bb = back.getBoundingClientRect();
        front.querySelectorAll('.cell').forEach((fc) => {
          const bc = back.querySelector(`.cell[data-card="${CSS.escape(fc.dataset.card)}"]`);
          const a = fc.getBoundingClientRect();
          const b = bc.getBoundingClientRect();
          const mirroredLeft = fb.width - (a.right - fb.left);
          alignErr = Math.max(
            alignErr,
            Math.abs(b.left - bb.left - mirroredLeft),
            Math.abs(b.top - bb.top - (a.top - fb.top)),
            Math.abs(b.width - a.width),
            Math.abs(b.height - a.height),
          );
          checked++;
        });
        page += 2;
      }
      entries.push({ d, first, last: page - 1 });
    }
    report.alignment = { cardsChecked: checked, maxErrorMm: Number((alignErr / MM).toFixed(3)) };

    toc.innerHTML = `
      <h1><span class="marker">Sumário</span></h1>
      <ol class="toc">${entries
        .map(
          (e) =>
            `<li><span class="seal">${e.d.level}</span><span class="t">${esc(e.d.title)}</span><span class="sub">${collById[e.d.collection].title === e.d.title ? '' : `${esc(collById[e.d.collection].title)} · `}${T.cardsCount(e.d.cards.length)}</span><span class="dots"></span><span class="pg">${e.first}–${e.last}</span></li>`,
        )
        .join('')}</ol>
      <div class="toc-legend">
        <span class="hand">no verso de cada carta</span>
        <dl>
          <dt><span class="formal formal-neutro">neutro</span></dt><dd>serve para qualquer situação</dd>
          <dt><span class="formal formal-informal">informal</span></dt><dd>amigos, família, mensagens</dd>
          <dt><span class="formal formal-giria">gíria</span></dt><dd>bem coloquial; evite no trabalho</dd>
          <dt><span class="fl">${icon('ban')} ${T.dontUse}</span></dt><dd>situações em que a frase soa estranha</dd>
          <dt><span class="fl">${icon('warn')} ${T.falseFriend}</span></dt><dd>parece português, mas quer dizer outra coisa</dd>
        </dl>
      </div>
      <p class="toc-tip">Páginas ímpares: frente. Páginas pares: verso, já espelhado para impressão frente e verso.</p>`;
    footer(toc, 'Falaê · Cartas', 2);
  }

  /**
   * Front: the English phrase may shrink (16 → 10 pt). Back: fixed 10.5 pt body, never
   * shrinks; if it does not fit, the card is reported so the author can shorten it.
   */
  function fitCards(...pages) {
    for (const p of pages) {
      p.querySelectorAll('.pcard').forEach((card) => {
        const main = card.querySelector('.pmain');
        const front = card.classList.contains('front');
        const id = card.closest('.cell').dataset.card;
        const fits = () =>
          main.scrollHeight <= main.clientHeight + 0.5 &&
          main.scrollWidth <= main.clientWidth + 0.5;
        if (front) {
          let size = 16;
          card.style.setProperty('--pfs', `${size}pt`);
          while (!fits() && size > 10) {
            size -= 0.25;
            card.style.setProperty('--pfs', `${size}pt`);
          }
        }
        if (!fits()) {
          const over = Math.round(((main.scrollHeight - main.clientHeight) / MM) * 10) / 10;
          report.overflow.push({ id, side: front ? 'frente' : 'verso', mm: over });
          card.classList.add('is-overflowing');
        }
      });
    }
  }

  // ------------------------------------------------------------------ go
  const faces = [
    '600 12pt Fredoka',
    '700 12pt Fredoka',
    '400 12pt "Atkinson Hyperlegible"',
    '700 12pt "Atkinson Hyperlegible"',
    '400 12pt "Patrick Hand"',
  ];
  // Warm up every glyph (incl. color emoji, a system font) so measurements are final.
  const warm = document.createElement('div');
  warm.setAttribute('aria-hidden', 'true');
  warm.style.cssText = 'position:absolute;left:-9999px;top:0;font-family:var(--font-emoji)';
  warm.textContent = [
    ...D.decks.flatMap((d) => d.cards.map((c) => c.emoji)),
    ...D.maps.flatMap((m) => [
      m.centerFigure || '',
      ...m.branches.flatMap((b) =>
        b.nodes.flatMap((nd) => [nd.figure || '', ...nd.lines.map((l) => l.emoji || '')]),
      ),
    ]),
  ].join(' ');
  document.body.appendChild(warm);
  const frame = () => new Promise((r) => requestAnimationFrame(() => r()));
  Promise.all(faces.map((f) => document.fonts.load(f)))
    .catch(() => {})
    .then(() => document.fonts.ready)
    .then(frame)
    .then(frame)
    .then(() => {
      warm.remove();
      if (mode === 'mapas') buildMaps();
      else buildCards();
      report.pages = doc.children.length;
      window.__PRINT_DONE__ = true;
    });
})();
