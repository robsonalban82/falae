// Shared helpers for index.html (app) and print.html (PDF). Plain browser script, no modules,
// so the pages also work when opened straight from disk (file://).
(function () {
  'use strict';

  // UI texts (PT-BR) in one place.
  const T = {
    appTitle: 'Mapas & Cartas',
    appKicker: 'protótipo para avaliação',
    appLead:
      'Mapas mentais e cartas de inglês para estudar na tela ou imprimir. Escolha um caderno para começar.',
    downloads: 'Para imprimir',
    pdfMaps: 'Apostila de mapas (PDF, A4 deitado)',
    pdfCards: 'Cartas para recortar (PDF, frente e verso)',
    soon: 'em breve',
    back: 'Voltar',
    home: 'Início',
    mapsCount: (n) => (n === 1 ? '1 mapa' : `${n} mapas`),
    decksCount: (n) => (n === 1 ? '1 baralho' : `${n} baralhos`),
    cardsCount: (n) => (n === 1 ? '1 carta' : `${n} cartas`),
    nodesCount: (n) => (n === 1 ? '1 cartão' : `${n} cartões`),
    levelLabel: (l) => `nível ${l}`,
    mapKicker: (l) => `mapa mental · nível ${l}`,
    openAll: 'Abrir tudo',
    closeAll: 'Fechar tudo',
    hideReveal: 'Esconder o inglês',
    hideHint: 'Leia o português e tente lembrar o inglês antes de tocar no post-it.',
    revealed: (a, b) => `${a} de ${b} trechos revelados.`,
    allRevealed: 'Tudo revelado!',
    quizTitle: 'Teste rápido',
    quizCheck: 'Conferir',
    quizCheckAll: 'Conferir tudo',
    quizHideMap: 'Esconder o inglês do mapa',
    goQuiz: 'Ir para o teste',
    quizCheer: (n) => `Mandou bem! ${n} de ${n}`,
    quizShow: 'Ver respostas',
    quizHide: 'Esconder respostas',
    quizRight: 'Certo!',
    quizWrong: 'Ainda não. Tente de novo.',
    quizEmpty: 'em branco',
    quizAnswer: (a) => `Resposta: ${a}`,
    quizBlank: (i) => `Lacuna ${i}`,
    quizScore: (a, b) => `${a} de ${b} certas`,
    quizAnswersPrint: 'Respostas',
    ownTitle: 'Agora é com você',
    ownHint: 'Escreva 2 frases suas usando o que você viu neste mapa.',
    peekAria: 'Mostrar o trecho em inglês',
    listen: 'Ouvir',
    listenAria: (t) => `Ouvir: ${t}`,
    noVoice: 'Seu navegador não tem voz em inglês americano; o áudio está desligado.',
    cardTypes: 'tipos de cartão',
    branchToggle: (label, open) => `${label}: ${open ? 'recolher' : 'abrir'}`,
    wrongSr: 'Errado:',
    rightSr: 'Certo:',
    tags: {
      regra: 'regra',
      exemplo: 'exemplo',
      excecao: 'exceção',
      'erro-comum': 'erro comum',
      vocabulario: 'vocabulário',
    },
    // Cards
    deckProgress: (i, n) => `Carta ${i} de ${n}`,
    modeEnPt: 'EN → PT',
    modePtEn: 'PT → EN',
    modeLabel: 'Sentido',
    flip: 'Virar carta',
    flipHintTouch: 'Toque na carta para virar',
    flipHintKeys: 'Clique na carta ou use Espaço / Enter',
    swipeHintTouch: 'Deslize para a direita se lembrou, para a esquerda se não',
    keysHint: 'Teclas: ← → ou 1 a 4',
    done: 'Concluído',
    formalityLabel: 'registro',
    front: 'Frente',
    backSide: 'Verso',
    translation: 'Tradução',
    example: 'Exemplo',
    pronunciation: 'Pronúncia',
    situation: 'Quando usar',
    dontUse: 'Quando não usar',
    falseFriend: 'Cuidado: falso cognato',
    falseFriendDefault: 'Parece português, mas o sentido é outro.',
    baseVerb: 'Verbo base',
    formality: { neutro: 'neutro', informal: 'informal', giria: 'gíria' },
    ratings: { errei: 'Errei', dificil: 'Difícil', bom: 'Bom', facil: 'Fácil' },
    ratingKeys: { errei: '1', dificil: '2', bom: '3', facil: '4' },
    remembered: 'Lembrei',
    forgot: 'Não lembrei',
    doneTitle: 'Baralho concluído!',
    doneLead: (n) => `Você passou por ${n === 1 ? '1 carta' : `${n} cartas`}.`,
    doneNote: 'Protótipo: as notas só contam aqui, ainda não agendam revisões.',
    restart: 'Recomeçar',
    retryMissed: (n) => (n === 1 ? 'Rever 1 carta' : `Rever ${n} cartas`),
    retryMissedHint: 'as que você marcou Errei ou Difícil',
    backToCollection: 'Voltar à coleção',
    announceFront: (t) => `Frente: ${t}`,
    announceBack: (t) => `Verso: ${t}`,
    announceRated: (r, i, n) => `${r}. Carta ${i} de ${n}.`,
    empty: 'Ainda não há nada nesta coleção.',
  };

  const LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];

  // Hand-drawn style icons (own drawings), 24x24, stroke = currentColor.
  const P = {
    check: '<path d="M4.6 12.9c1.5 1.3 3 2.9 4.2 4.6 2.7-4.4 5.9-8.1 10.4-11.2"/>',
    ban: '<path d="M12 3.7c4.7-.2 8.5 3.6 8.4 8.3-.1 4.6-3.8 8.2-8.5 8.1-4.6-.1-8.2-3.8-8.1-8.4.1-4.4 3.7-7.9 8.2-8z"/><path d="M6.3 6.5c3.9 3.6 7.7 7.4 11.4 11.1"/>',
    question:
      '<path d="M8.4 9.1c-.2-2.5 1.6-4.4 3.8-4.4 2.2 0 3.9 1.5 3.8 3.5-.1 2.6-3.4 3-3.8 5.7l-.1 1.2"/><path d="M12.1 19.3v.1"/>',
    quote:
      '<path d="M11.2 4.9c2.3-.3 3.8 1.3 3.6 3.5-.2 2.9-2.3 5.5-5.2 7"/><circle cx="11.6" cy="7.2" r="1.7" fill="currentColor"/>',
    x: '<path d="M6.1 6.3c4 3.8 8 7.7 11.9 11.6M17.8 6.1c-3.9 4-7.8 8-11.6 11.9"/>',
    bulb: '<path d="M9.1 17.4h5.9M9.9 20.4h4.3"/><path d="M12 3.6c-3.4 0-6 2.6-5.9 5.8.1 2.2 1.4 3.4 2.4 4.6.6.8.6 1.6.6 2.6h5.8c0-1 0-1.8.6-2.6 1-1.2 2.4-2.5 2.4-4.6 0-3.3-2.6-5.8-5.9-5.8z"/>',
    clock:
      '<path d="M12 3.8c4.6-.1 8.3 3.6 8.2 8.2 0 4.5-3.7 8.1-8.3 8.1-4.5-.1-8.1-3.7-8-8.3.1-4.4 3.6-7.9 8.1-8z"/><path d="M12 7.3v5.1l3.3 2.1"/>',
    pin: '<path d="M12 20.8c-2.6-3.5-6-7-6-10.8a6 6 0 0 1 12 0c0 3.8-3.4 7.3-6 10.8z"/><circle cx="12" cy="10" r="2.1"/>',
    book: '<path d="M12 6.6C10 5.1 7 4.7 3.9 5.1v13.1c3.1-.4 6.1 0 8.1 1.4 2-1.4 5-1.8 8.1-1.4V5.1c-3.1-.4-6.1 0-8.1 1.5z"/><path d="M12 6.6v12.9"/>',
    chat: '<path d="M4.5 6.3c0-1.1.8-1.9 1.9-1.9h11.2c1.1 0 1.9.8 1.9 1.9v7.3c0 1.1-.8 1.9-1.9 1.9h-7.4l-4.1 3.6.3-3.6c-1.1 0-1.9-.8-1.9-1.9z"/>',
    star: '<path d="M12 3.9l2.4 5 5.3.6-3.9 3.7 1.1 5.4L12 15.9l-4.9 2.7 1.1-5.4-3.9-3.7 5.3-.6z"/>',
    arrow:
      '<path d="M4 12.3c5.2-.4 10.3-.3 15.3 0"/><path d="M14.3 6.9c1.8 1.9 3.5 3.5 5.3 5.3-1.9 1.7-3.6 3.5-5.2 5.4"/>',
    calendar:
      '<path d="M4.6 6.4c5-.2 9.9-.1 14.9 0l-.1 13.1c-4.9.1-9.9.1-14.8 0z"/><path d="M4.7 10.4h14.7M8.5 4v4M15.5 4v4"/>',
    home: '<path d="M4 11.5 12 4.3l8 7.2"/><path d="M6.4 9.7V20h11.2V9.7"/><path d="M10 20v-5.1h4V20"/>',
    hash: '<path d="M9.7 4 8.1 20M16 4l-1.6 16M4.6 9.1h15.3M4.1 15h15.3"/>',
    swap: '<path d="M5 8.5c4.3-.2 8.6-.1 12.9 0"/><path d="M14.6 5l3.6 3.5-3.6 3.5"/><path d="M19 15.6c-4.3.2-8.6.1-12.9 0"/><path d="M9.4 12.1 5.8 15.6l3.6 3.5"/>',
    // UI / tag icons
    ruler:
      '<path d="M3.6 8.6c5.6-.2 11.2-.1 16.8 0v6.9c-5.6.1-11.2.1-16.8 0z"/><path d="M7 8.7v3M10.4 8.7v2.1M13.8 8.7v3M17.2 8.7v2.1"/>',
    warn: '<path d="M12 4.2 3.6 19.4c5.6.2 11.2.2 16.8 0z"/><path d="M12 10.1v4.3M12 17.1v.1"/>',
    xcircle:
      '<path d="M12 3.7c4.7-.2 8.5 3.6 8.4 8.3-.1 4.6-3.8 8.2-8.5 8.1-4.6-.1-8.2-3.8-8.1-8.4.1-4.4 3.7-7.9 8.2-8z"/><path d="M9 9.1c2 1.9 4 3.9 6 5.9M15 9c-2 2-4 4-5.9 6"/>',
    speaker:
      '<path d="M4.4 9.6h3.3L12 6v12l-4.3-3.6H4.4z"/><path d="M15.4 9.3c1.2 1.6 1.2 3.9 0 5.5M18 7.1c2.4 2.8 2.4 7 0 9.8"/>',
    chevron: '<path d="M6.5 9.3c1.9 1.9 3.7 3.8 5.5 5.6 1.9-1.9 3.7-3.7 5.6-5.6"/>',
    eye: '<path d="M2.8 12.1c2.4-4 5.5-6 9.2-6s6.8 2 9.2 6c-2.4 3.9-5.5 5.8-9.2 5.8s-6.8-1.9-9.2-5.8z"/><circle cx="12" cy="12" r="2.8"/>',
    back: '<path d="M19.5 12.2c-5-.3-10-.3-15 0"/><path d="M9.6 6.8c-1.8 1.9-3.4 3.6-5.1 5.4 1.8 1.7 3.4 3.4 5.1 5.3"/>',
    flip: '<path d="M4.6 10.2C5.7 6.6 8.6 4.4 12.1 4.4c2.7 0 5 1.3 6.4 3.5"/><path d="M18.9 4.4v3.9h-3.8"/><path d="M19.4 13.8c-1.1 3.6-4 5.8-7.5 5.8-2.7 0-5-1.3-6.4-3.5"/><path d="M5.1 19.6v-3.9h3.8"/>',
    download:
      '<path d="M12 4v10.6"/><path d="M7.4 10.4c1.6 1.6 3 3 4.6 4.6 1.6-1.6 3-3 4.6-4.6"/><path d="M4.6 15.5v3.9h14.8v-3.9"/>',
    expand: '<path d="M6.5 8.3 12 13.8l5.5-5.5M6.5 13.3 12 18.8l5.5-5.5"/>',
    collapse: '<path d="M6.5 15.7 12 10.2l5.5 5.5M6.5 10.7 12 5.2l5.5 5.5"/>',
    sparkle: '<path d="M12 3.5v17M3.5 12h17M6.3 6.3l11.4 11.4M17.7 6.3 6.3 17.7"/>',
    pencil:
      '<path d="M3.5 15.5 15.8 4.2l4 4.2L7.6 19.8l-4.8.9z"/><path d="M13.6 6.2l4.1 4.2M3.1 16.4l4 3.7"/>',
  };

  function icon(name, cls) {
    const body = P[name] || P.star;
    return `<svg class="ico${cls ? ` ${cls}` : ''}" viewBox="0 0 24 24" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">${body}</svg>`;
  }

  const TAG_ICONS = {
    regra: 'ruler',
    exemplo: 'chat',
    excecao: 'warn',
    'erro-comum': 'xcircle',
    vocabulario: 'book',
  };

  function esc(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  /** Escapes text and turns **bold** into <strong class="key">. */
  /** Keeps short alternatives together ("a / an", "am / is") so "/" never ends a line. */
  function glue(html) {
    // twice, so chains like "he / she / it" are fully glued (matches cannot overlap)
    return glueOnce(glueOnce(html));
  }
  function glueOnce(html) {
    return html.replace(
      /(^|[\s\u00a0])([^\s<>]{1,5}) \/ ([^\s<>]{1,5})(?=[\s.,;:!?)]|$)/g,
      '$1$2\u00a0/\u00a0$3',
    );
  }

  function richRaw(s) {
    return (
      esc(s)
        .replace(/\*\*(.+?)\*\*/g, '<strong class="key">$1</strong>')
        // phone numbers and times like 555-0193 never break at the hyphen
        .replace(/(\d)-(\d)/g, '$1\u2011$2')
    );
  }
  function rich(s) {
    return glue(richRaw(s));
  }

  /** Plain text for speech / aria (no markdown). */
  function plain(s) {
    return String(s || '').replace(/\*\*/g, '');
  }

  function tagChip(tag) {
    return `<span class="tag tag-${tag}">${icon(TAG_ICONS[tag] || 'ruler')}<span>${esc(T.tags[tag] || tag)}</span></span>`;
  }

  /**
   * Renders the lines of a map node. `speak(text)` returns the HTML for an English
   * phrase (a button in the app when a voice exists, a span otherwise).
   */
  function renderLines(node, speak, compact) {
    const all = [];
    const vocab = node.tag === 'vocabulario';
    // if any line has an emoji, every line gets the same left gutter (keeps the rhythm)
    const gutter = node.lines.some((l) => l.emoji);
    for (const l of node.lines) {
      const out = [];
      if (l.wrong) {
        out.push(
          `<p class="ln ln-wrong">${icon('xcircle', 'mark-x')}<span class="sr">${T.wrongSr}</span><s lang="en">${keep(l.wrong)}</s></p>`,
        );
      }
      if (l.right) {
        out.push(
          `<p class="ln ln-right">${icon('check', 'mark-ok')}<span class="sr">${T.rightSr}</span>${speak(l.right, 'right')}</p>`,
        );
      }
      if (l.en && l.pt && vocab && isTerm(l.en)) {
        // the "=" travels with the translation, so it never ends a line on its own
        out.push(
          `<p class="ln ln-vocab">${speak(l.en)}<span class="pt"><span class="eq" aria-hidden="true">=\u00a0</span>${rich(l.pt)}</span></p>`,
        );
      } else if (
        compact &&
        l.en &&
        l.pt &&
        node.tag !== 'exemplo' &&
        isTerm(l.en) &&
        plain(l.en).length + plain(l.pt).length <= (gutter ? 24 : 30)
      ) {
        // print: short pair on one line, translation after a dash
        out.push(
          `<p class="ln ln-pair">${speak(l.en)}<span class="pt"><span class="eq" aria-hidden="true">–\u00a0</span>${rich(l.pt)}</span></p>`,
        );
      } else {
        if (l.en) out.push(`<p class="ln ln-en">${speak(l.en)}</p>`);
        if (l.pt) out.push(`<p class="ln ln-pt${l.en ? ' is-trans' : ''}">${rich(l.pt)}</p>`);
      }
      if (l.note) out.push(`<p class="ln ln-note">${rich(l.note)}</p>`);
      all.push(
        gutter
          ? `<div class="lg">${l.emoji ? figure(l.emoji, 'fig-line') : '<span class="fig-line"></span>'}<div class="lg-body">${out.join('')}</div></div>`
          : out.join(''),
      );
    }
    return all.join('');
  }

  /** Short word/expression (not a sentence): shown as "term = tradução" on one line. */
  function isTerm(en) {
    const t = plain(en).trim();
    return t.split(/\s+/).length <= 4 && !/[.?!]$/.test(t);
  }

  /**
   * Center label: each item keeps its separator and never breaks inside
   * ("in ·" "on ·" "at"); "..." becomes "…".
   */
  function centerText(en) {
    const parts = String(en)
      .replace(/\.\.\./g, '…')
      .split(/ ([·&+/]) /);
    const items = [];
    for (let i = 0; i < parts.length; i += 2) {
      items.push(parts[i] + (parts[i + 1] ? `\u00a0${parts[i + 1]}` : ''));
    }
    return items.map((t) => `<span class="nw">${esc(t)}</span>`).join(' ');
  }

  /**
   * The only place that draws a "figure". Today it is emoji; to switch to our own
   * illustrations later, change just this function. Always decorative (aria-hidden).
   */
  function figure(emojis, cls) {
    const n = [...new Intl.Segmenter('pt', { granularity: 'grapheme' }).segment(emojis)].filter(
      (g) => g.segment.trim(),
    ).length;
    return `<span class="fig ${cls || ''} fig-n${n}" aria-hidden="true">${esc(emojis)}</span>`;
  }

  /** Scene illustration (inline SVG from data.js, embedded by build.mjs). Decorative. */
  function art(name, cls) {
    const svg = window.FALAE_PROTO && window.FALAE_PROTO.art && window.FALAE_PROTO.art[name];
    return svg ? `<span class="art${cls ? ` ${cls}` : ''}" aria-hidden="true">${svg}</span>` : '';
  }

  /**
   * Places each card scene (floated right) next to as many lines as possible without
   * squeezing a short English block: it is inserted before line i, trying the top first and
   * moving down until no unbreakable English chunk (.nwb) collides with it. In the worst case
   * it goes after the last line (below the text).
   */
  function settleArt(root) {
    fitNowrap(root);
    const hit = (a, b) =>
      a.left < b.right - 1 && a.right > b.left + 1 && a.top < b.bottom - 1 && a.bottom > b.top + 1;
    root.querySelectorAll('.node-body.has-art').forEach((body) => {
      const scene = body.querySelector(':scope > .art');
      if (!scene) return;
      const spacer = body.querySelector(':scope > .art-spacer');
      if (spacer) spacer.style.height = '0px';
      const lines = [...body.children].filter((c) => c.matches('.ln, .lg'));
      if (!lines.length) return;
      // among slots where no short English block collides, keep the most compact card;
      // ties go to the lower slot (scene closer to the base, like the printed reference)
      let chosen = lines.length;
      let bestH = Infinity;
      for (let i = 0; i <= lines.length; i++) {
        body.insertBefore(scene, lines[i] || null);
        const r = scene.getBoundingClientRect();
        const blocked = [...body.querySelectorAll('.nwb:not(.nwb-off)')].some(
          (n) => !scene.contains(n) && [...n.getClientRects()].some((q) => hit(r, q)),
        );
        if (blocked) continue;
        const h = body.getBoundingClientRect().height;
        if (h <= bestH + 0.5) {
          bestH = Math.min(h, bestH);
          chosen = i;
        }
      }
      body.insertBefore(scene, lines[chosen] || null);
    });
  }

  /** Quiz answer check: ignores case, punctuation and extra spaces; "a|b" = alternatives. */
  function normalizeAnswer(s) {
    return String(s)
      .toLowerCase()
      .replace(/[’‘`´]/g, "'")
      .replace(/[^\p{L}\p{N}\s]/gu, '')
      .replace(/\s+/g, ' ')
      .trim();
  }
  function isRightAnswer(given, answer) {
    const g = normalizeAnswer(given);
    return g !== '' && answer.split('|').some((a) => normalizeAnswer(a) === g);
  }
  /** Main (first) alternative, for display. */
  const mainAnswer = (answer) => answer.split('|')[0].trim();

  /** Short English blocks never break inside ("I have 20 years." stays on one line). */
  function keep(text) {
    // alternatives ("A. / B.") are separate blocks: the line may break right after " /"
    const parts = String(text).split(' / ');
    if (parts.length > 1 && parts.every((p) => plain(p).length > 5)) {
      return parts.map((p) => keep(p)).join('\u00a0/ ');
    }
    // "555-0193 = five five five, oh one nine three": each side of "=" stays whole
    const eq = String(text).indexOf(' = ');
    if (eq > 0 && plain(text).length > 32) {
      const left = String(text).slice(0, eq);
      const right = String(text).slice(eq + 3);
      if (plain(left).length <= 32 && plain(right).length <= 36) {
        return `<span class="nwb">${rich(left)} =</span> <span class="nwb">${rich(right)}</span>`;
      }
    }
    return plain(text).length <= 32 ? `<span class="nwb">${rich(text)}</span>` : rich(text);
  }

  /**
   * nowrap only where the block fits: a .nwb wider than its line's available width (card
   * text column) goes back to normal wrapping, balanced. Call after layout.
   */
  function fitNowrap(root) {
    root.querySelectorAll('.nwb').forEach((n) => {
      n.classList.remove('nwb-off');
      const block = n.closest('.ln, .q-line, .ans, p, li');
      if (!block) return;
      const cs = getComputedStyle(block);
      const avail = block.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
      // keep a little air before the card border (≈ 2 mm)
      if (n.getBoundingClientRect().width > avail - 8) {
        n.classList.add('nwb-off');
        block.classList.add('ln-balance');
      }
    });
  }

  function plainSpeak(text, kind) {
    return `<span lang="en" class="en${kind === 'right' ? ' en-right' : ''}">${keep(text)}</span>`;
  }

  /** One map card (node). Returns HTML; `opts.speak` and `opts.extra` are optional. */
  function renderNode(node, opts) {
    const speak = (opts && opts.speak) || plainSpeak;
    // skip a title that only repeats the first English line (common in vocab cards)
    const first = node.lines[0] && node.lines[0].en;
    const dup =
      node.title &&
      first &&
      plain(node.title).trim().toLowerCase() === plain(first).trim().toLowerCase();
    const title = node.title && !dup ? `<p class="node-title">${rich(node.title)}</p>` : '';
    // the node figure floats in the top right corner; the lines wrap around it
    const scene = node.art ? art(node.art) : '';
    if (scene) {
      // a scene illustration replaces the small figure: text left, scene right, aligned to the base
      // spacer + scene float right; settleArt() sizes the spacer so the scene sits at the
      // bottom right and only the last lines wrap around it
      return `<div class="node-tagrow">${tagChip(node.tag)}</div><div class="node-body has-art"><span class="art-spacer" aria-hidden="true"></span>${scene}${title}${renderLines(node, speak, opts && opts.compact)}</div>`;
    }
    const fig = node.figure ? figure(node.figure, 'fig-node') : '';
    return `<div class="node-tagrow">${tagChip(node.tag)}</div><div class="node-body">${fig}${title}${renderLines(node, speak, opts && opts.compact)}</div>`;
  }

  function legend() {
    return Object.keys(T.tags)
      .map((t) => tagChip(t))
      .join('');
  }

  // Decorative hand-drawn doodles (SVG). aria-hidden.
  const DOODLES = {
    star: '<svg class="doodle doodle-star" viewBox="0 0 40 40" aria-hidden="true" focusable="false"><path d="M20 4.5l4.4 9.4 10.1 1.2-7.5 6.9 2 10.1L20 27l-9 5.1 2-10.1-7.5-6.9 10.1-1.2z" fill="var(--doodle-fill)" stroke="var(--ink)" stroke-width="2.2" stroke-linejoin="round"/></svg>',
    sparkle:
      '<svg class="doodle doodle-sparkle" viewBox="0 0 40 40" aria-hidden="true" focusable="false"><path d="M20 5v30M5 20h30M9.5 9.5l21 21M30.5 9.5l-21 21" stroke="var(--doodle-line)" stroke-width="2.2" stroke-linecap="round"/></svg>',
    pencil:
      '<svg class="doodle doodle-pencil" viewBox="0 0 120 34" aria-hidden="true" focusable="false"><path d="M8 10.5 92 6.5l20 10.2-19.6 10.6L8.5 24z" fill="var(--doodle-fill)" stroke="var(--ink)" stroke-width="2.2" stroke-linejoin="round"/><path d="M92 6.5c-2.4 6.6-2.4 13.6.4 20.8M8 10.5c-3.2 4.2-3.1 9.3.5 13.5" fill="none" stroke="var(--ink)" stroke-width="2.2"/><path d="M104.5 12.8l7.5 3.9-7.3 4" fill="var(--ink)"/><path d="M14 17.4c22-.8 46-1.2 70-1.4" stroke="var(--ink)" stroke-width="1.6" stroke-linecap="round" fill="none" opacity=".5"/></svg>',
    arrow:
      '<svg class="doodle doodle-arrow" viewBox="0 0 80 60" aria-hidden="true" focusable="false"><path d="M8 8c18 2 40 10 52 36" fill="none" stroke="var(--doodle-line)" stroke-width="2.2" stroke-linecap="round"/><path d="M50 40.5l10.5 5 2.5-11.2" fill="none" stroke="var(--doodle-line)" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    squiggle:
      '<svg class="doodle doodle-squiggle" viewBox="0 0 200 14" aria-hidden="true" focusable="false" preserveAspectRatio="none"><path d="M2 8c8-6 14 6 22 0s14 6 22 0 14 6 22 0 14 6 22 0 14 6 22 0 14 6 22 0 14 6 22 0 14 6 22 0 14 6 22 0" fill="none" stroke="var(--doodle-red)" stroke-width="2.4" stroke-linecap="round"/></svg>',
  };

  window.FALAE = {
    T,
    LEVELS,
    icon,
    esc,
    rich,
    plain,
    tagChip,
    renderNode,
    renderLines,
    legend,
    DOODLES,
    TAG_ICONS,
    centerText,
    keep,
    fitNowrap,
    figure,
    art,
    settleArt,
    isRightAnswer,
    mainAnswer,
  };
})();
