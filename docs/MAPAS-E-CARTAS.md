# Mapas mentais e cartas — plano técnico

> Status: **proposta (Fase 1 do recurso)**, aguardando aprovação do usuário (lista no §11).
> Dono: agente `arquiteto`. Complementa `docs/ARQUITETURA.md`. Quando aprovado, as seções viram parte da arquitetura (§4, §7, §8, §11, §13).
> Referência de formato: um kit comercial de mapas mentais de inglês com estética de caderno, usado **só** como ideia de formato e público. Nenhum texto, nome, ilustração ou layout é copiado. Os revisores conferem isso.

## 1. O que existe e o que vamos reaproveitar

| Existe hoje                                                                                                                                              | Reaproveitamento                                                                                                             |
| -------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| 4 unidades A1 (`u1`–`u4`), 16 habilidades, 48 lições + 4 revisões, **240 itens** (131 vocab, 109 frases) com `focus` (falso-cognato, make-do, in-on-at…) | Os mapas das habilidades e as cartas por unidade **referenciam esses ids**. Nada é copiado.                                  |
| Schema Zod estrito (`z.strictObject`, ADR-005), `courseIssues`, `validate:content`, manifesto gerado (ADR-012)                                           | Os novos formatos seguem o mesmo padrão: estrito, com validação cruzada no `validate:content` e um manifesto leve estendido. |
| SRS SM-2 (`domain/srs/sm2.ts`): um `SrsCard` por `itemId`, `applyOutcomes` (menor `q` da sessão), regras de mesmo dia, `isLearned`                       | **Único algoritmo.** Carta = item. Só muda o mapeamento das notas para `q` (§3).                                             |
| `generatePractice` (12 exercícios, por seed, sem `speak`/`fill-blank`) e corretor (`grading/`)                                                           | "Praticar este mapa" e o modo "digitar" das cartas.                                                                          |
| `recordLessonResult` transacional com `apply` puro (ADR-008/011)                                                                                         | As sessões de cartas e de mapa entram como novos `kind` (§4.4).                                                              |
| XP, ofensiva, meta, conquistas declarativas                                                                                                              | Novos valores e 5 conquistas novas (§4.5).                                                                                   |
| Tuca em WebP por humor (ADR-014), tokens AA (`tokens.test.ts`), Fredoka + Atkinson                                                                       | Telas novas usam os mesmos humores; o caderno é uma camada de tokens por cima (§8).                                          |
| Export/import JSON `schemaVersion: 1`                                                                                                                    | Vai para `schemaVersion: 2` e continua lendo arquivos v1 (§4.3).                                                             |

O que **não** existe: nível CEFR no conteúdo, itens fora das unidades, pronúncia simplificada, layout de grafo, pan/zoom, impressão. Também não há conteúdo A2.

## 2. Formato do conteúdo

### 2.1 Pastas e ids

```
src/content/
  units/u0N-*.json        # + campo level (obrigatório)
  banks/<id>.json         # itens que NÃO estão nas unidades (frases, phrasal, expressões, extras)
  mindmaps/mm-<slug>.json # um mapa por arquivo
  collections.json        # as 5 coleções (capas, tópicos, entradas)
  decks.json              # baralhos temáticos escritos à mão
  plans/pl-30d.json       # plano de 30 dias
```

| Prefixo                 | Uso                                                               | Exemplo                      |
| ----------------------- | ----------------------------------------------------------------- | ---------------------------- |
| `uN-`                   | itens, habilidades e lições das unidades (já existe)              | `u1-hi`                      |
| `fr-` `pv-` `ex-` `xa-` | itens dos bancos: frases, phrasal verbs, expressões, extras A1/A2 | `pv-get-up`, `xa-actually`   |
| `mm-`                   | mapa mental (ids de nó são locais ao mapa)                        | `mm-to-be` / nó `contracoes` |
| `dk-`                   | baralho temático                                                  | `dk-false-friends`           |
| `pl-`                   | plano de estudos                                                  | `pl-30d`                     |
| `uc-`                   | carta do aluno (**reservado**: proibido no conteúdo)              | `uc-k3f9a2d1`                |

**Regra central: só existe um lugar para cada item estudável.** Os itens vivem nas unidades ou nos bancos. Mapas, coleções, baralhos e plano apenas **referenciam** `itemId`. É isso que permite o SRS único (§3).

### 2.2 Nível CEFR

```ts
export const cefrLevels = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'] as const;
export const levelSchema = z.enum(cefrLevels);
```

- `unitSchema` ganha `level` **obrigatório**: as 4 unidades recebem `"level": "A1"` (edição mecânica, Fase 2). Os itens herdam o nível do arquivo que os contém (unidade ou banco), sem campo por item.
- Bancos, mapas, baralhos temáticos e plano têm `level` próprio.
- A interface mostra filtros e selos só para os níveis que têm conteúdo. O schema já aceita A1–C2.

### 2.3 Itens: dois campos opcionais novos

```ts
// vocabItemSchema e sentenceSchema
pronunciation: z.string().trim().min(1).max(40).optional(), // "rélou", convenção no §10 (risco)
```

O aviso de "cuidado" com falso cognato **não ganha campo novo**: ele aparece quando `focus === 'falso-cognato'`, com o texto de `notes`. O validador passa a exigir `notes` em vocab com esse `focus` (as frases mostram o aviso do item de vocab relacionado, se houver).

### 2.4 Bancos de itens

```ts
export const bankSchema = z.strictObject({
  id, // 'frases' | 'phrasal' | 'expressoes' | 'extra-a1' | 'extra-a2'
  title: text,
  level: levelSchema,
  vocab: z.array(vocabItemSchema),
  sentences: z.array(sentenceSchema),
});
```

Os bancos usam **os mesmos schemas** de item das unidades. Assim, `indexUnits`, `toPracticeItem`, `generatePractice` e o corretor funcionam sem mudança. Os ids são globais: `courseIssues` passa a checar unicidade entre unidades e bancos.

### 2.5 Mapa mental

