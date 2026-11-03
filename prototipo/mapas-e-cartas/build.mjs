#!/usr/bin/env node
// Builds data.js (window.FALAE_PROTO) from conteudo/ (or dev-fixtures/ as a fallback).
// Pure Node, no dependencies. Usage: node prototipo/mapas-e-cartas/build.mjs [--fixtures]
import { readdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, dirname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = dirname(fileURLToPath(import.meta.url));
const FORCE_FIXTURES = process.argv.includes('--fixtures');

const usedArt = new Set();
const LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];
const MAP_COLLECTIONS = ['mapas', 'phrasal'];
const DECK_COLLECTIONS = ['frases', 'phrasal', 'expressoes', 'falsos-cognatos'];
const TAGS = ['regra', 'exemplo', 'excecao', 'erro-comum', 'vocabulario'];
const COLORS = ['folha', 'jabuticaba', 'anil', 'manga', 'acerola', 'maracuja'];
const ICONS = [
  'check',
  'ban',
  'question',
  'quote',
  'x',
  'bulb',
  'clock',
  'pin',
  'book',
  'chat',
  'star',
  'arrow',
  'calendar',
  'home',
  'hash',
  'swap',
];
const FORMALITY = ['neutro', 'informal', 'giria'];
const MAX_BRANCHES = 6;
const MAX_NODES = 25;

// Order and look of the five collections shown on the cover.
const COLLECTIONS = [
  {
    id: 'mapas',
    title: 'Mapas mentais',
    subtitle: 'Gramática num olhar',
    color: 'anil',
    icon: 'pin',
  },
  {
    id: 'phrasal',
    title: 'Phrasal verbs',
    subtitle: 'Verbo + partícula',
    color: 'jabuticaba',
    icon: 'swap',
  },
  {
    id: 'frases',
    title: 'Frases do dia a dia',
    subtitle: 'Prontas para usar',
    color: 'folha',
    icon: 'chat',
  },
  {
    id: 'expressoes',
    title: 'Expressões e gírias',
    subtitle: 'Fale como nativo',
    color: 'manga',
    icon: 'star',
  },
  {
    id: 'falsos-cognatos',
    title: 'Falsos cognatos',
    subtitle: 'Parece, mas não é',
    color: 'acerola',
    icon: 'ban',
  },
];

const errors = [];
const warnings = [];

function listJson(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => f.endsWith('.json'))
    .sort()
    .map((f) => join(dir, f));
}

function pickSource(kind) {
  const real = listJson(join(ROOT, 'conteudo', kind));
  if (!FORCE_FIXTURES && real.length > 0) return { from: `conteudo/${kind}`, files: real };
  return { from: `dev-fixtures/${kind}`, files: listJson(join(ROOT, 'dev-fixtures', kind)) };
}

function rel(file) {
  return file.slice(ROOT.length + 1);
}

function readJson(file) {
  try {
    return JSON.parse(readFileSync(file, 'utf8'));
  } catch (e) {
    errors.push(`${rel(file)}: JSON inválido (${e.message})`);
    return null;
  }
}

/** Small structural checker: reports unknown keys, missing keys and wrong types. */
function checkObject(where, value, spec) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    errors.push(`${where}: esperava um objeto`);
    return false;
  }
  for (const key of Object.keys(value)) {
    if (!(key in spec)) {
      errors.push(
        `${where}: campo desconhecido "${key}" (aceitos: ${Object.keys(spec).join(', ')})`,
      );
    }
  }
  for (const [key, rule] of Object.entries(spec)) {
    const v = value[key];
    const optional = rule.endsWith('?');
    const type = optional ? rule.slice(0, -1) : rule;
    if (v === undefined) {
      if (!optional) errors.push(`${where}: falta o campo obrigatório "${key}"`);
      continue;
    }
    const ok =
      (type === 'string' && typeof v === 'string' && v.trim() !== '') ||
      (type === 'array' && Array.isArray(v)) ||
      (type === 'object' && v !== null && typeof v === 'object' && !Array.isArray(v)) ||
      (type === 'string|boolean' &&
        ((typeof v === 'string' && v.trim() !== '') || typeof v === 'boolean')) ||
      type === 'any';
    if (!ok) errors.push(`${where}: "${key}" deveria ser ${type} não vazio`);
  }
  return true;
}

