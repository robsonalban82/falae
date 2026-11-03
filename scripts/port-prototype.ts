/**
 * One-off port of the approved prototype (prototipo/mapas-e-cartas) to src/content/
 * (MAPAS-E-CARTAS §12). Throwaway: removed in the next commit. Run: npx tsx scripts/port-prototype.ts
 * Does not invent content: only maps fields; everything else goes to the printed report.
 */
import { copyFileSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { format, resolveConfig } from 'prettier';
import { normalizeMapEn } from '../src/content/mindmapIssues';

const root = join(import.meta.dirname, '..');
const proto = join(root, 'prototipo', 'mapas-e-cartas');
const out = join(root, 'src', 'content');
const REPORT_PATH =
  '/private/tmp/claude-501/-Users-robsonalban-claud-lavoro-Curso-ingles/cb353bbb-ff37-4865-83b6-b9dca2de578f/scratchpad/port-report.txt';

type Json = Record<string, unknown>;
const readJson = (path: string): Json => JSON.parse(readFileSync(path, 'utf8')) as Json;
const lines: string[] = [];
const say = (s = '') => lines.push(s);

async function writeJson(path: string, data: unknown) {
  const config = (await resolveConfig(path)) ?? {};
  writeFileSync(path, await format(JSON.stringify(data), { ...config, parser: 'json' }));
}

// ---------- existing unit items ----------
type Item = { id: string; en: string; pt: string; level: string; unit?: string };
const unitItems = new Map<string, Item>();
for (const f of readdirSync(join(out, 'units'))
  .filter((x) => x.endsWith('.json'))
  .sort()) {
  const unit = readJson(join(out, 'units', f)) as {
    id: string;
    level: string;
    skills: { vocab: Json[]; sentences: Json[] }[];
  };
  for (const skill of unit.skills) {
    for (const it of [...skill.vocab, ...skill.sentences]) {
      const pt = Array.isArray(it.pt) ? (it.pt as string[]).join(', ') : (it.pt as string);
      unitItems.set(it.id as string, {
        id: it.id as string,
        en: it.en as string,
        pt,
        level: unit.level,
        unit: unit.id,
      });
    }
  }
}

// ---------- cards ----------
const EXPECTED_DUPES: Record<string, string> = {
  'fc-001': 'u1-actually',
  'fc-002': 'u4-pretend',
  'fc-003': 'u3-push',
  'fc-005': 'u2-parents',
  'fr-001': 'u1-s-nice-to-meet-you',
  'pv-001': 'u4-get-up',
};
const difficultyOf = (level: string) => ({ A1: 1, A2: 2, B1: 3 })[level] ?? 2;
const slug = (s: string) =>
  s
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

type Card = {
  id: string;
  en: string;
  emoji?: string;
  pt: string;
  example?: { en: string; pt: string };
  pronunciation?: string;
  situation?: string;
  level: string;
  formality?: string;
  dontUse?: string;
  falseFriend?: string | boolean;
  baseVerb?: string;
};
type Deck = { title: string; description: string; level: string; cards: Card[] };

const DECKS = {
  frases: { file: 'frases-dia-a-dia', bank: 'frases', kind: 'sentence' },
  expressoes: { file: 'expressoes-e-girias', bank: 'expressoes', kind: 'sentence' },
  phrasal: { file: 'phrasal-essenciais', bank: 'phrasal', kind: 'vocab' },
  'falsos-cognatos': { file: 'falsos-cognatos', bank: 'falsos-cognatos', kind: 'vocab' },
} as const;
type DeckKey = keyof typeof DECKS;

const report = {
  dupes: [] as string[],
  dupeMismatch: [] as string[],
  falseFriendEmpty: [] as string[],
  noColon: [] as string[],
  difficulty: new Map<string, number>(),
  refPtDiff: [] as string[],
  vocabNoItem: [] as string[],
  refCounts: [] as string[],
  mapsUnder4: [] as string[],
  extraDupesDetected: [] as string[],
};

const collectionDefs: Record<
  DeckKey,
  { order: number; kind: string; subtitle: string; icon: string; color: string }
> = {
  phrasal: {
    order: 1,
    kind: 'phrasal-verbs',
    subtitle: 'Verbo + partícula',
    icon: 'swap',
    color: 'jabuticaba',
  },
  frases: {
    order: 2,
    kind: 'phrases',
    subtitle: 'Prontas para usar',
    icon: 'chat',
    color: 'folha',
  },
  expressoes: {
    order: 3,
    kind: 'expressions',
    subtitle: 'Fale como nativo',
    icon: 'star',
    color: 'manga',
  },
  'falsos-cognatos': {
    order: 4,
    kind: 'false-friends',
    subtitle: 'Parece, mas não é',
    icon: 'ban',
    color: 'acerola',
  },
};

const bankItemsByEn = new Map<string, string>(); // normalized en -> bank item id (non-dupe cards)
const bankPt = new Map<string, string>();
const collections: Json[] = [];
const topicTitles = new Map<string, string>(); // slug -> original prefix
const itemLevelOverrides: string[] = [];

for (const [key, def] of Object.entries(DECKS) as [DeckKey, (typeof DECKS)[DeckKey]][]) {
  const deck = readJson(join(proto, 'conteudo', 'cartas', `${def.file}.json`)) as unknown as Deck;
  const vocab: Json[] = [];
  const sentences: Json[] = [];
  const entries: Json[] = [];

  for (const c of deck.cards) {
    const unitDupe = EXPECTED_DUPES[c.id];
    const detected = [...unitItems.values()].find(
      (u) => normalizeMapEn(u.en) === normalizeMapEn(c.en),
    );
    if (detected && detected.id !== unitDupe) {
      report.extraDupesDetected.push(`${c.id} "${c.en}" repete ${detected.id} (fora da lista)`);
    }
    if (unitDupe && detected?.id !== unitDupe) {
      report.dupeMismatch.push(`${c.id}: esperado ${unitDupe}, achado ${detected?.id ?? 'nenhum'}`);
    }

    // collection entry fields
    const entry: Json = { itemId: unitDupe ?? c.id };
    if (key === 'frases') {
      const idx = c.situation?.indexOf(':') ?? -1;
      if (!c.situation || idx < 0) {
        report.noColon.push(`${c.id}: situation "${c.situation ?? ''}" sem ":"`);
        if (c.situation) entry.situation = c.situation;
      } else {
        const prefix = c.situation.slice(0, idx).trim();
        entry.topic = slug(prefix);
        topicTitles.set(slug(prefix), prefix);
        entry.situation = c.situation.slice(idx + 1).trim();
      }
    }
    if (key === 'expressoes') {
      if (c.situation) entry.situation = c.situation;
      entry.formality = c.formality;
      if (c.dontUse) entry.avoidWhen = c.dontUse;
    }
    if (key === 'phrasal') entry.baseVerb = c.baseVerb;
    entries.push(entry);

    if (unitDupe) {
      const u = unitItems.get(unitDupe);
      report.dupes.push(
        `${c.id} -> ${unitDupe}  (pt carta: "${c.pt}" | pt item: "${u?.pt}"; nível carta ${c.level} | unidade ${u?.level})`,
      );
      continue; // item stays in the unit
    }

    // bank item
    const ff = typeof c.falseFriend === 'string' ? c.falseFriend.trim() : '';
    if (key === 'falsos-cognatos' && !ff) {
      report.falseFriendEmpty.push(`${c.id} "${c.en}" (falseFriend=${String(c.falseFriend)})`);
    }
    const level = c.level;
    const effective = level ?? deck.level;
    const difficulty = difficultyOf(effective);
    report.difficulty.set(effective, (report.difficulty.get(effective) ?? 0) + 1);
    const item: Json = { id: c.id, en: c.en };
    if (def.kind === 'vocab') item.pt = [c.pt];
    else item.pt = c.pt;
    if (c.example) item.example = c.example;
    if (c.emoji) item.emoji = c.emoji;
    if (c.pronunciation) item.pronunciation = c.pronunciation;
    item.difficulty = difficulty;
    if (key === 'falsos-cognatos') {
      item.focus = 'falso-cognato';
      if (ff) item.notes = ff;
    }
    if (level && level !== deck.level) {
      item.level = level;
      itemLevelOverrides.push(`${c.id} ${level} (banco ${deck.level})`);
    }
    (def.kind === 'vocab' ? vocab : sentences).push(item);
    bankItemsByEn.set(normalizeMapEn(c.en), c.id);
    bankPt.set(c.id, c.pt);
  }

  await mkdirSync(join(out, 'banks'), { recursive: true });
  await writeJson(join(out, 'banks', `${def.bank}.json`), {
    id: def.bank,
    title: deck.title,
    level: deck.level,
    vocab,
    sentences,
  });

  const cd = collectionDefs[key];
  const col: Json = {
    id: key,
    order: cd.order,
    kind: cd.kind,
    title: deck.title,
    subtitle: cd.subtitle,
    description: deck.description,
    cover: { icon: cd.icon, color: cd.color, paper: 'pautado' }, // paper: PROVISIONAL
  };
  if (key === 'frases') {
    col.topics = [...topicTitles].map(([id, title]) => ({ id, title, icon: 'chat' })); // icon: PROVISIONAL
  }
  col.entries = entries;
  if (key === 'phrasal') col.mapIds = ['mm-phrasal-get'];
  if (key === 'falsos-cognatos') col.mapIds = ['mm-falsos-cognatos-1'];
  collections.push(col);
}
collections.sort((a, b) => (a.order as number) - (b.order as number));

for (const [id, title, level] of [
  ['extra-a1', 'Extras A1', 'A1'],
  ['extra-a2', 'Extras A2', 'A2'],
] as const) {
  await writeJson(join(out, 'banks', `${id}.json`), { id, title, level, vocab: [], sentences: [] });
}
await writeJson(join(out, 'collections.json'), collections);
await writeJson(join(out, 'decks.json'), []);

// ---------- maps ----------
const KIND: Record<string, string> = {
  'to-be': 'gramatica',
  'in-on-at': 'gramatica',
  'numeros-e-horas': 'vocabulario',
  'falsos-cognatos-1': 'vocabulario',
  'phrasal-get': 'vocabulario',
  'skill-u1-sk1': 'conversacao',
};
const stripBold = (s: string) => s.replace(/\*\*/g, '');
// Unit items win over bank items (same as buildMindMapContext's "first wins").
const refTarget = (en: string): { id: string; pt: string } | undefined => {
  const n = normalizeMapEn(en);
  for (const u of unitItems.values()) if (normalizeMapEn(u.en) === n) return { id: u.id, pt: u.pt };
  const b = bankItemsByEn.get(n);
  return b ? { id: b, pt: bankPt.get(b) ?? '' } : undefined;
};

type ProtoLine = Json & { en?: string; pt?: string; right?: string; wrong?: string; note?: string };
const artUsed = new Set<string>();
mkdirSync(join(out, 'mindmaps'), { recursive: true });
for (const f of readdirSync(join(proto, 'conteudo', 'mapas')).sort()) {
  const m = readJson(join(proto, 'conteudo', 'mapas', f)) as Json & {
    id: string;
    branches: { label: string; icon: string; color: string; nodes: Json[] }[];
    exercise?: {
      instruction: string;
      items: { prompt: string; answer: string; hintPt?: string }[];
    };
  };
  const isSkill = m.id === 'skill-u1-sk1';
  const newId = isSkill ? 'mm-u1-sk1' : `mm-${m.id}`;
  const refs = new Set<string>();

  const branches = m.branches.map((b) => ({
    label: b.label,
    icon: b.icon,
    color: b.color,
    nodes: b.nodes.map((n) => {
      const node = n as Json & { tag: string; title?: string; art?: string; lines: ProtoLine[] };
      if (node.art) artUsed.add(node.art);
      const newLines = node.lines.map((l): Json => {
        if (l.en !== undefined) {
          const t = refTarget(l.en);
          if (t) {
            refs.add(t.id);
            if (l.pt !== undefined && l.pt.trim() !== t.pt.trim()) {
              report.refPtDiff.push(
                `${newId} › "${l.en}" -> ${t.id}: protótipo "${l.pt}" | item "${t.pt}"`,
              );
            }
            return { ref: t.id };
          }
          if (node.tag === 'vocabulario' && l.pt !== undefined) {
            report.vocabNoItem.push(
              `${newId} › ramo "${b.label}": "${stripBold(l.en)}" = "${l.pt}"`,
            );
          }
          const o: Json = { en: l.en };
          if (l.pt !== undefined) o.pt = l.pt;
          return o;
        }
        if (l.wrong !== undefined || l.right !== undefined) {
          if (l.wrong === undefined) return { en: l.right }; // right-only line (etapa 3)
          const o: Json = { wrong: l.wrong, right: l.right };
          if (l.note !== undefined) o.note = l.note;
          return o;
        }
        return { note: l.note };
      });
      const o: Json = { tag: node.tag };
      if (node.title !== undefined) o.title = node.title;
      if (node.art) o.art = node.art;
      o.lines = newLines;
      return o;
    }),
  }));
  if (m.centerArt) artUsed.add(m.centerArt as string);

  const map: Json = { id: newId, title: m.title, level: m.level, kind: KIND[m.id], icon: m.icon };
  if (isSkill) {
    map.unitId = 'u1-unit';
    map.skillId = 'u1-sk1';
  }
  map.center = m.center;
  if (m.centerArt) map.centerArt = m.centerArt;
  if (m.intro) map.intro = m.intro;
  if (m.doodle) map.doodle = m.doodle;
  map.branches = branches;
  if (m.exercise) {
    map.quiz = {
      instruction: m.exercise.instruction,
      items: m.exercise.items.map((it) => {
        const o: Json = { prompt: it.prompt, accepted: it.answer.split('|') };
        if (it.hintPt) o.hintPt = it.hintPt;
        return o;
      }),
    };
  }
  await writeJson(join(out, 'mindmaps', `${newId}.json`), map);
  report.refCounts.push(`${newId}: ${refs.size} ref distintos`);
  if (refs.size < 4) report.mapsUnder4.push(`${newId} (${refs.size})`);
}

// ---------- art ----------
const artSrc = join(proto, 'ilustracoes', 'cenas');
mkdirSync(join(out, 'art'), { recursive: true });
const svgs = readdirSync(artSrc).filter((f) => f.endsWith('.svg'));
for (const f of svgs) copyFileSync(join(artSrc, f), join(out, 'art', f));
const unusedArt = svgs.map((f) => f.slice(0, -4)).filter((n) => !artUsed.has(n));
const missingArt = [...artUsed].filter((n) => !svgs.includes(`${n}.svg`));

// ---------- report ----------
const list = (title: string, items: string[]) => {
  say(`## ${title} (${items.length})`);
  for (const i of items) say(`- ${i}`);
  if (items.length === 0) say('- nenhum');
  say();
};
say('RELATÓRIO DO PORT (prototipo -> src/content)');
say();
list('Cartas que viram entrada para item de unidade', report.dupes);
list('Divergência na lista de 6 repetidas', report.dupeMismatch);
list('Outras repetições detectadas (não estavam na lista)', report.extraDupesDetected);
list('Linhas trocadas por ref com pt diferente do item', report.refPtDiff);
list('Linhas de vocabulário sem item', report.vocabNoItem);
list('ref distintos por mapa', report.refCounts);
list('Mapas com menos de 4 ref', report.mapsUnder4);
list('falseFriend sem texto', report.falseFriendEmpty);
say(
  `## difficulty atribuída por nível (A1->1, A2->2, B1->3): ${[...report.difficulty]
    .map(([l, n]) => `${l}=${n}`)
    .join(', ')}`,
);
say();
list('Itens com level próprio (difere do banco)', itemLevelOverrides);
list('situation de frase sem ":"', report.noColon);
const topics = [...topicTitles];
list(
  'Tópicos derivados de situation (frases) - unificar',
  topics.map(([id, title]) => {
    const similar = topics.filter(([o]) => o !== id && (o.startsWith(id) || id.startsWith(o)));
    return `${id} = "${title}"${similar.length ? `  <-- parecido com: ${similar.map(([o]) => o).join(', ')}` : ''}`;
  }),
);
say('## Valores PROVISÓRIOS a definir pelo autor/designer');
say(
  `- collections.json › frases › topics[*].icon = "chat" em todos os ${topics.length} tópicos; title = texto antes de ":" da situation`,
);
say('- collections.json › cover.paper = "pautado" nas 4 coleções');
say(
  '- extra-a1.json / extra-a2.json: vazios (vocab: [], sentences: []); title "Extras A1/A2" provisório',
);
say('- subtitle das coleções vem do build.mjs do protótipo; description do baralho');
say();
list('Cenas', [
  `${svgs.length} copiadas para src/content/art/`,
  `usadas pelos mapas: ${artUsed.size}`,
  `sem uso: ${unusedArt.join(', ') || 'nenhuma'}`,
  `faltando: ${missingArt.join(', ') || 'nenhuma'}`,
]);

const text = lines.join('\n');
console.log(text);
writeFileSync(REPORT_PATH, text + '\n');