```ts
export const mapNodeTags = ['regra', 'exemplo', 'excecao', 'erro-comum', 'vocabulario'] as const;
export const branchColors = ['manga', 'anil', 'folha', 'acerola', 'maracuja', 'jambo'] as const; // tokens §8

const mapNodeBase = z.strictObject({
  id,                                   // local ao mapa
  tag: z.enum(mapNodeTags),
  ref: id.optional(),                   // item de unidade/banco: en/pt/exemplo vêm dele
  en: text.optional(),                  // rótulo próprio (regras, títulos de ramo)
  pt: text.optional(),
  example: z.strictObject({ en: text, pt: text }).optional(),
  icon: z.string().max(16).optional(),  // emoji ou chave do conjunto de ícones desenhados
});
type MapNode = z.infer<typeof mapNodeBase> & { children?: MapNode[] }; // z.lazy

export const mindMapSchema = z.strictObject({
  id,                                   // 'mm-…'
  title: text,                          // PT
  level: levelSchema,
  kind: z.enum(['gramatica', 'vocabulario', 'conversacao']),
  unitId: id.optional(),
  skillId: id.optional(),
  center: z.strictObject({ en: text, pt: text.optional(), icon: z.string().optional() }),
  branches: z.array(mapNodeBase.extend({ color: z.enum(branchColors), children: … })).min(2).max(6),
});
```

Validações (`mindMapIssues`, puras, rodam no `validate:content` e no carregamento):

1. Limites: de 2 a **6 ramos** principais, profundidade de **3 níveis** abaixo do centro, no máximo **30 nós** (erro) e aviso acima de 25 (a skill pede cerca de 25). Até 6 filhos por nó.
2. Um nó tem `ref` **ou** `en`, nunca os dois (assim o rótulo não diverge do item). Com `ref`, `pt` e `example` são proibidos.
3. `ref` precisa existir em uma unidade ou banco. Se o mapa tem `unitId`, os `ref` vêm dessa unidade, de unidades anteriores ou de bancos de nível ≤ ao do mapa (aviso, e o pedagogo decide).
4. **Sem duplicar**: um nó com `en` cuja forma normalizada é igual ao `en` de um item existente vira erro, com a mensagem "use ref".
5. Cada mapa precisa de pelo menos **4 nós com `ref`**, para que "Praticar este mapa" sempre funcione.
6. Ids de nó são únicos no mapa. `skillId` pertence a `unitId`. Cores de ramo não se repetem.
7. Mapas de habilidade: no máximo 1 mapa por `skillId`.

### 2.6 Coleções, baralhos e plano

```ts
export const collectionSchema = z.strictObject({
  id, // 'mapas' | 'frases' | 'phrasal' | 'expressoes' | 'plano'
  order: z.number().int().positive(),
  kind: z.enum(['mindmaps', 'phrases', 'phrasal-verbs', 'expressions', 'study-plan']),
  title: text,
  subtitle: text,
  cover: z.strictObject({
    icon: text,
    color: z.enum(branchColors),
    paper: z.enum(['pautado', 'quadriculado', 'pontilhado']),
  }),
  topics: z.array(z.strictObject({ id, title: text, icon: text })).optional(),
  entries: z.array(collectionEntrySchema).optional(), // phrases / phrasal / expressions
  mapIds: z.array(id).optional(), // phrasal: os 5 mapas por verbo
  planId: id.optional(),
});

/** How an item is PRESENTED in a collection. The item itself stays in its unit/bank. */
export const collectionEntrySchema = z.strictObject({
  itemId: id,
  topic: id,
  situation: text.optional(), // PT: quando usar ("Ao pedir a conta")
  formality: z.enum(['informal', 'neutro', 'giria']).optional(),
  avoidWhen: text.optional(), // PT: quando NÃO usar
  baseVerb: z.enum(['get', 'take', 'go', 'put', 'look']).optional(),
});

export const deckSchema = z.strictObject({
  id,
  title: text,
  icon: text,
  level: levelSchema,
  description: text.optional(),
  itemIds: z.array(id).min(5).max(60),
});

export const studyPlanSchema = z.strictObject({
  id,
  title: text,
  level: levelSchema,
  days: z
    .array(
      z.strictObject({
        day: z.number().int().min(1).max(30),
        title: text,
        mapId: id,
        itemIds: z.array(id).min(5).max(12), // cartas do dia
        lessonId: id,
      }),
    )
    .length(30),
});
```

Regras por `kind`: `phrases` tem 150 entradas em 6 tópicos (cumprimentos, restaurante, compras, trabalho, viagem, emergências) e `situation` obrigatória. `phrasal-verbs` tem 40 entradas, 8 por `baseVerb`, e 5 `mapIds`. `expressions` tem 50 entradas, com `formality` obrigatória e `avoidWhen` obrigatório quando `formality` não é `neutro`. Uma entrada pode apontar para um item de unidade (ex.: `u3-s-the-check-please`): a anotação fica na coleção, o item continua um só. No plano, os dias vão de 1 a 30 sem repetição, `lessonId` segue a ordem da trilha e `mapId`, `itemIds` e `lessonId` precisam existir.

**`Card` não é um schema de conteúdo.** A carta é uma **visão derivada** de um item, montada em `domain/cards/flashcard.ts`. O nome é `Flashcard` porque `Card` já é o tipo do SRS em `sm2.ts`:

```ts
type Flashcard = {
  itemId: string; // = SrsCard.itemId
  source: 'unit' | 'bank' | 'user';
  front: { en: string; emoji?: string };
  back: {
    pt: string;
    example?: { en: string; pt: string };
    pronunciation?: string;
    caution?: string;
    situation?: string;
    formality?: Formality;
    avoidWhen?: string;
  };
  level?: CefrLevel;
};
```

Cartas automáticas: todo item de unidade ou banco gera uma carta. Os nós de mapa com `ref` reaproveitam a carta do item, e um nó sem `ref` (regra, título) não vira carta. O único Zod escrito à mão para cartas é o `UserCard`, que é persistido (§4.1). O `Deck` escrito à mão só existe para baralhos **temáticos**. Os demais são derivados (§5.3).

### 2.7 Manifesto e carregamento lazy

`buildManifest` passa a gerar, além de `units` (agora com `level`):

```ts
type CourseManifest = {
  units: ManifestUnit[];
  banks: { id: string; level: CefrLevel; file: string; itemIds: string[] }[];
  maps: {
    id: string;
    title: string;
    level: CefrLevel;
    kind: MapKind;
    unitId?: string;
    skillId?: string;
    file: string;
    nodeCount: number;
    itemIds: string[];
    search: string; /* título + rótulos normalizados, p/ busca sem carregar o mapa */
  }[];
  collections: ManifestCollection[]; // sem as entradas (só contagens e tópicos)
  decks: { id: string; title: string; icon: string; level: CefrLevel; itemIds: string[] }[];
  plans: { id: string; file: string; title: string }[];
};
```