function checkEnum(where, key, value, allowed) {
  if (value !== undefined && !allowed.includes(value)) {
    errors.push(`${where}: ${key} "${value}" inválido (use: ${allowed.join(', ')})`);
  }
}

// Emoji "figures": counted as user-perceived characters (graphemes), so 🏳️ or 👩‍🏫 count as one.
const segmenter = new Intl.Segmenter('pt', { granularity: 'grapheme' });
// Emojis with words drawn inside them (English text in a figure confuses the learner).
const FORBIDDEN_EMOJI = ['🔜', '🔙', '🔝', '🔛', '🔚', '🆗', '🆕', '🆓', '🆒', '🆙', '🆘'];

function checkEmoji(where, key, value, min, max) {
  if (value === undefined) return;
  if (typeof value !== 'string') return errors.push(`${where}: ${key} deveria ser texto com emoji`);
  const g = [...segmenter.segment(value.replace(/\s+/g, ''))].map((x) => x.segment);
  const bad = g.filter(
    (x) =>
      !/\p{Extended_Pictographic}|\p{Regional_Indicator}|\p{Emoji_Presentation}|\u20E3/u.test(x),
  );
  const banned = g.filter((x) => FORBIDDEN_EMOJI.includes(x.replace(/\uFE0F/g, '')));
  if (banned.length) {
    errors.push(
      `${where}: ${key} "${value}" usa emoji com texto (${banned.join(' ')}); escolha outro`,
    );
  } else if (bad.length)
    errors.push(`${where}: ${key} "${value}" só aceita emojis (achei "${bad.join('')}")`);
  else if (g.length < min || g.length > max) {
    errors.push(
      `${where}: ${key} "${value}" tem ${g.length} emoji(s); use ${min === max ? max : `de ${min} a ${max}`}`,
    );
  }
}

/** Scene illustration name: must exist in ilustracoes/cenas/; embedded later in data.js. */
function checkArt(where, key, name) {
  if (name === undefined) return;
  if (
    typeof name !== 'string' ||
    !/^[a-z0-9-]+$/.test(name) ||
    !existsSync(join(ROOT, 'ilustracoes', 'cenas', `${name}.svg`))
  ) {
    errors.push(`${where}: ${key} "${name}" não existe em ilustracoes/cenas/`);
  } else usedArt.add(name);
}

/**
 * figureStyle "art": the map uses only drawn scenes, so every emoji figure is dropped
 * (lines, nodes, branches, center). The JSON keeps them; only the generated data changes.
 */
function applyFigureStyle(m) {
  if (m.figureStyle !== 'art') return m;
  const out = structuredClone(m);
  delete out.centerFigure;
  for (const b of out.branches) {
    delete b.figure;
    for (const n of b.nodes) {
      delete n.figure;
      for (const l of n.lines) delete l.emoji;
    }
  }
  return out;
}

function validateExercise(where, ex) {
  if (ex === undefined) return;
  if (!checkObject(where, ex, { instruction: 'string', items: 'array' })) return;
  if (!Array.isArray(ex.items)) return;
  if (ex.items.length < 3 || ex.items.length > 6) {
    errors.push(`${where}: ${ex.items.length} itens (use de 3 a 6)`);
  }
  ex.items.forEach((it, i) => {
    const wi = `${where} › item ${i + 1}`;
    if (!checkObject(wi, it, { prompt: 'string', answer: 'string', hintPt: 'string?' })) return;
    const blanks = typeof it.prompt === 'string' ? it.prompt.split('___').length - 1 : 0;
    if (blanks !== 1)
      errors.push(`${wi}: o prompt precisa de exatamente uma lacuna "___" (achei ${blanks})`);
    if (typeof it.answer === 'string' && it.answer.split('|').some((a) => a.trim() === '')) {
      errors.push(`${wi}: resposta com alternativa vazia em "${it.answer}"`);
    }
  });
}

function checkBold(where, text) {
  if (typeof text === 'string' && (text.match(/\*\*/g) || []).length % 2 !== 0) {
    warnings.push(`${where}: "**" sem par em "${text}"`);
  }
}

