// Falaê — Mapas & Cartas (prototype app). Vanilla JS, hash routes, works from file://.
(function () {
  'use strict';

  const DATA = window.FALAE_PROTO;
  const { T, icon, esc, rich, plain, renderNode, legend, DOODLES, centerText, figure } =
    window.FALAE;
  const main = document.getElementById('main');
  const topbar = document.getElementById('topbar');
  const live = document.getElementById('live');
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

  const COLOR_OF = Object.fromEntries(DATA.collections.map((c) => [c.id, c.color]));
  const mapById = Object.fromEntries(DATA.maps.map((m) => [m.id, m]));
  const deckById = Object.fromEntries(DATA.decks.map((d) => [d.id, d]));
  const collById = Object.fromEntries(DATA.collections.map((c) => [c.id, c]));
  const mapIcon = (m) => m.icon || m.branches[0].icon;

  function announce(msg) {
    live.textContent = '';
    // next frame so repeated messages are read again
    requestAnimationFrame(() => {
      live.textContent = msg;
    });
  }

  // ---------------------------------------------------------------- speech
  const speech = {
    supported: 'speechSynthesis' in window && 'SpeechSynthesisUtterance' in window,
    voice: null,
    current: null,
  };
  const PREFERRED = ['Samantha', 'Google US English', 'Microsoft Aria', 'Microsoft Jenny', 'Alex'];

  function pickVoice() {
    const all = window.speechSynthesis.getVoices();
    const us = all.filter((v) => /^en[-_]US$/i.test(v.lang));
    if (us.length === 0) return null;
    for (const name of PREFERRED) {
      const v = us.find((x) => x.name.includes(name));
      if (v) return v;
    }
    return us.find((v) => v.localService) || us[0];
  }

  if (speech.supported) {
    speech.voice = pickVoice();
    window.speechSynthesis.addEventListener('voiceschanged', () => {
      const had = !!speech.voice;
      speech.voice = pickVoice();
      if (!had && speech.voice) route(true); // voices arrived late: show the speak buttons
    });
  }

  function canSpeak() {
    return speech.supported && !!speech.voice;
  }

  function say(text, btn) {
    if (!canSpeak()) return;
    const synth = window.speechSynthesis;
    synth.cancel();
    if (speech.current) speech.current.classList.remove('is-speaking');
    const u = new SpeechSynthesisUtterance(plain(text));
    u.voice = speech.voice;
    u.lang = 'en-US';
    u.rate = 0.9;
    if (btn) {
      btn.classList.add('is-speaking');
      speech.current = btn;
      const done = () => btn.classList.remove('is-speaking');
      u.onend = done;
      u.onerror = done;
    }
    synth.speak(u);
  }

  /** English phrase: a speak button when a voice exists, plain text otherwise. */
  function speakHtml(text, kind) {
    const cls = kind === 'right' ? ' en-right' : '';
    const keep = window.FALAE.keep;
    if (!canSpeak()) return `<span lang="en" class="en${cls}">${keep(text)}</span>`;
    // the speaker icon is glued to the last word (no line break between them)
    return `<button type="button" class="say${cls}" data-say="${esc(plain(text))}" aria-label="${esc(T.listenAria(plain(text)))}"><span lang="en">${gluedIcon(
      keep(text),
    )}</span></button>`;
  }

  /** Puts the speaker icon inside the last unbreakable block, so it never sits alone. */
  function gluedIcon(html) {
    const ico = `<span class="say-ico">${icon('speaker')}</span>`;
    if (html.endsWith('</span>') && html.lastIndexOf('<span class="nwb">') !== -1) {
      return `${html.slice(0, -7)}${ico}</span>`;
    }
    return `${html}<span class="nwb">\u2060${ico}</span>`;
  }

  /** In maps every English chunk can be covered by its own post-it ("Esconder o inglês"). */
  function mapSpeakHtml(text, kind) {
    return `<span class="chunk">${speakHtml(text, kind)}<button type="button" class="peek" hidden aria-label="${T.peekAria}">${icon('eye')}</button></span>`;
  }

  // ---------------------------------------------------------------- shell
  function setTopbar(backHref, crumb) {
    const backBtn = backHref
      ? `<a class="btn btn-ghost" href="${backHref}" aria-label="${T.back}">${icon('back')}</a>`
      : '';
    const title = crumb
      ? `<span class="crumb">${esc(crumb)}</span>`
      : `<a class="brand" href="#/">Falaê<span class="sr"> — ${T.home}</span></a>`;
    topbar.innerHTML = `<div class="topbar-in">${backBtn}${title}</div>`;
  }

  let firstRender = true;
  function focusHeading() {
    if (firstRender) {
      firstRender = false;
      return;
    }
    const h = main.querySelector('h1');
    if (h) {
      h.setAttribute('tabindex', '-1');
      h.focus({ preventScroll: true });
    }
    window.scrollTo(0, 0);
  }

  // ---------------------------------------------------------------- home
  function viewHome() {
    document.title = `${T.appTitle} · Falaê (protótipo)`;
    setTopbar(null, null);
    const books = DATA.collections
      .map((c) => {
        const n = c.maps.length + c.decks.length;
        const parts = [];
        if (c.maps.length) parts.push(T.mapsCount(c.maps.length));
        if (c.decks.length) parts.push(T.decksCount(c.decks.length));
        const seals = c.levels
          .map((l) => `<span class="seal" aria-label="${T.levelLabel(l)}">${l}</span>`)
          .join('');
        const meta = n
          ? parts.map((p) => `<span class="nw">${p}</span>`).join(' · ')
          : `<span class="soon">${T.soon}</span>`;
        const inner = `<span class="label"><h2>${esc(c.title)}</h2><span class="hand">${esc(c.subtitle)}</span></span><span class="cover-foot">${icon(c.icon, 'cover-ico')}<span class="seals">${seals}</span></span><span class="meta">${meta}</span>`;
        return n
          ? `<li><a class="notebook c-${c.color}" href="#/colecao/${c.id}">${inner}</a></li>`
          : `<li><div class="notebook is-empty c-${c.color}" aria-disabled="true">${inner}</div></li>`;
      })
      .join('');
    main.innerHTML = `
      <section class="hero">
        <p class="hand">${T.appKicker}</p>
        <h1><span class="marker">${T.appTitle}</span></h1>
        <p class="lead">${T.appLead}</p>
        ${DOODLES.pencil}
      </section>
      <ul class="shelf">${books}</ul>
      <section class="downloads" aria-labelledby="dl-h">
        <h2 id="dl-h">${T.downloads}</h2>
        <ul>
          <li><a class="btn" href="pdf/mapas.pdf" download>${icon('download')}${T.pdfMaps}</a></li>
          <li><a class="btn" href="pdf/cartas.pdf" download>${icon('download')}${T.pdfCards}</a></li>
        </ul>
      </section>
      <p class="source-note">Conteúdo: ${esc(DATA.source.maps)} · ${esc(DATA.source.decks)}</p>`;
  }

  // ---------------------------------------------------------------- collection
  function viewCollection(id) {
    const c = collById[id];
    if (!c) return viewHome();
    document.title = `${c.title} · Falaê`;
    setTopbar('#/', c.title);
    const items = [];
    for (const mid of c.maps) {
      const m = mapById[mid];
      const n = m.branches.reduce((s, b) => s + b.nodes.length, 0);
      items.push(
        `<li><a class="item c-${m.branches[0].color}" href="#/mapa/${m.id}"><span class="thumb">${icon(mapIcon(m))}</span><span><h2>${esc(m.title)}</h2><p>${T.nodesCount(n)} · <span lang="en">${esc(m.center.en)}</span></p></span><span class="seal" aria-label="${T.levelLabel(m.level)}">${m.level}</span></a></li>`,
      );
    }
    for (const did of c.decks) {
      const d = deckById[did];
      items.push(
        `<li><a class="item c-${COLOR_OF[d.collection]}" href="#/cartas/${d.id}"><span class="thumb" aria-hidden="true">${esc(d.cards[0].emoji)}</span><span><h2>${esc(d.title)}</h2><p>${T.cardsCount(d.cards.length)} · ${esc(d.description)}</p></span><span class="seal" aria-label="${T.levelLabel(d.level)}">${d.level}</span></a></li>`,
      );
    }
    main.innerHTML = `
      <section class="page-head c-${c.color}">
        <p class="hand">${esc(c.subtitle)}</p>
        <h1><span class="marker">${esc(c.title)}</span></h1>
      </section>
      ${items.length ? `<ul class="items">${items.join('')}</ul>` : `<p class="lead">${T.empty}</p>`}`;
  }

  /** Center picture: the scene (centerArt) or the emoji figure, on its own row. */
  function centerPic(m) {
    const pic = m.centerArt
      ? window.FALAE.art(m.centerArt, 'art-center')
      : m.centerFigure
        ? figure(m.centerFigure, 'fig-center')
        : '';
    return pic ? `${pic}<span class="brk" aria-hidden="true"></span>` : '';
  }

  // ---------------------------------------------------------------- map
  const mapState = { id: null, hide: false, revealed: 0, total: 0 };

  function viewMap(id) {
    const m = mapById[id];
    if (!m) return viewHome();
    document.title = `${m.title} · Falaê`;
    const coll = collById[m.collection];
    setTopbar(`#/colecao/${m.collection}`, coll ? coll.title : '');
    if (mapState.id !== id) Object.assign(mapState, { id, hide: false });

    const branches = m.branches
      .map((b, bi) => {
        const nodes = b.nodes
          .map((n) => `<li class="node">${renderNode(n, { speak: mapSpeakHtml })}</li>`)
          .join('');
        return `<li class="branch c-${b.color}">
          <h2><button type="button" class="ribbon" aria-expanded="true" aria-controls="br-${bi}">
            ${icon('chevron', 'chev')}${icon(b.icon)}<span class="lbl">${esc(b.label)}</span>${b.figure ? figure(b.figure, 'fig-branch') : ''}<span class="count"><span class="sr">,</span>${b.nodes.length}<span class="sr"> ${b.nodes.length === 1 ? 'cartão' : 'cartões'}</span></span>
          </button></h2>
          <ul class="branch-panel${b.nodes.length === 1 ? ' one' : ''}" id="br-${bi}">${nodes}</ul>
        </li>`;
      })
      .join('');

    main.innerHTML = `
      <div class="map-view">
        <section class="map-head">
          <h1><span class="marker">${esc(m.title)}</span></h1>
          <p class="hand map-kicker">${icon(mapIcon(m))}${T.mapKicker(m.level)}</p>
          ${DOODLES.pencil}
          ${m.intro ? `<p class="map-intro">${rich(m.intro)}</p>` : ''}
        </section>
        <div class="toolbar">
          <button type="button" class="btn" id="toggle-all" data-open="true">${icon('collapse')}<span>${T.closeAll}</span></button>
          <button type="button" class="btn" id="toggle-hide" aria-pressed="false">${icon('eye')}<span>${T.hideReveal}</span></button>
          ${m.exercise ? `<button type="button" class="btn" id="go-quiz">${icon('pencil')}<span>${T.goQuiz}</span></button>` : ''}
        </div>
        <p class="hide-status" id="hide-status" aria-live="polite"></p>
        <div class="center-row">
          <p class="center-node">${centerPic(m)}<span class="en" lang="en">${centerText(m.center.en)}</span><span class="pt">${esc(m.center.pt)}</span></p>
          ${DOODLES.star}${DOODLES.sparkle}
          ${m.doodle ? `<p class="hand map-doodle">${icon('bulb')} ${esc(m.doodle)}</p>` : ''}
        </div>
        <ul class="tree" aria-label="Ramos do mapa">${branches}</ul>
        ${m.exercise ? quizHtml(m.exercise) : ''}
        <section class="legend" aria-label="${T.cardTypes}">
          <span class="hand">${T.cardTypes}</span>
          <div class="chips">${legend()}</div>
        </section>
        ${canSpeak() ? '' : `<p class="no-voice">${T.noVoice}</p>`}
      </div>`;

    if (mapState.hide) setHide(true);
    window.FALAE.settleArt(main);
  }

  function setHide(on) {
    mapState.hide = on;
    mapState.revealed = 0;
    document.getElementById('toggle-hide').setAttribute('aria-pressed', String(on));
    const chunks = main.querySelectorAll('.chunk');
    mapState.total = chunks.length;
    chunks.forEach((chunk) => {
      chunk.classList.toggle('is-hidden', on);
      chunk.querySelector('.peek').hidden = !on;
      chunk.firstElementChild.inert = on;
    });
    document.getElementById('hide-status').textContent = on
      ? `${T.hideHint} ${T.revealed(0, mapState.total)}`
      : '';
  }

  function reveal(chunk) {
    if (!chunk.classList.contains('is-hidden')) return;
    const peek = chunk.querySelector('.peek');
    const content = chunk.firstElementChild;
    chunk.classList.remove('is-hidden');
    content.inert = false;
    peek.hidden = true;
    // keep keyboard users in place: focus the revealed phrase (a speak button when available)
    if (content.matches('button')) content.focus({ preventScroll: true });
    else {
      chunk.setAttribute('tabindex', '-1');
      chunk.focus({ preventScroll: true });
    }
    mapState.revealed += 1;
    document.getElementById('hide-status').textContent =
      mapState.revealed >= mapState.total
        ? T.allRevealed
        : T.revealed(mapState.revealed, mapState.total);
  }

  // ---------------------------------------------------------------- quick test
  function quizHtml(ex) {
    const n = ex.items.length;
    const items = ex.items
      .map((it, i) => {
        const [before, after] = it.prompt.split('___');
        const size = Math.max(5, ...it.answer.split('|').map((a) => a.length + 2));
        const said = it.prompt.replace('___', '…');
        return `<li class="qi" data-q="${i}">
          <span class="sr" id="ql-${i}" lang="pt-BR">${T.quizBlank(i + 1)}</span>
          <span class="sr" id="qt-${i}" lang="en">${esc(said)}</span>
          <p class="q-line"><span class="q-prompt" lang="en" aria-hidden="true">${esc(before)}</span><input class="q-input" id="qa-${i}" type="text" size="${size}" lang="en" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false" enterkeyhint="${i === n - 1 ? 'done' : 'next'}" aria-labelledby="ql-${i} qt-${i}"${it.hintPt ? ` aria-describedby="qh-${i}"` : ''} /><span class="q-prompt" lang="en" aria-hidden="true">${esc(after)}</span><span class="q-mark" id="qm-${i}"></span></p>
          ${it.hintPt ? `<p class="q-hint" id="qh-${i}">${esc(it.hintPt)}</p>` : ''}
          <p class="q-ans" hidden>${T.quizAnswer(`<b lang="en">${esc(window.FALAE.mainAnswer(it.answer))}</b>`)}</p>
        </li>`;
      })
      .join('');
    return `<section class="quiz" id="quiz" aria-labelledby="quiz-h">
      <h2 id="quiz-h" tabindex="-1">${icon('pencil')}${T.quizTitle}</h2>
      <p class="quiz-ins">${esc(ex.instruction)}</p>
      <p class="quiz-tip" id="quiz-tip" hidden><button type="button" class="linkbtn" id="quiz-hide-map">${icon('eye')}${T.quizHideMap}</button></p>
      <ol class="quiz-items">${items}</ol>
      <div class="quiz-foot">
        <button type="button" class="btn btn-primary" id="quiz-all">${icon('check')}${T.quizCheckAll}</button>
        <button type="button" class="btn" id="quiz-show" aria-pressed="false">${icon('eye')}<span>${T.quizShow}</span></button>
        <p class="quiz-score" id="quiz-score" aria-live="polite"></p>
      </div>
      <p class="quiz-cheer" id="quiz-cheer" aria-hidden="true" hidden>${DOODLES.star}<span></span></p>
    </section>`;
  }

  /** Marks one item; returns true/false, or null when empty. No announcement here. */
  function markQuiz(i) {
    const m = mapById[mapState.id];
    const it = m.exercise.items[i];
    const input = document.getElementById(`qa-${i}`);
    const mark = document.getElementById(`qm-${i}`);
    const li = input.closest('.qi');
    if (!input.value.trim()) {
      li.classList.remove('is-right', 'is-wrong');
      input.removeAttribute('aria-invalid');
      mark.innerHTML = '';
      return null;
    }
    const ok = window.FALAE.isRightAnswer(input.value, it.answer);
    li.classList.toggle('is-right', ok);
    li.classList.toggle('is-wrong', !ok);
    input.setAttribute('aria-invalid', String(!ok));
    mark.innerHTML = ok
      ? `${icon('check')}<span class="sr">${T.quizRight}</span>`
      : `${icon('xcircle')}<span class="sr">${T.quizWrong}</span>`;
    return ok;
  }

  /** The single live announcement of the test: the score line. */
  function updateScore(prefix) {
    const m = mapById[mapState.id];
    const n = m.exercise.items.length;
    const right = main.querySelectorAll('.qi.is-right').length;
    const cheer = document.getElementById('quiz-cheer');
    const all = right === n;
    cheer.hidden = !all;
    cheer.querySelector('span').textContent = all ? T.quizCheer(n) : '';
    // one announcement only: the score line (the cheer below is aria-hidden decoration)
    document.getElementById('quiz-score').textContent = all
      ? T.quizCheer(n)
      : `${prefix ? `${prefix} ` : ''}${T.quizScore(right, n)}`;
    document.getElementById('quiz-score').classList.toggle('sr', all);
  }

  function checkOne(i) {
    const ok = markQuiz(i);
    const label = T.quizBlank(i + 1);
    updateScore(
      ok === null ? `${label}: ${T.quizEmpty}` : `${label}: ${ok ? T.quizRight : T.quizWrong}`,
    );
  }

  function checkAll() {
    const m = mapById[mapState.id];
    m.exercise.items.forEach((_, i) => markQuiz(i));
    updateScore('');
    const firstWrong = main.querySelector('.qi.is-wrong .q-input');
    if (firstWrong) firstWrong.focus();
  }

  function toggleAnswers() {
    const btn = document.getElementById('quiz-show');
    const on = btn.getAttribute('aria-pressed') !== 'true';
    btn.setAttribute('aria-pressed', String(on));
    btn.querySelector('span').textContent = on ? T.quizHide : T.quizShow;
    main.querySelectorAll('.q-ans').forEach((a) => (a.hidden = !on));
  }

  main.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && e.target.classList.contains('q-input')) {
      e.preventDefault();
      const i = Number(e.target.closest('.qi').dataset.q);
      checkOne(i);
      // Enter moves on: next blank, or "Conferir tudo" after the last one
      const next = document.getElementById(`qa-${i + 1}`) || document.getElementById('quiz-all');
      next.focus();
    }
  });
  main.addEventListener('focusin', (e) => {
    // offer to hide the English of the map the first time the learner starts the test
    if (e.target.id === 'qa-0' && !mapState.hide) {
      document.getElementById('quiz-tip').hidden = false;
    }
  });

  function onMapClick(e) {
    const t = e.target;
    if (t.closest('#quiz-all')) return checkAll();
    if (t.closest('#quiz-show')) return toggleAnswers();
    if (t.closest('#go-quiz')) {
      const q = document.getElementById('quiz');
      q.scrollIntoView({ behavior: reduceMotion.matches ? 'auto' : 'smooth', block: 'start' });
      document.getElementById('quiz-h').focus({ preventScroll: true });
      return;
    }
    if (t.closest('#quiz-hide-map')) {
      setHide(true);
      document.getElementById('quiz-tip').hidden = true;
      document.getElementById('qa-0').focus();
      return;
    }
    const peek = t.closest('.peek');
    if (peek) return reveal(peek.closest('.chunk'));
    const sayBtn = t.closest('.say');
    if (sayBtn) return say(sayBtn.dataset.say, sayBtn);
    const rib = t.closest('.ribbon');
    if (rib) {
      const open = rib.getAttribute('aria-expanded') !== 'true';
      rib.setAttribute('aria-expanded', String(open));
      document.getElementById(rib.getAttribute('aria-controls')).hidden = !open;
      if (open) window.FALAE.settleArt(document.getElementById(rib.getAttribute('aria-controls')));
      return;
    }
    if (t.closest('#toggle-all')) {
      const btn = document.getElementById('toggle-all');
      const open = btn.dataset.open !== 'true';
      btn.dataset.open = String(open);
      btn.innerHTML = `${icon(open ? 'collapse' : 'expand')}<span>${open ? T.closeAll : T.openAll}</span>`;
      main.querySelectorAll('.ribbon').forEach((r) => {
        r.setAttribute('aria-expanded', String(open));
        document.getElementById(r.getAttribute('aria-controls')).hidden = !open;
      });
      if (open) window.FALAE.settleArt(main);
      return;
    }
    if (t.closest('#toggle-hide')) setHide(!mapState.hide);
  }

  // ---------------------------------------------------------------- deck
  const RATINGS = ['errei', 'dificil', 'bom', 'facil'];
  const RATING_COLOR = { errei: 'acerola', dificil: 'manga', bom: 'folha', facil: 'anil' };
  const deck = {
    id: null,
    order: [],
    pos: 0,
    flipped: false,
    mode: 'en-pt',
    tally: null,
    missed: [],
  };

  function startDeck(id, order) {
    const d = deckById[id];
    deck.id = id;
    deck.order = order || d.cards.map((_, i) => i);
    deck.pos = 0;
    deck.flipped = false;
    deck.tally = { errei: 0, dificil: 0, bom: 0, facil: 0 };
    deck.missed = [];
  }

  const currentCard = () => deckById[deck.id].cards[deck.order[deck.pos]];

  /** Small "Ouvir" button that lives inside the card (does not flip it). */
  function listenBtn(c) {
    if (!canSpeak()) return '';
    return `<button type="button" class="say say-card" data-say="${esc(c.en)}" aria-label="${esc(T.listenAria(c.en))}">${icon('speaker')}<span>${T.listen}</span></button>`;
  }

  function cardFaces(d, c) {
    const enFirst = deck.mode === 'en-pt';
    const formal = c.formality
      ? `<span class="formal formal-${c.formality}">${T.formalityLabel}: ${esc(T.formality[c.formality])}</span>`
      : '';
    const seal = `<span class="seal seal-sm" aria-label="${T.levelLabel(c.level)}">${c.level}</span>`;
    const front = `
      <div class="face-top">${seal}${enFirst ? listenBtn(c) : `<span>${esc(collById[d.collection].title)}</span>`}</div>
      <div class="face-main">
        <span class="pic" aria-hidden="true">${esc(c.emoji)}</span>
        ${enFirst ? `<p class="phrase" lang="en">${esc(c.en)}</p>` : `<p class="phrase">${esc(c.pt)}</p>`}
        <p class="hint" aria-hidden="true"><span class="only-touch">${T.flipHintTouch}</span><span class="only-keys">${T.flipHintKeys}</span></p>
      </div>`;
    const fields = [];
    if (c.baseVerb) {
      fields.push(
        `<div class="field"><p class="field-label">${T.baseVerb}</p><p lang="en"><strong>${esc(c.baseVerb)}</strong></p></div>`,
      );
    }
    if (c.example) {
      fields.push(
        `<div class="field"><p class="field-label">${icon('chat')}${T.example}</p><p class="ex-en">${speakHtml(c.example.en)}</p><p class="ex-pt">${esc(c.example.pt)}</p></div>`,
      );
    }
    if (c.pronunciation) {
      fields.push(
        `<div class="field"><p class="field-label">${icon('speaker')}${T.pronunciation}</p><p class="pron">${esc(c.pronunciation)}</p></div>`,
      );
    }
    if (c.situation) {
      fields.push(
        `<div class="field"><p class="field-label">${icon('pin')}${T.situation}</p><p>${esc(c.situation)}</p></div>`,
      );
    }
    if (c.dontUse) {
      fields.push(
        `<div class="box box-dont"><p class="field-label">${icon('ban')}${T.dontUse}</p><p>${esc(c.dontUse)}</p></div>`,
      );
    }
    if (c.falseFriend) {
      const txt = typeof c.falseFriend === 'string' ? c.falseFriend : T.falseFriendDefault;
      fields.push(
        `<div class="box box-warn"><p class="field-label">${icon('warn')}${T.falseFriend}</p><p>${esc(txt)}</p></div>`,
      );
    }
    const answer = enFirst
      ? `<p class="big">${esc(c.pt)}</p><p class="small" lang="en">${esc(c.en)}</p>`
      : `<p class="big" lang="en">${esc(c.en)}</p><p class="small">${esc(c.pt)}</p>`;
    const back = `
      <div class="face-top">${seal}<span class="face-top-r">${formal}${listenBtn(c)}</span></div>
      <div class="face-main">
        <div class="answer"><span class="emo" aria-hidden="true">${esc(c.emoji)}</span><div>${answer}</div></div>
        ${fields.join('')}
      </div>`;
    return { front, back };
  }

  function viewDeck(id) {
    const d = deckById[id];
    if (!d) return viewHome();
    document.title = `${d.title} · Falaê`;
    setTopbar(`#/colecao/${d.collection}`, collById[d.collection].title);
    if (deck.id !== id) startDeck(id);
    main.innerHTML = `
      <section class="deck-head c-${COLOR_OF[d.collection]}">
        <h1><span class="marker">${esc(d.title)}</span></h1>
        <div class="deck-bar">
          <span class="progress" id="deck-progress"></span>
          <span class="seg-wrap" id="mode-wrap"><span class="seg-label" id="mode-l">${T.modeLabel}</span>
            <span class="seg" role="group" aria-labelledby="mode-l">
              <button type="button" data-mode="en-pt" aria-pressed="${deck.mode === 'en-pt'}">${T.modeEnPt}</button>
              <button type="button" data-mode="pt-en" aria-pressed="${deck.mode === 'pt-en'}">${T.modePtEn}</button>
            </span>
          </span>
        </div>
        <div class="progress-track" aria-hidden="true"><div class="progress-fill" id="deck-fill"></div></div>
      </section>
      <div id="deck-body"></div>`;
    renderDeckBody(false);
  }

  function renderDeckBody(focusCard) {
    const d = deckById[deck.id];
    const body = document.getElementById('deck-body');
    const n = deck.order.length;
    const prog = document.getElementById('deck-progress');
    const fill = document.getElementById('deck-fill');
    const modeWrap = document.getElementById('mode-wrap');
    const finished = deck.pos >= n;
    // keep the header still: the direction picker only hides (keeps its space) at the end
    modeWrap.classList.toggle('is-off', finished);
    modeWrap.inert = finished;
    if (finished) {
      prog.textContent = T.done;
      fill.style.width = '100%';
      const missed = deck.missed.length;
      const tally = RATINGS.map(
        (r) =>
          `<li class="c-${RATING_COLOR[r]}"><strong>${deck.tally[r]}</strong>${T.ratings[r]}</li>`,
      ).join('');
      body.innerHTML = `
        <section class="done" aria-labelledby="done-h">
          ${DOODLES.star}
          <h2 id="done-h" tabindex="-1">${T.doneTitle}</h2>
          <p>${T.doneLead(n)}</p>
          <ul class="tally">${tally}</ul>
          <p class="note">${T.doneNote}</p>
          <div class="row">
            ${missed ? `<button type="button" class="btn" data-act="missed" aria-describedby="missed-hint">${icon('eye')}${T.retryMissed(missed)}</button><p class="note" id="missed-hint">${T.retryMissedHint}</p>` : ''}
            <button type="button" class="btn" data-act="restart">${icon('flip')}${T.restart}</button>
            <a class="btn" href="#/colecao/${d.collection}">${icon('back')}${T.backToCollection}</a>
          </div>
        </section>`;
      document.getElementById('done-h').focus();
      announce(
        `${T.doneTitle} ${RATINGS.map((r) => `${T.ratings[r]}: ${deck.tally[r]}`).join(', ')}`,
      );
      return;
    }
    const c = currentCard();
    const faces = cardFaces(d, c);
    prog.textContent = T.deckProgress(deck.pos + 1, n);
    fill.style.width = `${(deck.pos / n) * 100}%`;
    body.innerHTML = `
      <div class="stage c-${COLOR_OF[d.collection]}">
        <div class="drag" id="drag">
          <span class="stamp stamp-ok" id="stamp-ok" aria-hidden="true">${T.remembered}</span>
          <span class="stamp stamp-no" id="stamp-no" aria-hidden="true">${T.forgot}</span>
          <div class="flash" id="flash" tabindex="0" role="group" aria-roledescription="carta" aria-label="${esc(T.deckProgress(deck.pos + 1, n))}" aria-keyshortcuts="Space Enter ArrowLeft ArrowRight">
            <div class="face face-front">${faces.front}</div>
            <div class="face face-back" inert>${faces.back}</div>
          </div>
        </div>
      </div>
      <div class="deck-actions" id="deck-actions"></div>`;
    deck.flipped = false;
    renderActions();
    bindSwipe();
    fitFlash();
    if (focusCard) document.getElementById('flash').focus({ preventScroll: true });
  }

  /** Front: one wide "Virar carta". Back: the four ratings and the gesture/keys hint. */
  function renderActions() {
    const box = document.getElementById('deck-actions');
    if (!box) return;
    if (!deck.flipped) {
      box.innerHTML = `<button type="button" class="btn btn-primary btn-block" data-act="flip">${icon('flip')}${T.flip}</button>`;
      return;
    }
    const rates = RATINGS.map(
      (r) =>
        `<button type="button" class="btn r-${r}" data-rate="${r}" aria-keyshortcuts="${T.ratingKeys[r]}">${T.ratings[r]}<small class="only-keys" aria-hidden="true">${T.ratingKeys[r]}</small></button>`,
    ).join('');
    box.innerHTML = `
      <div class="rate" role="group" aria-label="Como foi?">${rates}</div>
      <p class="deck-hints"><span class="only-touch">${T.swipeHintTouch}</span><span class="only-keys">${T.keysHint}</span></p>`;
  }

  /** Grows the card so the back fits without an inner scroll (faces are absolutely placed). */
  function fitFlash() {
    const f = document.getElementById('flash');
    if (!f) return;
    f.style.height = '';
    let need = 0;
    f.querySelectorAll('.face').forEach((face) => {
      const top = face.querySelector('.face-top');
      const body = face.querySelector('.face-main');
      need = Math.max(need, top.offsetHeight + body.scrollHeight + 4);
    });
    if (need > f.clientHeight) f.style.height = `${need}px`;
  }
  window.addEventListener('resize', fitFlash);
  window.addEventListener('resize', () => {
    if (location.hash.startsWith('#/mapa/')) window.FALAE.settleArt(main);
  });
  // web fonts change line heights after the first paint
  if (document.fonts) {
    document.fonts.ready.then(() => {
      if (location.hash.startsWith('#/mapa/')) window.FALAE.settleArt(main);
    });
  }

  function flip() {
    const f = document.getElementById('flash');
    if (!f) return;
    deck.flipped = !deck.flipped;
    f.classList.toggle('is-flipped', deck.flipped);
    f.querySelector('.face-front').inert = deck.flipped;
    f.querySelector('.face-back').inert = !deck.flipped;
    const hadFocusInActions = document
      .getElementById('deck-actions')
      .contains(document.activeElement);
    renderActions();
    if (hadFocusInActions) f.focus({ preventScroll: true });
    const c = currentCard();
    const enFirst = deck.mode === 'en-pt';
    announce(
      deck.flipped ? T.announceBack(enFirst ? c.pt : c.en) : T.announceFront(enFirst ? c.en : c.pt),
    );
  }

  function rate(r, fly) {
    if (deck.pos >= deck.order.length || !deck.flipped) return;
    deck.tally[r] += 1;
    if (r === 'errei' || r === 'dificil') deck.missed.push(deck.order[deck.pos]);
    deck.pos += 1;
    const next = () => {
      renderDeckBody(true);
      if (deck.pos < deck.order.length) {
        announce(T.announceRated(T.ratings[r], deck.pos + 1, deck.order.length));
      }
    };
    const drag = document.getElementById('drag');
    if (fly && drag && !reduceMotion.matches) {
      drag.classList.add('is-returning');
      drag.style.transform = `translateX(${fly * 120}%) rotate(${fly * 12}deg)`;
      drag.style.opacity = '0';
      setTimeout(next, 220);
    } else next();
  }

  let swipe = null;
  let suppressClick = false;
  function bindSwipe() {
    const drag = document.getElementById('drag');
    const flash = document.getElementById('flash');
    const ok = document.getElementById('stamp-ok');
    const no = document.getElementById('stamp-no');
    const settle = () => {
      drag.classList.add('is-returning');
      drag.style.transform = '';
      ok.style.opacity = '0';
      no.style.opacity = '0';
      setTimeout(() => drag.classList.remove('is-returning'), 260);
    };
    flash.addEventListener('pointerdown', (e) => {
      if (e.button !== 0 || e.target.closest('button')) return;
      swipe = { x: e.clientX, y: e.clientY, dx: 0, active: false, id: e.pointerId };
    });
    flash.addEventListener('pointermove', (e) => {
      if (!swipe || e.pointerId !== swipe.id) return;
      const dx = e.clientX - swipe.x;
      const dy = e.clientY - swipe.y;
      if (!swipe.active && Math.abs(dx) > 12 && Math.abs(dx) > Math.abs(dy)) {
        swipe.active = true;
        flash.setPointerCapture(e.pointerId);
        drag.classList.add('is-dragging');
      }
      if (!swipe.active) return;
      swipe.dx = dx;
      const rot = reduceMotion.matches ? 0 : dx / 22;
      drag.style.transform = `translateX(${dx}px) rotate(${rot}deg)`;
      // the "remembered / forgot" stamps only make sense once the answer is visible
      if (deck.flipped) {
        ok.style.opacity = String(Math.max(0, Math.min(1, dx / 90)));
        no.style.opacity = String(Math.max(0, Math.min(1, -dx / 90)));
      }
    });
    const end = () => {
      if (!swipe) return;
      const { dx, active } = swipe;
      swipe = null;
      if (!active) return;
      suppressClick = true;
      setTimeout(() => (suppressClick = false), 50);
      drag.classList.remove('is-dragging');
      if (Math.abs(dx) <= 90) return settle();
      if (!deck.flipped) {
        settle(); // on the front a swipe just turns the card
        return flip();
      }
      rate(dx > 0 ? 'bom' : 'errei', dx > 0 ? 1 : -1);
    };
    flash.addEventListener('pointerup', end);
    flash.addEventListener('pointercancel', end);
  }

  function onDeckClick(e) {
    const t = e.target;
    const sayBtn = t.closest('.say');
    if (sayBtn) {
      e.stopPropagation();
      return say(sayBtn.dataset.say, sayBtn);
    }
    const modeBtn = t.closest('[data-mode]');
    if (modeBtn) {
      deck.mode = modeBtn.dataset.mode;
      main.querySelectorAll('[data-mode]').forEach((b) => {
        b.setAttribute('aria-pressed', String(b.dataset.mode === deck.mode));
      });
      if (deck.pos < deck.order.length) renderDeckBody(false);
      announce(deck.mode === 'en-pt' ? T.modeEnPt : T.modePtEn);
      return;
    }
    const rateBtn = t.closest('[data-rate]');
    if (rateBtn) return rate(rateBtn.dataset.rate, 0);
    const act = t.closest('[data-act]');
    if (act) {
      const a = act.dataset.act;
      if (a === 'flip') return flip();
      if (a === 'restart') {
        startDeck(deck.id);
        return renderDeckBody(true);
      }
      if (a === 'missed') {
        startDeck(deck.id, deck.missed.slice());
        return renderDeckBody(true);
      }
    }
    if (t.closest('#flash') && !suppressClick) flip();
  }

  function onKey(e) {
    if (!location.hash.startsWith('#/cartas/')) return;
    if (e.altKey || e.ctrlKey || e.metaKey) return;
    const tag = e.target.tagName;
    const onControl = tag === 'BUTTON' || tag === 'A' || tag === 'INPUT';
    const inDeck = deck.pos < deck.order.length && document.getElementById('flash');
    if (!inDeck) return;
    if ((e.key === ' ' || e.key === 'Enter') && !onControl) {
      e.preventDefault();
      flip();
    } else if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
      e.preventDefault();
      // arrows rate only after the answer is visible; on the front they turn the card
      if (!deck.flipped) flip();
      else if (e.key === 'ArrowRight') rate('bom', 1);
      else rate('errei', -1);
    } else if (deck.flipped && ['1', '2', '3', '4'].includes(e.key)) {
      rate(RATINGS[Number(e.key) - 1], 0);
    }
  }

  // ---------------------------------------------------------------- router
  function route(keepFocus) {
    if (speech.supported) window.speechSynthesis.cancel();
    const parts = location.hash.replace(/^#\/?/, '').split('/');
    const [kind, id] = parts;
    if (kind === 'colecao') viewCollection(id);
    else if (kind === 'mapa') viewMap(id);
    else if (kind === 'cartas') viewDeck(id);
    else viewHome();
    if (keepFocus !== true) focusHeading();
  }

  main.addEventListener('click', (e) => {
    if (location.hash.startsWith('#/mapa/')) onMapClick(e);
    else if (location.hash.startsWith('#/cartas/')) onDeckClick(e);
  });
  document.addEventListener('keydown', onKey);
  window.addEventListener('hashchange', () => route(false));
  route(false);
})();