- `loader.ts` generaliza `createUnitLoader` para `createJsonLoader(glob, schema, issues)`, com um glob lazy por pasta e um chunk por arquivo, todos no precache do SW. As funções novas são `loadMap(id)`, `loadBank(id)`, `loadCollections()` e `loadPlan(id)`, com cache e `ContentLoadError` como hoje.
- `loadItemIndex(unitIds)` vira `loadItems(itemIds)`: o manifesto diz qual arquivo é dono de cada id, e a função carrega só as unidades e bancos necessários.
- `manifestItemIds()` passa a incluir os bancos. O Praticar e o contador de vencidos (§3) enxergam esses itens, junto com os ids das cartas do aluno.
- `knownWords.generated.ts` inclui os textos dos bancos, para que o "quase certo" continue sem aceitar uma palavra válida no lugar de outra.
- `manifest.test.ts` confere a coerência como hoje. O `check-prod-bundle` garante que nenhum JSON novo entra no JS inicial (ADR-013).

## 3. SRS compartilhado

**Um item, um `SrsCard`, um histórico.** Não importa se o aluno viu o item na lição, no Praticar, na carta ou no mapa.

| Origem da carta                                     | `SrsCard.itemId`                                                   |
| --------------------------------------------------- | ------------------------------------------------------------------ |
| Vocab ou frase de unidade                           | o próprio id (`u1-hi`): a carta mostra o mesmo progresso da trilha |
| Item de banco (frases, phrasal, expressões, extras) | id do banco (`fr-…`, `pv-…`)                                       |
| Nó de mapa com `ref`                                | o id referenciado (o mapa não tem id de SRS próprio)               |
| Carta do aluno                                      | `uc-<8+ chars aleatórios>`                                         |

**Notas → `q`.** `Quality` passa a `1 | 2 | 3 | 4 | 5`, e o algoritmo não muda:

| Modo                                       | Origem                                                             | `q`                           |
| ------------------------------------------ | ------------------------------------------------------------------ | ----------------------------- |
| Virar / inverter (autoavaliação)           | Errei · Difícil · Bom · Fácil                                      | **1 · 3 · 4 · 5**             |
| Digitar (corretor existente)               | certo de primeira · "quase" · errou e acertou na repetição · errou | 5 · 4 · 2 · 1 (igual à lição) |
| Ouvir e reconhecer (múltipla escolha)      | acertou · errou                                                    | 4 · 1                         |
| Esconder e revelar (mapa), opcional por nó | Lembrei · Não lembrei                                              | 4 · 1                         |

Com essa escala, "Bom" mantém o `ease` (Δ = 0), "Difícil" reduz 0,14 e "Fácil" soma 0,1, exatamente como um acerto de primeira na lição. A autoavaliação nunca vale mais que um acerto comprovado.

**Mesmo dia**: valem as regras atuais de `review()`, sem exceção para cartas. Um card já revisado hoje (por exemplo, na lição) não avança com "Bom". "Errei" depois de um acerto no mesmo dia conta como falha, e quem já falhou hoje não é penalizado de novo. Dentro da sessão, a carta marcada "Errei" volta uma vez no fim da fila, e `applyOutcomes` usa o menor `q` do item. Relógio que volta não altera nada.

**Seleção de uma sessão** (`domain/cards/select.ts`, pura e determinística por seed): primeiro as cartas vencidas do baralho, na mesma ordem do Praticar (mais atrasadas, mais lapsos, menor `ease`). Depois entram até **10 cartas novas** (itens sem `SrsCard`), na ordem do conteúdo, com no máximo 20 cartas por sessão.

**"Meus erros"** é derivado, sem tabela nem campo novo:

```ts
export const isMistake = (c: Pick<Card, 'lapses' | 'reps'>) => c.lapses >= 1 && c.reps < 2;
```

O item entra no baralho quando falha e sai depois de 2 acertos seguidos em dias diferentes (pela regra de mesmo dia). Erros cometidos em lições e no Praticar também entram, porque o histórico é um só.

**Contador "cartas para revisar hoje"**: é o mesmo número de `practiceDueCount`, estendido para incluir bancos e cartas do aluno. Ele aparece uma vez na Trilha e leva ao Praticar (§5). Cartas e exercícios são **duas formas de revisar a mesma fila**, e a interface precisa dizer isso claramente.

## 4. Persistência

### 4.1 Dexie v2 (só tabelas novas, nenhuma tabela existente muda de chave ou índice)

```ts
this.version(1).stores({/* igual */});
this.version(2).stores({
  userCards: 'id, updatedAt',
  mapProgress: 'mapId',
  planProgress: 'planId',
});
```

```ts
export const userCardSchema = z.object({
  id: z.string().regex(/^uc-[a-z0-9]{8,}$/),
  en: z.string().trim().min(1).max(120).regex(NO_PATTERN_CHARS), // sem ( ) [ ] | (corretor)
  pt: z.string().trim().min(1).max(120).regex(NO_PATTERN_CHARS),
  example: z.object({ en: …, pt: … }).optional(),
  notes: z.string().trim().max(280).optional(),
  emoji: z.string().max(16).optional(),
  createdAt: isoDate, updatedAt: isoDate,
}); // limite: 500 cartas (mantém `srs` limitado; ADR-011)

export const mapProgressSchema = z.object({
  mapId: z.string().min(1),
  firstStudiedAt: isoDate,
  lastStudiedDay: dayKey,
  timesStudied: z.number().int().positive(),
});

export const planProgressSchema = z.object({
  planId: z.string().min(1),
  startedDay: dayKey,
  manualDone: z.array(z.number().int().min(1).max(30)), // check manual (estudou no papel)
});
```

Mudanças em tabelas existentes, todas opcionais e sem índice novo:

- `LessonResult.kind` ganha `'cards'` e `'map'`.
- `LessonResult` ganha `context?: { mapId?: string; deckKey?: string; planDay?: number }`.
- `DailyStats` ganha `cards?: number` (cartas distintas revisadas em sessões de cartas no dia).