function validateMap(file, m) {
  const w = rel(file);
  if (
    !checkObject(w, m, {
      id: 'string',
      title: 'string',
      level: 'string',
      collection: 'string',
      center: 'object',
      icon: 'string?',
      intro: 'string?',
      doodle: 'string?',
      centerFigure: 'string?',
      centerArt: 'string?',
      figureStyle: 'string?',
      exercise: 'object?',
      branches: 'array',
    })
  )
    return;
  if (m.id && m.id !== basename(file, '.json')) {
    warnings.push(`${w}: id "${m.id}" diferente do nome do arquivo`);
  }
  checkEnum(w, 'level', m.level, LEVELS);
  checkEnum(w, 'collection', m.collection, MAP_COLLECTIONS);
  checkEnum(w, 'icon', m.icon, ICONS);
  if (m.center) checkObject(`${w} › center`, m.center, { en: 'string', pt: 'string' });
  if (!Array.isArray(m.branches)) return;
  if (m.branches.length === 0) errors.push(`${w}: precisa de pelo menos 1 ramo`);
  if (m.branches.length > MAX_BRANCHES) {
    errors.push(`${w}: ${m.branches.length} ramos (máximo ${MAX_BRANCHES}); divida em dois mapas`);
  }
  let total = 0;
  m.branches.forEach((b, bi) => {
    const wb = `${w} › ramo ${bi + 1}${b && b.label ? ` "${b.label}"` : ''}`;
    if (
      !checkObject(wb, b, {
        label: 'string',
        icon: 'string',
        color: 'string',
        figure: 'string?',
        nodes: 'array',
      })
    )
      return;
    checkEnum(wb, 'icon', b.icon, ICONS);
    checkEmoji(wb, 'figure', b.figure, 1, 3);
    checkEnum(wb, 'color', b.color, COLORS);
    if (!Array.isArray(b.nodes)) return;
    if (b.nodes.length === 0) errors.push(`${wb}: ramo sem cartões`);
    if (b.nodes.length > 5) warnings.push(`${wb}: ${b.nodes.length} cartões (recomendado ≤ 5)`);
    total += b.nodes.length;
    b.nodes.forEach((n, ni) => {
      const wn = `${wb} › cartão ${ni + 1}`;
      if (
        !checkObject(wn, n, {
          tag: 'string',
          title: 'string?',
          figure: 'string?',
          art: 'string?',
          lines: 'array',
        })
      )
        return;
      checkEmoji(wn, 'figure', n.figure, 1, 3);
      checkArt(wn, 'art', n.art);
      if (n.figure && Array.isArray(n.lines) && n.lines.some((l) => l && l.emoji)) {
        warnings.push(`${wn}: tem figure e também emoji nas linhas (figura demais; escolha um)`);
      }
      checkEnum(wn, 'tag', n.tag, TAGS);
      checkBold(wn, n.title);
      if (!Array.isArray(n.lines)) return;
      if (n.lines.length === 0) errors.push(`${wn}: cartão sem linhas`);
      if (n.lines.length > 4) warnings.push(`${wn}: ${n.lines.length} linhas (recomendado ≤ 4)`);
      n.lines.forEach((l, li) => {
        const wl = `${wn} › linha ${li + 1}`;
        if (
          !checkObject(wl, l, {
            en: 'string?',
            pt: 'string?',
            wrong: 'string?',
            right: 'string?',
            note: 'string?',
            emoji: 'string?',
          })
        )
          return;
        if (!l.en && !l.pt && !l.wrong && !l.right && !l.note) {
          errors.push(`${wl}: linha vazia (use en, pt, wrong, right ou note)`);
        }
        for (const k of ['en', 'pt', 'wrong', 'right', 'note']) checkBold(wl, l[k]);
        checkEmoji(wl, 'emoji', l.emoji, 1, 1);
      });
    });
  });
  checkEmoji(w, 'centerFigure', m.centerFigure, 1, 3);
  checkEnum(w, 'figureStyle', m.figureStyle, ['emoji', 'art']);
  checkArt(w, 'centerArt', m.centerArt);
  validateExercise(`${w} › exercise`, m.exercise);
  if (total > MAX_NODES) {
    errors.push(`${w}: ${total} cartões (máximo ${MAX_NODES}); divida em dois mapas`);
  }
  const colors = m.branches.map((b) => b && b.color).filter(Boolean);
  if (new Set(colors).size !== colors.length) warnings.push(`${w}: cor de ramo repetida`);
}

