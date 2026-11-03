import { normalize } from '../domain/grading/normalize';
import { stripBold } from '../domain/mindmap/richText';
import { levelRank, type CefrLevel, type Unit } from './schema';
import type { Bank } from './schemas/course';
import type { MindMap } from './schemas/mindmap';

/** Above these a card or branch is hard to read (warning, not error; GRAMATICA-VISUAL.md). */
export const WARN_NODES_PER_BRANCH = 5;
export const WARN_LINES_PER_NODE = 4;

export type ContentIssues = { errors: string[]; warnings: string[] };

/**
 * What mindMapIssues needs to know about the rest of the content. Structural and minimal,
 * so the rules stay pure and testable without loading any file.
 */
export type MindMapContext = {
  /** Every unit and bank item: normalized `en`, effective level and owning unit (if any). */
  items: ReadonlyMap<string, { en: string; level: CefrLevel; unitId?: string }>;
  /** Normalized `en` → first item id with it (for the "use ref" rule). */
  byEn: ReadonlyMap<string, string>;
  /** Units in path order, with their skill ids. */
  units: readonly { id: string; skillIds: readonly string[] }[];
  /** Scene names available in src/content/art/ (without ".svg"). */
  art: ReadonlySet<string>;
};

/** Comparable form of an English map text (bold markers removed). */
export const normalizeMapEn = (text: string) => normalize(stripBold(text), 'en');

export function buildMindMapContext(input: {
  units: readonly Unit[];
  banks: readonly Bank[];
  art: Iterable<string>;
}): MindMapContext {
  const items = new Map<string, { en: string; level: CefrLevel; unitId?: string }>();
  const units = [...input.units].sort((a, b) => a.order - b.order);
  for (const unit of units) {
    for (const skill of unit.skills) {
      for (const item of [...skill.vocab, ...skill.sentences]) {
        items.set(item.id, { en: normalizeMapEn(item.en), level: unit.level, unitId: unit.id });
      }
    }
  }
  for (const bank of input.banks) {
    for (const item of [...bank.vocab, ...bank.sentences]) {
      items.set(item.id, { en: normalizeMapEn(item.en), level: item.level ?? bank.level });
    }
  }
  const byEn = new Map<string, string>();
  for (const [id, item] of items) if (!byEn.has(item.en)) byEn.set(item.en, id);
  return {
    items,
    byEn,
    units: units.map((u) => ({ id: u.id, skillIds: u.skills.map((s) => s.id) })),
    art: new Set(input.art),
  };
}

/** Rules of §2.5 that need the rest of the content (the schema checks the map by itself). */
export function mindMapIssues(map: MindMap, ctx: MindMapContext): ContentIssues {
  const errors: string[] = [];
  const warnings: string[] = [];
  // 7. skillId belongs to unitId
  const unitIndex = map.unitId ? ctx.units.findIndex((u) => u.id === map.unitId) : -1;
  if (map.unitId && unitIndex < 0) errors.push(`A unidade "${map.unitId}" não existe.`);
  if (map.skillId && unitIndex >= 0 && !ctx.units[unitIndex]?.skillIds.includes(map.skillId)) {
    errors.push(`A habilidade "${map.skillId}" não pertence à unidade "${map.unitId}".`);
  }

  // 3. scenes exist
  const checkArt = (art: string | undefined, where: string) => {
    if (art && !ctx.art.has(art)) errors.push(`${where}: a cena "${art}" não existe em art/.`);
  };
  checkArt(map.centerArt, 'centro');

  map.branches.forEach((branch, bi) => {
    const wb = `ramo ${bi + 1} "${branch.label}"`;
    // 1. readability limits
    if (branch.nodes.length > WARN_NODES_PER_BRANCH) {
      warnings.push(
        `${wb}: ${branch.nodes.length} cartões (recomendado até ${WARN_NODES_PER_BRANCH}).`,
      );
    }
    branch.nodes.forEach((node, ni) => {
      const wn = `${wb} › cartão ${ni + 1}`;
      checkArt(node.art, wn);
      if (node.lines.length > WARN_LINES_PER_NODE) {
        warnings.push(
          `${wn}: ${node.lines.length} linhas (recomendado até ${WARN_LINES_PER_NODE}).`,
        );
      }
      node.lines.forEach((line, li) => {
        const wl = `${wn} › linha ${li + 1}`;
        if ('ref' in line) {
          // 4. ref exists and fits the map's place in the path
          const item = ctx.items.get(line.ref);
          if (!item) {
            errors.push(`${wl}: o item "${line.ref}" não existe.`);
            return;
          }
          if (unitIndex < 0) return;
          if (item.unitId) {
            const itemUnit = ctx.units.findIndex((u) => u.id === item.unitId);
            if (itemUnit > unitIndex) {
              warnings.push(
                `${wl}: "${line.ref}" é da unidade "${item.unitId}", depois de "${map.unitId}".`,
              );
            }
          } else if (levelRank(item.level) > levelRank(map.level)) {
            warnings.push(
              `${wl}: "${line.ref}" é ${item.level}, acima do nível do mapa (${map.level}).`,
            );
          }
        } else if ('en' in line) {
          // 5. no duplicated items
          const same = ctx.byEn.get(normalizeMapEn(line.en));
          if (same) errors.push(`${wl}: "${line.en}" já é o item "${same}"; use ref.`);
        }
      });
    });
  });
  return { errors, warnings };
}

/** Rules across all map files: id = file name, unique ids, at most one map per skill. */
export function mindMapSetIssues(
  entries: readonly { file: string; map: Pick<MindMap, 'id' | 'skillId'> }[],
): string[] {
  const issues: string[] = [];
  const ids = new Set<string>();
  const skills = new Map<string, string>();
  for (const { file, map } of entries) {
    if (file !== `${map.id}.json`) {
      issues.push(`${file}: o id "${map.id}" precisa ser igual ao nome do arquivo.`);
    }
    if (ids.has(map.id)) issues.push(`Mapa repetido: "${map.id}".`);
    ids.add(map.id);
    if (!map.skillId) continue;
    const other = skills.get(map.skillId);
    if (other) {
      issues.push(`A habilidade "${map.skillId}" já tem o mapa "${other}" (e "${map.id}").`);
    } else skills.set(map.skillId, map.id);
  }
  return issues;
}

/** Scenes in art/ that no map uses (warning). */
export function unusedArt(
  maps: readonly Pick<MindMap, 'centerArt' | 'branches'>[],
  art: Iterable<string>,
): string[] {
  const used = new Set<string>();
  for (const map of maps) {
    if (map.centerArt) used.add(map.centerArt);
    for (const b of map.branches) for (const n of b.nodes) if (n.art) used.add(n.art);
  }
  return [...art].filter((name) => !used.has(name)).map((name) => `Cena sem uso: "${name}".`);
}