**Migração**: o Dexie cria as tabelas novas e preserva todas as linhas v1. Não há `upgrade()`, porque nenhuma linha antiga muda de forma. Também não há backfill: `cards` ausente vale 0. **Teste obrigatório** (`db.migration.test.ts`): abre um banco com a definição v1 congelada no teste, grava perfil, configurações, progresso, resultados, srs, daily, conquistas e quarentena, fecha, abre com `FalaeDb` v2 e confere linha por linha, com as tabelas novas vazias. O teste também faz `exportAll` → `importAll` em v2.

**Outra aba aberta com o código v1**: ela recebe `versionchange` e o Dexie fecha a conexão. Vamos tratar `db.on('versionchange')` e `blocked` com um aviso "O Falaê foi atualizado — recarregue a página" (i18n), em vez de deixar erros aparecerem.

### 4.2 Plano de estudos derivado

O estado de cada dia é calculado em `domain/plan/planState.ts`, sem gravação no commit:

- mapa ✓ quando há `mapProgress[mapId]`;
- cartas ✓ quando todos os `itemIds` do dia têm `SrsCard` com `lastReviewDay ≥ startedDay`;
- lição ✓ quando há `lessonProgress[lessonId]`;
- dia ✓ com os 3 itens marcados ou com `manualDone`.

Como tudo deriva de dados que já existem, o plano se mantém consistente depois de import, reset ou estudo pela trilha.

### 4.3 Export/import `schemaVersion: 2`

```ts
data: { ...v1, userCards: UserCard[]; mapProgress: MapProgress[]; planProgress: PlanProgress[] }
```

- `parseExportFile` aceita `1 | 2`. Um arquivo v1 é promovido em memória (`upgradeExportV1`: tabelas novas = `[]`). Acima de 2 continua dando `newerVersion`. O app antigo que recebe um arquivo v2 já mostra "arquivo de versão mais nova".
- `ImportSummary` ganha `userCards` e `mapsStudied`. Se o banco atual tem cartas do aluno e o arquivo não tem, o resumo avisa: "Este arquivo não tem suas cartas; elas serão apagadas". O import continua substituindo tudo.
- Testes: um arquivo v1 real importa e preserva tudo, um arquivo v2 faz ida e volta idêntica, e v2 com carta inválida é rejeitado sem tocar no banco.

### 4.4 `Repository` e commit

```ts
interface Repository {
  // … existentes …
  listUserCards(): Promise<UserCard[]>;
  saveUserCard(card: UserCard): Promise<void>; // valida; limite 500
  deleteUserCard(id: string): Promise<void>; // apaga carta + SrsCard na mesma transação
  getMapProgress(): Promise<MapProgress[]>;
  getPlanProgress(planId: string): Promise<PlanProgress | undefined>;
  savePlanProgress(p: PlanProgress): Promise<void>;
}
```

As sessões de cartas e de mapa **passam pelo mesmo `recordLessonResult`**, sem um segundo caminho de escrita:

| Sessão                                       | `kind`     | `lessonId`             | `context`               |
| -------------------------------------------- | ---------- | ---------------------- | ----------------------- |
| Cartas (qualquer modo)                       | `cards`    | `deck:<deckKey>`       | `{ deckKey, planDay? }` |
| Mapa estudado (esconder e revelar concluído) | `map`      | `map:<mapId>`          | `{ mapId, planDay? }`   |
| Praticar este mapa                           | `practice` | `map-practice:<mapId>` | `{ mapId }`             |

Mudanças no commit:

- **Transação**: inclui `mapProgress`. Com `context.mapId` e `kind ∈ {map, practice}`, o repositório faz upsert de `mapProgress`, como já faz com `lessonProgress`. O `daily.cards` soma as cartas distintas quando `kind === 'cards'`.
- **`CommitContext` ganha** (todos limitados, sem varrer `results`):
  - `mapProgress?: MapProgress` (do mapa da sessão);
  - `mapsStudiedBefore` (count, até ~35);
  - `cardsReviewedBefore` (soma de `daily.cards` por cursor, como `goalMetCount`);
  - `recentDaily` (`bulkGet` dos 6 dias anteriores);
  - `mistakesBefore` (cursor com `isMistake`, como `wordsLearnedBefore`).
- **`AppliedCommit` ganha `xp?: number`**: o `apply` pode definir o XP final dentro da transação (necessário para "mapa 1×/dia"). O repositório grava `result.xp` e o `daily` com esse valor.
- Hoje `isStudy = kind !== 'placement'`, então `cards` e `map` **já contam para ofensiva, meta e daily**. Basta não excluí-los.
- Corações: sessões `cards` e `map` não gastam nem dão corações. O "Praticar este mapa" é prática: dá +1 coração, como o Praticar.

### 4.5 Gamificação

| Regra              | Valor proposto                                                                                                                                                         |
| ------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Sessão de cartas   | **8 XP** (igual ao Praticar) + 5 se perfeita (nenhum "Errei"/erro) + combo +1 a cada 5 seguidas, no máximo +5. Exige ≥ 5 cartas, ou todas as vencidas se houver menos. |
| Mapa estudado      | **5 XP**, só o primeiro de cada mapa por dia (`apply` vê `mapProgress.lastStudiedDay`). Sem bônus. Repetir no mesmo dia vale 0 XP, mas registra.                       |
| Praticar este mapa | igual ao Praticar: 8 (+5 perfeita, combo ≤ +5), +1 coração                                                                                                             |
| Ofensiva e meta    | toda sessão `cards`/`map`/`practice` conta (regras atuais)                                                                                                             |

Conquistas novas em `achievements.ts` (ids estáveis, textos em `t.achievements`). `AchievementStats` ganha `mapsStudied`, `cardsReviewed`, `cardDayStreak`, `mistakesBefore` e `mistakesAfter`. O cálculo do "depois" reusa o padrão de `learnedAfter`, generalizado para um `countAfter(pred, …)`.

| id                 | Condição                                                                              |
| ------------------ | ------------------------------------------------------------------------------------- |
| `first-map`        | `mapsStudied ≥ 1`                                                                     |
| `maps-10`          | `mapsStudied ≥ 10`                                                                    |
| `cards-100`        | `cardsReviewed ≥ 100`                                                                 |
| `card-streak-7`    | 7 dias seguidos (`dayKey` local, terminando hoje) com `daily.cards > 0`               |
| `mistakes-cleared` | sessão `cards` do baralho "Meus erros" com `mistakesBefore ≥ 1` e `mistakesAfter = 0` |