function validateDeck(file, d, seenCards) {
  const w = rel(file);
  if (
    !checkObject(w, d, {
      id: 'string',
      title: 'string',
      collection: 'string',
      level: 'string',
      description: 'string',
      cards: 'array',
    })
  )
    return;
  if (d.id && d.id !== basename(file, '.json')) {
    warnings.push(`${w}: id "${d.id}" diferente do nome do arquivo`);
  }
  checkEnum(w, 'level', d.level, LEVELS);
  checkEnum(w, 'collection', d.collection, DECK_COLLECTIONS);
  if (!Array.isArray(d.cards)) return;
  if (d.cards.length === 0) errors.push(`${w}: baralho sem cartas`);
  d.cards.forEach((c, ci) => {
    const wc = `${w} › carta ${ci + 1}${c && c.id ? ` "${c.id}"` : ''}`;
    if (
      !checkObject(wc, c, {
        id: 'string',
        en: 'string',
        emoji: 'string',
        pt: 'string',
        example: 'object?',
        pronunciation: 'string?',
        situation: 'string?',
        level: 'string',
        formality: 'string?',
        dontUse: 'string?',
        falseFriend: 'string|boolean?',
        baseVerb: 'string?',
      })
    )
      return;
    checkEnum(wc, 'level', c.level, LEVELS);
    checkEnum(wc, 'formality', c.formality, FORMALITY);
    if (c.example) checkObject(`${wc} › example`, c.example, { en: 'string', pt: 'string' });
    if (c.id) {
      if (seenCards.has(c.id)) {
        errors.push(`${wc}: id repetido (já usado em ${seenCards.get(c.id)})`);
      } else seenCards.set(c.id, w);
    }
  });
}

const mapSrc = pickSource('mapas');
const deckSrc = pickSource('cartas');

const maps = [];
const seenMapIds = new Map();
for (const file of mapSrc.files) {
  const m = readJson(file);
  if (!m) continue;
  const before = errors.length;
  validateMap(file, m);
  if (m.id && seenMapIds.has(m.id)) errors.push(`${rel(file)}: id "${m.id}" repetido`);
  seenMapIds.set(m.id, file);
  if (errors.length === before) maps.push(applyFigureStyle(m));
}

// Scene illustrations referenced by nodes (`art`): embedded in data.js so file:// works.
const art = {};
for (const name of [...usedArt].sort()) {
  art[name] = readFileSync(join(ROOT, 'ilustracoes', 'cenas', `${name}.svg`), 'utf8')
    .replace(/\s*\n\s*/g, '')
    .replace(/ width="160" height="160"/, '');
}

const decks = [];
const seenCards = new Map();
const seenDeckIds = new Set();
for (const file of deckSrc.files) {
  const d = readJson(file);
  if (!d) continue;
  const before = errors.length;
  validateDeck(file, d, seenCards);
  if (d.id && seenDeckIds.has(d.id)) errors.push(`${rel(file)}: id "${d.id}" repetido`);
  seenDeckIds.add(d.id);
  if (errors.length === before) decks.push(d);
}

const levelOrder = (a, b) => LEVELS.indexOf(a.level) - LEVELS.indexOf(b.level);
maps.sort(levelOrder);
decks.sort(levelOrder);

for (const w of warnings) console.warn(`aviso: ${w}`);
if (errors.length > 0) {
  for (const e of errors) console.error(`erro: ${e}`);
  console.error(`\n${errors.length} erro(s). data.js NÃO foi gerado.`);
  process.exit(1);
}

const collections = COLLECTIONS.map((c) => {
  const cm = maps.filter((m) => m.collection === c.id).map((m) => m.id);
  const cd = decks.filter((d) => d.collection === c.id).map((d) => d.id);
  const levels = new Set([
    ...maps.filter((m) => m.collection === c.id).map((m) => m.level),
    ...decks.filter((d) => d.collection === c.id).map((d) => d.level),
  ]);
  return { ...c, maps: cm, decks: cd, levels: LEVELS.filter((l) => levels.has(l)) };
});

const data = {
  source: { maps: mapSrc.from, decks: deckSrc.from },
  collections,
  maps,
  decks,
  art,
};

const out = `// Generated by build.mjs. Do not edit by hand.\nwindow.FALAE_PROTO = ${JSON.stringify(data, null, 1)};\n`;
writeFileSync(join(ROOT, 'data.js'), out);
const nCards = decks.reduce((s, d) => s + d.cards.length, 0);
console.log(
  `data.js gerado: ${maps.length} mapa(s) de ${mapSrc.from}, ${decks.length} baralho(s) / ${nCards} carta(s) de ${deckSrc.from}` +
    (warnings.length ? ` (${warnings.length} aviso(s))` : ''),
);