Tuca nos humores existentes:

- `feliz`: estante e listas;
- `pensando`: modo esconder e revelar e editor de carta;
- `comemorando`: fim de sessão, dia do plano concluído e conquista;
- `incentivando`: "Meus erros" e baralho vazio.

O humor `triste` não aparece nas telas novas.

## 5. Telas, rotas e navegação

### 5.1 Navegação: 5 itens (recomendado)

**Trilha · Coleções · Praticar · Perfil · Ajustes**

- **Coleções** é a estante com as 5 capas: Mapas mentais, Frases do dia a dia, Phrasal verbs, Expressões e gírias e o Plano de 30 dias. Ela reúne todo o conteúdo novo numa entrada só, com cara de caderno. A capa "Mapas mentais" abre a lista de mapas, que é a "aba Mapas" pedida, um nível abaixo (`/colecoes/mapas`). Uma aba só "Mapas" esconderia frases, expressões e o plano.
- **Cartas ficam dentro de Praticar**: as cartas revisam **a mesma fila** do Praticar (SRS único). Duas abas com o mesmo contador confundiriam o aluno. O Praticar vira um hub com três partes:
  - "**N para revisar hoje**", com dois botões: _Revisar com cartas_ e _Revisar com exercícios_;
  - **Baralhos**: por unidade, por mapa, temáticos, Meus erros, Minhas cartas e as coleções de cartas;
  - **Minhas cartas**, com o botão "Nova carta".
- 5 itens cabem em 390 px (78 px por alvo, rótulos ≤ 8 letras). Com 6 itens, ficariam 65 px e rótulos apertados, por isso a recomendação é não passar de 5. No desktop, o trilho lateral não muda de estrutura. Alternativa, se o usuário preferir 4: mover Ajustes para uma engrenagem no Perfil (exige ajustar E2E e hábito).

### 5.2 Rotas novas (URLs em PT-BR, telas lazy)

| Rota                                                                                                        | Tela                                                                                                       |
| ----------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `/colecoes`                                                                                                 | Estante com capas (Tuca feliz)                                                                             |
| `/colecoes/mapas?nivel=&unidade=&tipo=&estudado=&q=`                                                        | Lista de mapas: filtros por nível, unidade e tipo, busca (pelo `search` do manifesto) e selo "já estudado" |
| `/colecoes/:collectionId`                                                                                   | Coleção de cartas por tópico (frases, phrasal com seus 5 mapas, expressões com selo de formalidade)        |
| `/colecoes/plano`                                                                                           | Plano de 30 dias: dia atual, 3 checks por dia e check manual                                               |
| `/mapa/:mapId`                                                                                              | Visualizador (tela cheia com voltar; a barra inferior some no celular para dar área ao mapa)               |
| `/mapa/:mapId/praticar`                                                                                     | Minilição (`LessonPlayer`, `kind: 'practice'`)                                                             |
| `/praticar`                                                                                                 | Hub (§5.1)                                                                                                 |
| `/baralho/:deckKey`                                                                                         | Lista de cartas, escolha de modo, imprimir                                                                 |
| `/cartas/sessao?baralho=&modo=`                                                                             | Sessão de cartas (tela cheia)                                                                              |
| `/cartas/nova` · `/cartas/:id`                                                                              | Editor de carta do aluno                                                                                   |
| `/imprimir/mapa/:mapId` · `/imprimir/baralho/:deckKey?por-folha=8\|10` · `/imprimir/apostila/:collectionId` | Páginas de impressão (§7)                                                                                  |

Integrações com telas existentes:

- **Trilha**: faixa "N cartas para revisar hoje" e "Dia 7 do plano", se o plano foi iniciado. O contador usa o `usePractice` que já existe, sem import novo no caminho inicial.
- **Fim da 3ª lição de uma habilidade e tela da dica**: botão "Ver mapa da habilidade", quando o manifesto tem um mapa com aquele `skillId`.
- **Perfil**: "mapas estudados" e "cartas revisadas".

### 5.3 Chaves de baralho (derivadas em `domain/cards/decks.ts`)

`unit.<unitId>` · `skill.<skillId>` · `map.<mapId>` · `theme.<deckId>` · `col.<collectionId>[.<topic>]` · `erros` · `minhas` · `hoje` (vencidas de tudo). As chaves são seguras para URL e são gravadas em `context.deckKey`.

### 5.4 Sessão de cartas

Estados puros em `domain/cards/session.ts`: `presenting → flipped → rated → … → finished`. A fila reinsere "Errei" uma vez, e o resumo gera `itemOutcomes` (§3).

- **Modos**:
  - _Virar_ (EN → PT), com 3D `rotateY` em Framer Motion. Com reduced motion, vira fade.
  - _Inverter_ (PT → EN).
  - _Digitar_: vocab de PT para EN (usa `en` + `acceptedEn`); frases de EN para PT (usa `acceptedPt`, mais robusto). Ver o risco no §10.
  - _Ouvir e reconhecer_: TTS e 4 opções em PT. Sem TTS, o modo fica oculto.
- **Gestos** (só depois de virar): arrastar para a direita = Bom, para a esquerda = Errei, usando o `drag` do Motion (sem dependência nova). Os botões sempre existem, então o gesto nunca é o único caminho.
- **Teclado**: Espaço/Enter vira, `1`–`4` dão a nota, `←`/`→` = Errei/Bom, `Esc` sai com confirmação. Feedback em `aria-live`, e todo trecho em EN leva `lang="en"`.
- Cartas do aluno no modo digitar: são comparadas como texto literal, sem padrões. Por isso o schema proíbe `( ) [ ] |`.

## 6. Motor dos mapas (`src/domain/mindmap/` + `src/features/mindmap/`)

**Layout: implementação própria, pura** (`layout.ts`), em vez de `d3-hierarchy`. Com ≤ 30 nós e profundidade 3, um layout radial por **setores proporcionais ao número de folhas** resolve, em cerca de 100 linhas testáveis. A largura dos rótulos é estimada por caracteres por linha (`wrapLabel(text, maxChars)`), sem medir DOM, o que mantém `domain` puro. Raio por nível ajustado ao maior rótulo e teste de colisão de caixas: os testes falham se dois rótulos se sobrepõem nos mapas reais. Há uma segunda saída, `layoutTree` (árvore da esquerda para a direita), para o PDF quando o radial não couber. `d3-hierarchy` (~4 kB gzip) fica como plano B, se o layout próprio não passar no designer.

**Renderização SVG** com `<text>`/`<tspan>`, sem `foreignObject` (quebra a exportação no Safari).

- Ramos: curvas Bézier com "tremido" determinístico (`sketchPath(from, to, seed = nodeId)`) e espessura que afina por nível.
- Marca-texto: retângulo inclinado atrás do título. Post-it em nós `erro-comum`.
- Ícones desenhados: um conjunto SVG próprio, pequeno, criado com o designer.
- Etiqueta da tag com ícone e texto, nunca só cor.

**Pan e zoom sem lib** (`usePanZoom.ts`): Pointer Events com `touch-action: none`.

- 1 dedo ou mouse arrasta. 2 dedos fazem pinça (razão das distâncias, ancorada no ponto médio).
- Roda com Ctrl/trackpad dá zoom. Duplo toque aproxima.
- Escala de 0,4 a 3, atualização por `requestAnimationFrame` e `transform` num único `<g>`.
- Botões visíveis: +, −, "Ajustar à tela". Teclas: `+`, `-`, `0` e setas para mover.

**Expandir e recolher**: o mapa abre com centro e ramos (≤ 7 nós, cabe em 390 px). Tocar num ramo expande e enquadra a área com animação curta (salto, se reduced motion).

**Toque no nó**: fala o EN (serviço de TTS atual) e abre um painel inferior com EN, PT, exemplo, pronúncia, "cuidado" e a tag. Nó com `ref` mostra "Adicionar ao baralho de hoje", que leva à sessão `map.<id>`.

**Esconder e revelar**: os textos EN (ou PT, à escolha) viram post-its em branco. Tocar revela, e um nó com item oferece "Lembrei / Não lembrei" (§3). Revelar todos conclui o estudo (commit `kind: 'map'`).

**Acessibilidade**: o SVG é visual (`role="img"` com `aria-label` do título). O controle real é uma **árvore HTML** sincronizada (`role="tree"`, `treeitem`, `aria-level`, `aria-expanded`, roving tabindex), com setas ↑/↓ entre irmãos, → expande ou entra, ← recolhe ou sobe, Enter abre o painel e Espaço fala o texto.

- A árvore fica visualmente oculta por padrão. O nó focado ganha **anel de foco desenhado no SVG**, e a vista acompanha o foco.
- O botão "Ver como lista" mostra a mesma árvore como lista indentada: alternativa para leitor de tela, baixa visão e telas pequenas.

**Desempenho**: o layout é memoizado por mapa e estado de expansão. Sem filtros SVG (`feTurbulence`) na tela: a textura de papel é um padrão CSS ou um WebP de 128 px (< 4 kB). Rota e conteúdo lazy, sem impacto no JS inicial (ADR-013).

## 7. Exportação e impressão

**PNG**: serializar o SVG do mapa já no estilo de impressão, com as fontes **embutidas como data URL**. As fontes vêm do precache e funcionam offline. Depois:

1. `Image` → `canvas`, com o lado maior em 3508 px (A4 a 300 dpi, ~8,7 Mpx, abaixo do limite de ~16 Mpx do iOS);
2. `toBlob('image/png')`;
3. download (`a[download]`), ou `navigator.share({ files })` quando o download não funciona (PWA no iOS).

**PDF: comparação**

| Critério                | `window.print()` + CSS `@page`                                                            | jsPDF (+ svg2pdf)                     | pdf-lib (+ fontkit)                     |
| ----------------------- | ----------------------------------------------------------------------------------------- | ------------------------------------- | --------------------------------------- |
| Bundle                  | **0 kB**                                                                                  | ~120–150 kB gzip (lazy)               | ~70 kB gzip + fontkit ~150 kB+          |
| Offline                 | sim                                                                                       | sim                                   | sim                                     |
| Texto vetorial / fontes | sim, usa as fontes já carregadas                                                          | precisa embutir TTF (woff2 não serve) | precisa de fontkit para fontes próprias |
| Emojis                  | sim (fonte do sistema)                                                                    | não (viram imagem)                    | não                                     |
| Frente e verso alinhado | sim, se o usuário imprimir a 100%                                                         | exato                                 | exato                                   |
| iOS Safari              | `@page size` com suporte parcial; impressão no PWA instalado precisa de teste em aparelho | gera o arquivo (compartilhar)         | idem                                    |
| Testável no CI          | `page.pdf()` do Playwright (Chromium)                                                     | sim                                   | sim                                     |

**Recomendação: `window.print()` com páginas já paginadas pelo app.** Cada folha é uma `<section>` de tamanho fixo em mm, com `break-after: page`. Os números de página e o sumário são calculados por nós (`domain/print/paginate.ts`), sem depender de contadores CSS de margem, que o Safari e o Firefox não suportam bem. A margem é zero no `@page`, para tirar cabeçalho e rodapé do navegador. Antes de imprimir, a tela mostra um guia curto: "Salvar como PDF, escala 100%, frente e verso pela borda longa". Se o teste em iPhone da Fase 7 falhar, o plano B é jsPDF **lazy só na rota de impressão**, com nova aprovação do usuário.

**Layouts de impressão**:

- **Mapa**: A4 paisagem, `layoutTree` ou radial ajustado, estilo **P&B**. Os ramos se distinguem por traço (cheio, tracejado, pontilhado, duplo) e por número, sem fundos. O marca-texto vira sublinhado. Opção "colorido".
- **Cartas**: A4 retrato, margens de 10 mm.
  - 8 por folha: 2×4, 95 × 69 mm. 10 por folha: 2×5, 95 × 55 mm.
  - Linhas de corte tracejadas com ✂.
  - Na folha de versos, as colunas ficam **espelhadas** horizontalmente (virada pela borda longa) e a ordem é calculada por `paginateCards(items, perSheet)`, pura e testada.
  - Inclui uma folha opcional de teste de alinhamento.
- **Apostila por coleção**: capa, sumário com páginas e conteúdo (mapas, ou cartas em lista com tradução, situação e formalidade).
  - Páginas pautadas para anotações ao fim de cada seção.
  - Numeração no rodapé e margem de encadernação de 20 mm, alternando lado em páginas pares e ímpares, apta a espiral.
  - Rodapé com "Falaê" e nível, sem URL.

Aceite automatizado: Playwright gera `page.pdf({ preferCSSPageSize: true })` das três rotas e confere o número de páginas e o tamanho A4. Os PNGs das páginas (`emulateMedia('print')`) vão para o designer.

## 8. Estética de caderno

É uma camada por cima da identidade atual (Manga, Anil, Areia, Noite, Tuca), sem uma marca nova. Tokens propostos em `tokens.css` (valores finais com o `designer-de-mapas`; contraste conferido por `tokens.test.ts`):

```css
:root {
  --paper: #fffdf7;          --paper-line: #dfe5ef;     --paper-margin: #f1b9b4;
  --ink-pencil: #2a2b45;     /* texto sobre papel ≥ 7:1 */
  --highlight: rgb(255 138 31 / 0.32);   /* marca-texto Manga atrás de texto ink: AA */
  --postit: #ffe58a;         --postit-ink: #1b1c33;
  --branch-manga: #c75f00;   --branch-anil: #3b3fb6;   --branch-folha: #0f7a37;
  --branch-acerola: #b42318; --branch-maracuja: #8a6a00; --branch-jambo: #a3246b; /* traço ≥ 3:1 no papel */
}
.dark { --paper: #1b1d3a; --paper-line: #2c2f58; --highlight: rgb(255 154 61 / 0.30); … }
```

- **Regras**: o texto é sempre `ink`/`ink-pencil`, nunca a cor do ramo. A cor do ramo é traço (≥ 3:1) e vem sempre com ícone ou rótulo. O modo escuro é um "caderno à noite": papel Noite, pautas discretas.
- **Fonte manuscrita** para títulos de mapa, rótulos de ramo e post-its. O texto de estudo longo continua em Atkinson, por legibilidade. Candidatas OFL via `@fontsource`, só subset latin:
  - **Shantell Sans** (recomendada: desenhada para legibilidade, tem eixo "informal");
  - Patrick Hand;
  - Kalam.

  Peso: ~20–35 kB por peso em woff2, 2 pesos. A fonte é carregada **só nas rotas de mapa, coleção e impressão** (CSS da feature), então não pesa no carregamento inicial. A escolha final é do designer, mas a dependência precisa de aprovação.

- Rabiscos e ícones desenhados são SVGs próprios, feitos para o Falaê. Nada do kit de referência.

## 9. Dependências

| Dependência                                      | Tamanho                                  | Necessária?                                                   | Aprovação        |
| ------------------------------------------------ | ---------------------------------------- | ------------------------------------------------------------- | ---------------- |
| `@fontsource/shantell-sans` (ou alternativa OFL) | ~40–70 kB de fonte (2 pesos), fora do JS | sim                                                           | **sim** (leve)   |
| `d3-hierarchy`                                   | ~4 kB gzip                               | só se o layout próprio falhar                                 | sim, se usada    |
| `jspdf` (+ `svg2pdf.js`)                         | ~120–150 kB gzip, lazy                   | só se a impressão no iOS falhar                               | **sim** (pesada) |
| Pan/zoom, gestos, PNG                            | —                                        | resolvidos com Pointer Events, Motion (já instalado) e Canvas | —                |

Precache: cerca de 33 mapas (~6 kB cada) mais ~270 itens novos nos bancos devem somar ~250 kB de JSON cru (~50 kB gzip), tudo lazy.

## 10. Plano por fase

Os planos ficam em `docs/fases/mapas-e-cartas/FASE-N.md`, porque `docs/fases/FASE-2..7.md` já pertencem à v1. Toda fase de código passa por `desenvolvedor` → `revisor-de-codigo` + `qa-tester` (em paralelo) → correção → nova verificação. Portão: 0 bloqueantes e lint/typecheck/test/e2e verdes.

| Fase                           | Entregas                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  | Verificação extra                                                                                                                       |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| **2 Base**                     | `level` no schema e nas 4 unidades; `pronunciation`; schemas `bank`, `mindMap`, `collection`, `deck`, `studyPlan` com `*Issues` e testes; manifesto e loaders estendidos; Dexie v2 + **teste de migração**; export v2 lendo v1; `Repository` novo; `kind` `cards`/`map`, `context`, `daily.cards`, `AppliedCommit.xp`; aviso de `versionchange`; tokens de caderno (rascunho). Agentes: criar `designer-de-mapas` e `pedagogo`; atualizar `autor-de-conteudo`, `revisor-linguistico`, `revisor-ux`, `qa-tester`, `desenvolvedor`. Skills: criar `criar-mapa-mental`, `revisar-mapa-mental`, `criar-baralho`, `exportar-para-impressao`; atualizar `criar-licao`, `revisar-licao`, `novo-tipo-de-exercicio`. O agente principal atualiza o `CLAUDE.md` (agentes e ciclos). | migração revisada pelo `revisor-de-codigo` em `opus` (dados persistidos)                                                                |
| **3 Motor dos mapas**          | `layout`, `sketch`, `tree` (navegação), `reveal`; visualizador SVG, pan/zoom, árvore acessível, "Ver como lista", painel + TTS, esconder e revelar, Praticar este mapa, lista com filtros e busca, estante (capas provisórias). **2 mapas de exemplo**: `u1-sk1` (vocabulário) e `mm-to-be` (gramática).                                                                                                                                                                                                                                                                                                                                                                                                                                                                  | conteúdo: `revisor-linguistico` + `pedagogo` em paralelo; visual: `designer-de-mapas` (390×844 e desktop) + `revisor-ux`                |
| **4 Motor das cartas**         | `flashcard`, `session`, `select`, `decks`, `isMistake`; 4 modos, gestos, teclado; hub do Praticar; baralhos derivados; Minhas cartas (CRUD, limite, export); contador na Trilha                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           | `revisor-ux`; `designer-de-mapas` (visual da carta)                                                                                     |
| **5 Conteúdo (em lotes)**      | A: 16 mapas de habilidade. B: 12 mapas temáticos + banco `extra-a1/a2`. C1–C3: 150 frases (50 por lote). D: 40 phrasal + 5 mapas. E: 50 expressões. F: baralhos temáticos + plano de 30 dias.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             | por lote: `autor-de-conteudo` → `revisor-linguistico` + `pedagogo` → correção → reconfirmação; mapas com captura aprovada pelo designer |
| **6 Gamificação e integração** | XP por `kind`, mapa 1×/dia, 5 conquistas, Tuca nas telas, "Ver mapa da habilidade", tela do plano, capas finais, perfil                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   | `revisor-ux`                                                                                                                            |
| **7 Exportação e impressão**   | PNG; rotas `/imprimir/*`; P&B; cartas 8/10 com frente e verso; apostilas; `page.pdf()` no E2E; checklist manual em iPhone (Safari e PWA) e Android                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        | `designer-de-mapas` aprova o PDF; `revisor-ux`                                                                                          |
| **8 QA final**                 | E2E (mobile e desktop): usuário v1 com progresso semeado atualiza e mantém tudo → abre mapa → pratica o mapa → cartas deslizando → cria carta própria → gera PDF → `advanceDays(1)` → cartas vencidas no contador e na sessão. Offline após a 1ª visita; Lighthouse ≥ 90; orçamento ADR-013; README atualizado.                                                                                                                                                                                                                                                                                                                                                                                                                                                           | todos os revisores                                                                                                                      |

**Volume realista de conteúdo**: ~33 mapas (16 de habilidade, 12 temáticos, 5 de phrasal) com ~20–25 nós cada (~750 nós). Nos bancos, ~270 itens novos, cada um com respostas aceitas (frases ~120, porque parte vem das unidades; phrasal 40; expressões 50; extras ~60). É o maior lote desde a v1, e a revisão é o gargalo. Por isso os lotes têm no máximo 50 itens ou 4 mapas por ciclo.

**Riscos e mitigação**:

1. **A2 não existe nas unidades**. Na v1 o A2 aparece só em bancos, mapas e cartas (present continuous, phrasal, expressões). As unidades A2 continuam no ROADMAP. O plano de 30 dias usa as lições A1 existentes (52 lições em 30 dias = o primeiro trecho da trilha, cerca de 1,7 lição por dia).
2. **30 falsos cognatos estouram o limite de nós**. São divididos em 3 mapas de 10 (por exemplo: pessoas e família; casa e rotina; trabalho e escola). Das 30 palavras, ~8 já existem nas unidades; as outras vão para `extra-a1`.
3. **Sobreposição de mapas temáticos com os de habilidade** (números, horas, to be). Os temáticos cobrem a gramática transversal e os de habilidade, o vocabulário. O pedagogo verifica isso.
4. **Pronúncia simplificada pode fixar erros** (ex.: "th" escrito como "f"). O campo é opcional, a convenção é definida pelo pedagogo na skill `criar-baralho` e o botão de áudio sempre vem junto. Sons sem equivalente em PT ficam sem transcrição.
5. **PT→EN digitado** é injusto se o `acceptedEn` estiver incompleto (já anotado no ROADMAP). Na v1 vale só para vocab, com auditoria de `acceptedEn` no Lote A; frases ficam em EN→PT.
6. **Gírias datadas, regionais ou ofensivas**: `avoidWhen` é obrigatório e passam pela revisão linguística e pelo pedagogo.
7. **Impressão no iOS** (PWA instalado): teste em aparelho na Fase 7, com o plano B do §7.
8. **Autoavaliação inflada** ("Fácil" sempre) deixa o SRS otimista. Mitigação: o "Fácil" nunca vale mais que um acerto de lição, e "Meus erros" usa `lapses`.
9. **Abas antigas abertas** durante a migração: tratadas com o aviso de `versionchange`.
10. **Orçamento do JS inicial**: todas as rotas novas são lazy, e o contador da Trilha usa a store que já existe.

## 11. Decisões para o usuário aprovar

1. **Navegação**: 5 itens (Trilha · **Coleções** · Praticar · Perfil · Ajustes), com os mapas em Coleções → Mapas mentais. _Recomendo._ Alternativa: aba literal "Mapas", com as demais coleções dentro dela.
2. **Cartas dentro de Praticar** (hub "N para revisar hoje": cartas ou exercícios), sem aba própria. _Recomendo_, por causa do SRS único.
3. **Formato do conteúdo**: `level` obrigatório nas unidades; `pronunciation` opcional nos itens; pastas novas `banks/`, `mindmaps/`, `collections.json`, `decks.json`, `plans/`; itens fora das unidades só em bancos. _Recomendo._
4. **Dados persistidos**: Dexie v2 com `userCards`, `mapProgress` e `planProgress`; `kind` `cards`/`map`; `context` e `daily.cards` opcionais; backup `schemaVersion: 2`, que continua lendo v1. Tudo sem perder progresso e com teste de migração. _Recomendo._
5. **Notas das cartas**: Errei 1 · Difícil 3 · Bom 4 · Fácil 5, no mesmo SM-2. _Recomendo._
6. **XP**: cartas 8 (+5 perfeita, combo ≤ +5, mínimo 5 cartas); mapa estudado 5, uma vez por mapa por dia; "Praticar este mapa" = Praticar (+1 coração); cartas e mapas não mexem em corações. _Recomendo._ (Interpretei "mesmo teto e bônus" como mesmos bônus e tetos das sessões atuais. Confirme.)
7. **"Meus erros"** = itens com `lapses ≥ 1` e `reps < 2`, derivado. _Recomendo._
8. **PDF via impressão do navegador** (0 kB, emojis e fontes ok) e PNG via canvas. jsPDF só se o iPhone falhar, com nova aprovação. _Recomendo._
9. **Layout e pan/zoom próprios**, sem `d3-hierarchy` (fica como plano B). _Recomendo._
10. **Fonte manuscrita OFL** via `@fontsource`, só nas telas de caderno: Shantell Sans (alternativas Patrick Hand e Kalam). _Recomendo Shantell Sans; o designer confirma._
11. **Pronúncia simplificada**: incluir como campo opcional, com convenção do pedagogo e sem transcrever sons sem equivalente. _Recomendo incluir;_ a alternativa é ficar só com o áudio.
12. **Nome do plano de 30 dias** (original): "Caderno de 30 dias", "30 dias com o Tuca" ou "Rota 30". _Recomendo "30 dias com o Tuca"._
13. **Itens B1 nas coleções da v1** (alguns phrasal verbs e gírias são B1): permitir com selo honesto? _Recomendo permitir, com no máximo 20% por coleção._
