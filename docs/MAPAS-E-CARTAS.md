# Mapas mentais e cartas — plano técnico

> Status: **aprovado em 2026-11-03** (respostas no §11). Revisado em 2026-11-03: §5.1 ajustado à decisão 1 (aba **Mapas**), fonte Patrick Hand (decisão 10), plano "30 dias com o Tuca" (decisão 12) e protótipo aprovado incorporado como ponto de partida (§12). Os ajustes de formato que vieram do protótipo estão no ADR-017 (aprovado em 2026-11-03). A decisão 9 foi revista: vista radial, pan/zoom e PNG saíram do escopo (§6.2, §11).
> Dono: agente `arquiteto`. Complementa `docs/ARQUITETURA.md`. As seções viram parte da arquitetura (§4, §7, §8, §11, §13) à medida que cada fase é entregue.
> Referência de formato: um kit comercial de mapas mentais de inglês com estética de caderno, usado **só** como ideia de formato e público. Nenhum texto, nome, ilustração ou layout é copiado. Os revisores conferem isso.

## 1. O que existe e o que vamos reaproveitar

| Existe hoje                                                                                                                                              | Reaproveitamento                                                                                                             |
| -------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| 4 unidades A1 (`u1`–`u4`), 16 habilidades, 48 lições + 4 revisões, **240 itens** (131 vocab, 109 frases) com `focus` (falso-cognato, make-do, in-on-at…) | Os mapas das habilidades e as cartas por unidade **referenciam esses ids**. Nada é copiado.                                  |
| Schema Zod estrito (`z.strictObject`, ADR-005), `courseIssues`, `validate:content`, manifesto gerado (ADR-012)                                           | Os novos formatos seguem o mesmo padrão: estrito, com validação cruzada no `validate:content` e um manifesto leve estendido. |
| SRS SM-2 (`domain/srs/sm2.ts`): um `SrsCard` por `itemId`, `applyOutcomes` (menor `q` da sessão), regras de mesmo dia, `isLearned`                       | **Único algoritmo.** Carta = item. Só muda o mapeamento das notas para `q` (§3).                                             |
| `generatePractice` (12 exercícios, por seed, sem `speak`/`fill-blank`) e corretor (`grading/`)                                                           | "Praticar este mapa", o "Teste rápido" do mapa e o modo "digitar" das cartas.                                                |
| `recordLessonResult` transacional com `apply` puro (ADR-008/011)                                                                                         | As sessões de cartas e de mapa entram como novos `kind` (§4.4).                                                              |
| XP, ofensiva, meta, conquistas declarativas                                                                                                              | Novos valores e 5 conquistas novas (§4.5).                                                                                   |
| Tuca em WebP por humor (ADR-014), tokens AA (`tokens.test.ts`), Fredoka + Atkinson                                                                       | Telas novas usam os mesmos humores; o caderno é uma camada de tokens por cima (§8).                                          |
| Export/import JSON `schemaVersion: 1`                                                                                                                    | Vai para `schemaVersion: 2` e continua lendo arquivos v1 (§4.3).                                                             |
| **Protótipo aprovado** (`prototipo/mapas-e-cartas/`): 6 mapas, 60 cartas, 65 cenas SVG, layouts de impressão, tokens do caderno                          | Ponto de partida do conteúdo, da vista do mapa e da impressão. Mapeamento campo a campo no §12.                              |

O que **não** existe no app: nível CEFR no conteúdo, itens fora das unidades, pronúncia simplificada, vista de mapa, impressão. Também não há conteúdo A2 nas unidades (só no protótipo).

## 2. Formato do conteúdo

### 2.1 Pastas e ids

```
src/content/
  units/u0N-*.json        # + campo level (obrigatório)
  banks/<id>.json         # itens que NÃO estão nas unidades
  mindmaps/mm-<slug>.json # um mapa por arquivo
  art/<nome>.svg          # cenas desenhadas dos mapas (§12.3)
  collections.json        # as coleções da aba Mapas (capas, tópicos, entradas)
  decks.json              # baralhos temáticos escritos à mão (começa vazio: [])
  plans/pl-30d.json       # "30 dias com o Tuca" (Fase 5, lote F)
```

| Prefixo                       | Uso                                                                                | Exemplo            |
| ----------------------------- | ---------------------------------------------------------------------------------- | ------------------ |
| `uN-`                         | itens, habilidades e lições das unidades (já existe)                               | `u1-hi`            |
| `fr-` `pv-` `ex-` `fc-` `xa-` | itens dos bancos: frases, phrasal verbs, expressões, falsos cognatos, extras A1/A2 | `pv-001`, `fc-003` |
| `mm-`                         | mapa mental                                                                        | `mm-to-be`         |
| `dk-`                         | baralho temático                                                                   | `dk-viagem`        |
| `pl-`                         | plano de estudos                                                                   | `pl-30d`           |
| `uc-`                         | carta do aluno (**reservado**: proibido no conteúdo)                               | `uc-k3f9a2d1`      |

Os ids dos itens são **permanentes**: viram a chave do `SrsCard`. Os ids numéricos do protótipo (`fr-001`, `pv-001`…) são mantidos.

**Regra central: só existe um lugar para cada item estudável.** Os itens vivem nas unidades ou nos bancos. Mapas, coleções, baralhos e plano apenas **referenciam** `itemId`. É isso que permite o SRS único (§3).

### 2.2 Nível CEFR

```ts
export const cefrLevels = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'] as const;
export const levelSchema = z.enum(cefrLevels);
```

- `unitSchema` ganha `level` **obrigatório**: as 4 unidades recebem `"level": "A1"` (edição mecânica, Fase 2). Itens de unidade herdam o nível da unidade, sem campo por item.
- Bancos, mapas, baralhos temáticos e plano têm `level` próprio.
- **Item de banco pode ter `level` próprio** quando difere do banco (o protótipo mistura A1, A2 e B1 no mesmo baralho, e o selo B1 da decisão 13 precisa disso). O validador proíbe `level` em itens de unidade e confere o teto de 20% de itens B1+ por coleção.
- A interface mostra filtros e selos só para os níveis que têm conteúdo. O schema já aceita A1–C2.

### 2.3 Itens: campos opcionais novos

```ts
// vocabItemSchema e sentenceSchema
pronunciation: z.string().trim().min(1).max(40).optional(), // convenção em prototipo/.../conteudo/LEIA-ME.md
// só sentenceSchema (vocab já tem os dois)
example: z.strictObject({ en: text, pt: text }).optional(),
emoji: z.string().optional(),
// só em bancos (ver §2.2)
level: levelSchema.optional(),
```

O aviso de "cuidado" com falso cognato **não ganha campo novo**: ele aparece quando `focus === 'falso-cognato'`, com o texto de `notes`. O validador passa a exigir `notes` em vocab com esse `focus`.

### 2.4 Bancos de itens

```ts
export const bankIds = [
  'frases',
  'phrasal',
  'expressoes',
  'falsos-cognatos',
  'extra-a1',
  'extra-a2',
] as const;

export const bankSchema = z.strictObject({
  id: z.enum(bankIds),
  title: text,
  level: levelSchema, // padrão dos itens
  vocab: z.array(bankVocabSchema), // vocabItemSchema + level?
  sentences: z.array(bankSentenceSchema), // sentenceSchema + level?
});
```

Os bancos usam **os mesmos schemas** de item das unidades (mais o `level?`). Assim, `indexUnits`, `toPracticeItem`, `generatePractice` e o corretor funcionam sem mudança. Os ids são globais: `courseIssues` passa a checar unicidade entre unidades e bancos, e o prefixo do id tem de bater com o banco.

### 2.5 Mapa mental (formato do protótipo)

O mapa segue a estrutura aprovada no protótipo: **centro → ramos → cartões → linhas**. A profundidade é fixa pelo schema (sem `z.lazy`). Cada linha ou tem texto próprio, ou aponta para um item com `ref`, e é o `ref` que liga o mapa ao SRS.

```ts
export const mapTags = ['regra', 'exemplo', 'excecao', 'erro-comum', 'vocabulario'] as const;
export const branchColors = [
  'folha',
  'jabuticaba',
  'anil',
  'manga',
  'acerola',
  'maracuja',
] as const; // tokens §8
export const mapIcons = [
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
] as const; // ícones desenhados (§8)

const artKey = id; // nome de arquivo em src/content/art/, sem .svg
const richText = text; // aceita **negrito** (pares conferidos)

export const mapLineSchema = z.union([
  z.strictObject({ ref: id, hint: text.max(60).optional() }), // en/pt vêm do item; hint = glosa extra em PT
  z.strictObject({ en: richText, pt: text.optional() }), // regra ou exemplo próprio do mapa
  z.strictObject({ wrong: text, right: text, note: text.optional() }), // ✗ → ✓
  z.strictObject({ note: text }), // observação em PT
]);

export const mapNodeSchema = z.strictObject({
  tag: z.enum(mapTags),
  title: richText.optional(),
  art: artKey.optional(),
  lines: z.array(mapLineSchema).min(1),
});

export const mapQuizSchema = z.strictObject({
  instruction: text,
  items: z
    .array(
      z.strictObject({
        prompt: text, // exatamente uma lacuna BLANK ("___")
        accepted: z.array(pattern).min(1), // padrões ADR-004; o 1º é a resposta exibida
        hintPt: text.optional(),
      }),
    )
    .min(3)
    .max(6),
});

export const mindMapSchema = z.strictObject({
  id, // 'mm-<slug>' = nome do arquivo
  title: text, // PT
  level: levelSchema,
  kind: z.enum(['gramatica', 'vocabulario', 'conversacao']),
  icon: z.enum(mapIcons),
  unitId: id.optional(),
  skillId: id.optional(),
  center: z.strictObject({ en: text, pt: text }),
  centerArt: artKey.optional(),
  intro: text.optional(), // PT, uma ou duas frases
  doodle: text.optional(), // anotação manuscrita (Patrick Hand), redundante
  branches: z
    .array(
      z.strictObject({
        label: text,
        icon: z.enum(mapIcons),
        color: z.enum(branchColors),
        nodes: z.array(mapNodeSchema).min(1),
      }),
    )
    .min(2)
    .max(6),
  quiz: mapQuizSchema.optional(), // "Teste rápido"
});
```

Validações (`mindMapIssues`, puras, rodam no `validate:content` e no carregamento):

1. **Limites** (os mesmos do protótipo e de `docs/mapas-esbocos/GRAMATICA-VISUAL.md`): de 2 a 6 ramos; no máximo **25 cartões** no total (erro). Mais de 5 cartões num ramo ou mais de 4 linhas num cartão geram aviso.
2. Cores de ramo não se repetem. `**` sempre em pares.
3. `art` e `centerArt` existem em `src/content/art/`. Uma cena sem uso gera aviso.
4. `ref` existe em uma unidade ou banco. Se o mapa tem `unitId`, os `ref` vêm dessa unidade, de unidades anteriores ou de bancos de nível ≤ ao do mapa (aviso, e o pedagogo decide).
5. **Sem duplicar**: uma linha `en` cujo texto normalizado (sem `**`) é igual ao `en` de um item existente vira erro, com a mensagem "use ref".
6. Cada mapa precisa de pelo menos **4 `ref` distintos**, para que "Praticar este mapa" sempre funcione.
7. `skillId` pertence a `unitId`. No máximo 1 mapa por `skillId`. `id` igual ao nome do arquivo.
8. `quiz`: uma lacuna por `prompt`, e todos os padrões expandem.

Exibição de uma linha com `ref`: `en` do item (em negrito nos cartões `vocabulario`), `pt` do item (vocab: sentidos juntados por ", ") e, depois, o `hint`, se houver.

### 2.6 Coleções, baralhos e plano

A lista de mapas mentais **não é uma coleção**: ela é a própria aba Mapas (§5.1). As coleções são as capas da estante dessa aba.

```ts
export const collectionSchema = z.strictObject({
  id, // 'frases' | 'phrasal' | 'expressoes' | 'falsos-cognatos' | 'plano'
  order: z.number().int().positive(),
  kind: z.enum(['phrases', 'phrasal-verbs', 'expressions', 'false-friends', 'study-plan']),
  title: text,
  subtitle: text,
  description: text.optional(),
  cover: z.strictObject({
    icon: z.enum(mapIcons),
    color: z.enum(branchColors),
    paper: z.enum(['pautado', 'quadriculado', 'pontilhado']),
  }),
  topics: z.array(z.strictObject({ id, title: text, icon: z.enum(mapIcons) })).optional(),
  entries: z.array(collectionEntrySchema).optional(),
  mapIds: z.array(id).optional(), // phrasal e falsos cognatos: mapas da coleção
  planId: id.optional(),
});

/** How an item is PRESENTED in a collection. The item itself stays in its unit/bank. */
export const collectionEntrySchema = z.strictObject({
  itemId: id,
  topic: id.optional(),
  situation: text.optional(), // PT: quando usar ("Ao pedir a conta")
  formality: z.enum(['informal', 'neutro', 'giria']).optional(),
  avoidWhen: text.optional(), // PT: quando NÃO usar
  baseVerb: z.enum(['get', 'take', 'go', 'put', 'look']).optional(),
});

export const deckSchema = z.strictObject({
  id,
  title: text,
  icon: z.enum(mapIcons),
  level: levelSchema,
  description: text.optional(),
  itemIds: z.array(id).min(5).max(60),
});

export const studyPlanSchema = z.strictObject({
  id,
  title: text, // "30 dias com o Tuca"
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

Regras por `kind` (erro):

- `phrases`: `topic` e `situation` obrigatórios.
- `expressions`: `formality` obrigatório e `avoidWhen` obrigatório quando `formality` não é `neutro`.
- `phrasal-verbs`: `baseVerb` obrigatório.
- `false-friends`: o item é vocab com `focus: 'falso-cognato'`.
- `study-plan`: `planId` existe; no plano, os dias vão de 1 a 30 sem repetição, `lessonId` segue a ordem da trilha e `mapId`, `itemIds` e `lessonId` existem.
- Todos: `itemId` existe, sem entradas repetidas, `mapIds` existem, no máximo 20% de itens B1+.

**Volumes são metas da Fase 5, não regras do schema** (150 frases em 6 tópicos, 40 phrasal com 8 por verbo e 5 mapas, 50 expressões, 30 falsos cognatos em 3 mapas). Assim, o conteúdo do protótipo valida desde a Fase 2. Uma entrada pode apontar para um item de unidade (ex.: `u3-s-the-check-please`): a anotação fica na coleção, e o item continua um só.

**`Card` não é um schema de conteúdo.** A carta é uma **visão derivada** de um item, montada em `domain/cards/flashcard.ts`. O nome é `Flashcard` porque `Card` já é o tipo do SRS em `sm2.ts`:

```ts
type Flashcard = {
  itemId: string; // = SrsCard.itemId
  source: 'unit' | 'bank' | 'user';
  front: { en: string; emoji?: string }; // emoji por enquanto; desenho próprio é trabalho futuro (§10)
  back: {
    pt: string;
    example?: { en: string; pt: string };
    pronunciation?: string;
    caution?: string; // notes, quando focus === 'falso-cognato'
    situation?: string;
    formality?: Formality;
    avoidWhen?: string;
  };
  level?: CefrLevel;
};
```

Cartas automáticas: todo item de unidade ou banco gera uma carta. As linhas de mapa com `ref` reaproveitam a carta do item, e uma linha sem `ref` não vira carta. O único Zod escrito à mão para cartas é o `UserCard`, que é persistido (§4.1). O `Deck` escrito à mão só existe para baralhos **temáticos**. Os demais são derivados (§5.3).

### 2.7 Manifesto e carregamento lazy

`buildManifest` passa a gerar, além de `units` (agora com `level`):

```ts
type CourseManifest = {
  units: ManifestUnit[];
  banks: { id: BankId; level: CefrLevel; file: string; itemIds: string[] }[];
  maps: {
    id: string;
    title: string;
    level: CefrLevel;
    kind: MapKind;
    icon: MapIcon;
    unitId?: string;
    skillId?: string;
    file: string;
    nodeCount: number; // cartões
    itemIds: string[]; // refs distintos
    hasQuiz: boolean;
    search: string; // título + rótulos + linhas normalizados, p/ busca sem carregar o mapa
  }[];
  collections: ManifestCollection[]; // sem as entradas (só contagens, tópicos e níveis)
  decks: { id: string; title: string; icon: MapIcon; level: CefrLevel; itemIds: string[] }[];
  plans: { id: string; file: string; title: string }[];
};
```

- `loader.ts` generaliza `createUnitLoader` para `createJsonLoader(glob, schema, issues)`, com um glob lazy por pasta e um chunk por arquivo, todos no precache do SW. As funções novas são `loadMap(id)`, `loadBank(id)`, `loadCollections()` e `loadPlan(id)`, com cache e `ContentLoadError` como hoje.
- `loadItemIndex(unitIds)` vira `loadItems(itemIds)`: o manifesto diz qual arquivo é dono de cada id, e a função carrega só as unidades e bancos necessários.
- `manifestItemIds()` passa a incluir os bancos. O Praticar e o contador de vencidos (§3) enxergam esses itens, junto com os ids das cartas do aluno.
- `knownWords.generated.ts` inclui os textos dos bancos, para que o "quase certo" continue sem aceitar uma palavra válida no lugar de outra.
- As cenas não passam pelo manifesto: o mapa de nome → URL fica num módulo da feature, carregado só nas rotas lazy (§12.3).
- `manifest.test.ts` confere a coerência como hoje. O `check-prod-bundle` garante que nenhum JSON novo nem nenhuma cena entra no JS inicial (ADR-013).

## 3. SRS compartilhado

**Um item, um `SrsCard`, um histórico.** Não importa se o aluno viu o item na lição, no Praticar, na carta ou no mapa.

| Origem da carta                                                      | `SrsCard.itemId`                                                   |
| -------------------------------------------------------------------- | ------------------------------------------------------------------ |
| Vocab ou frase de unidade                                            | o próprio id (`u1-hi`): a carta mostra o mesmo progresso da trilha |
| Item de banco (frases, phrasal, expressões, falsos cognatos, extras) | id do banco (`fr-001`, `pv-001`…)                                  |
| Linha de mapa com `ref`                                              | o id referenciado (o mapa não tem id de SRS próprio)               |
| Carta do aluno                                                       | `uc-<8+ chars aleatórios>`                                         |

**Notas → `q`.** `Quality` passa a `1 | 2 | 3 | 4 | 5`, e o algoritmo não muda:

| Modo                                         | Origem                                                             | `q`                           |
| -------------------------------------------- | ------------------------------------------------------------------ | ----------------------------- |
| Virar / inverter (autoavaliação)             | Errei · Difícil · Bom · Fácil                                      | **1 · 3 · 4 · 5**             |
| Digitar (corretor existente)                 | certo de primeira · "quase" · errou e acertou na repetição · errou | 5 · 4 · 2 · 1 (igual à lição) |
| Ouvir e reconhecer (múltipla escolha)        | acertou · errou                                                    | 4 · 1                         |
| Esconder o inglês (mapa), opcional por linha | Lembrei · Não lembrei                                              | 4 · 1                         |

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

| Sessão                                        | `kind`     | `lessonId`             | `context`               |
| --------------------------------------------- | ---------- | ---------------------- | ----------------------- |
| Cartas (qualquer modo)                        | `cards`    | `deck:<deckKey>`       | `{ deckKey, planDay? }` |
| Mapa estudado ("Esconder o inglês" concluído) | `map`      | `map:<mapId>`          | `{ mapId, planDay? }`   |
| Praticar este mapa                            | `practice` | `map-practice:<mapId>` | `{ mapId }`             |

O "Teste rápido" do mapa não grava nada: é correção local, sem XP e sem SRS (as lacunas não são itens).

Mudanças no commit:

- **Transação**: inclui `mapProgress`. Com `context.mapId` e `kind ∈ {map, practice}`, o repositório faz upsert de `mapProgress`, como já faz com `lessonProgress`. O `daily.cards` soma as cartas distintas quando `kind === 'cards'`. `lessonProgress` continua só para `lesson`/`review`.
- **`CommitContext` ganha** (todos limitados, sem varrer `results`):
  - `mapProgress?: MapProgress` (do mapa da sessão) — Fase 2, porque o XP "1×/dia" depende dele;
  - `mapsStudiedBefore` (count, até ~35), `cardsReviewedBefore` (soma de `daily.cards` por cursor, como `goalMetCount`), `recentDaily` (`bulkGet` dos 6 dias anteriores) e `mistakesBefore` (cursor com `isMistake`, como `wordsLearnedBefore`) — Fase 6, junto com as conquistas.
- **`AppliedCommit` ganha `xp?: number`**: o `apply` pode definir o XP final dentro da transação (necessário para "mapa 1×/dia"). O repositório grava `result.xp` e o `daily` com esse valor.
- Hoje `isStudy = kind !== 'placement'`, então `cards` e `map` **já contam para ofensiva, meta e daily**. Basta não excluí-los.
- Corações: sessões `cards` e `map` não gastam nem dão corações. O "Praticar este mapa" é prática: dá +1 coração, como o Praticar.
- Conquistas existentes: `perfect-lesson` não acende com `cards` nem `map` (autoavaliação não comprova acerto). Toda checagem de `kind` no código é auditada na Fase 2.

### 4.5 Gamificação

| Regra              | Valor aprovado                                                                                                                                                         |
| ------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Sessão de cartas   | **8 XP** (igual ao Praticar) + 5 se perfeita (nenhum "Errei"/erro) + combo +1 a cada 5 seguidas, no máximo +5. Exige ≥ 5 cartas, ou todas as vencidas se houver menos. |
| Mapa estudado      | **5 XP**, só o primeiro de cada mapa por dia (`apply` vê `mapProgress.lastStudiedDay`). Sem bônus. Repetir no mesmo dia vale 0 XP, mas registra.                       |
| Praticar este mapa | igual ao Praticar: 8 (+5 perfeita, combo ≤ +5), +1 coração                                                                                                             |
| Teste rápido       | 0 XP, não grava                                                                                                                                                        |
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

- `feliz`: aba Mapas e listas;
- `pensando`: "Esconder o inglês", Teste rápido e editor de carta;
- `comemorando`: fim de sessão, dia do plano concluído e conquista;
- `incentivando`: "Meus erros" e baralho vazio.

O humor `triste` não aparece nas telas novas.

## 5. Telas, rotas e navegação

### 5.1 Navegação: 5 itens

**Trilha · Mapas · Praticar · Perfil · Ajustes** (decisão 1).

- **Mapas** é a aba de consulta, com cara de caderno. Ela reúne os mapas mentais e as demais coleções, em duas partes, nesta ordem:
  1. **Estante de coleções**, compacta, no topo: capas pequenas de _Frases do dia a dia_, _Phrasal verbs_, _Expressões e gírias_, _Falsos cognatos_ e _30 dias com o Tuca_ (grade de 2 colunas no celular, uma linha no desktop). A capa do plano mostra "Dia N" quando o plano foi iniciado e só aparece quando o plano existir no conteúdo (Fase 5, lote F). Capas sem conteúdo não aparecem.
  2. **Mapas mentais**, que é o conteúdo principal da aba: lista com filtros por nível, unidade e tipo, busca (pelo `search` do manifesto) e selo "já estudado".
- **Cartas ficam dentro de Praticar** (decisão 2): as cartas revisam **a mesma fila** do Praticar (SRS único). O Praticar vira um hub com três partes:
  - "**N para revisar hoje**", com dois botões: _Revisar com cartas_ e _Revisar com exercícios_;
  - **Baralhos**: por unidade, por mapa, temáticos, Meus erros, Minhas cartas e as coleções de cartas;
  - **Minhas cartas**, com o botão "Nova carta".
- As coleções também aparecem em Praticar como baralhos (`col.<id>`): na aba Mapas o aluno **consulta e imprime**; em Praticar ele **revisa**. Cada tela de coleção tem o atalho "Revisar com cartas".
- 5 itens cabem em 390 px (78 px por alvo; "Mapas" tem 5 letras). No desktop, o trilho lateral ganha o item na mesma posição. O ícone da aba é desenhado (conjunto do §8), não emoji.
- A aba entra na navegação na Fase 3, junto com a tela. A Fase 2 não muda a navegação visível.

### 5.2 Rotas novas (URLs em PT-BR, telas lazy)

| Rota                                                                                                  | Tela                                                                                                      |
| ----------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| `/mapas?nivel=&unidade=&tipo=&estudado=&q=`                                                           | Aba Mapas: estante de coleções + lista de mapas com filtros e busca (Tuca feliz)                          |
| `/mapas/colecoes/:collectionId`                                                                       | Coleção por tópico (frases; phrasal e falsos cognatos com seus mapas; expressões com selo de formalidade) |
| `/mapas/plano`                                                                                        | "30 dias com o Tuca": dia atual, 3 checks por dia e check manual                                          |
| `/mapas/:mapId`                                                                                       | Visualizador do mapa (tela cheia com voltar; a barra inferior some no celular)                            |
| `/mapas/:mapId/praticar`                                                                              | Minilição (`LessonPlayer`, `kind: 'practice'`)                                                            |
| `/praticar`                                                                                           | Hub (§5.1)                                                                                                |
| `/baralho/:deckKey`                                                                                   | Lista de cartas, escolha de modo, imprimir                                                                |
| `/cartas/sessao?baralho=&modo=`                                                                       | Sessão de cartas (tela cheia)                                                                             |
| `/cartas/nova` · `/cartas/:id`                                                                        | Editor de carta do aluno                                                                                  |
| `/imprimir/mapa/:mapId` · `/imprimir/baralho/:deckKey?por-folha=8` · `/imprimir/apostila/:apostilaId` | Páginas de impressão (§7). `apostilaId` = `mapas` (todos os mapas) ou um `collectionId`                   |

Os segmentos fixos (`colecoes`, `plano`) têm prioridade sobre `:mapId` no `react-router`, e todo `mapId` começa com `mm-`, então não há colisão. Tudo em `/mapas/*` destaca a aba Mapas.

Integrações com telas existentes:

- **Trilha**: faixa "N cartas para revisar hoje" e "Dia 7 de 30 dias com o Tuca", se o plano foi iniciado. O contador usa o `usePractice` que já existe, sem import novo no caminho inicial.
- **Fim da 3ª lição de uma habilidade e tela da dica**: botão "Ver mapa da habilidade", quando o manifesto tem um mapa com aquele `skillId`.
- **Perfil**: "mapas estudados" e "cartas revisadas".

### 5.3 Chaves de baralho (derivadas em `domain/cards/decks.ts`)

`unit.<unitId>` · `skill.<skillId>` · `map.<mapId>` · `theme.<deckId>` · `col.<collectionId>[.<topic>]` · `erros` · `minhas` · `hoje` (vencidas de tudo). As chaves são seguras para URL e são gravadas em `context.deckKey`.

### 5.4 Sessão de cartas

Estados puros em `domain/cards/session.ts`: `presenting → flipped → rated → … → finished`. A fila reinsere "Errei" uma vez, e o resumo gera `itemOutcomes` (§3). O comportamento de partida é o do protótipo aprovado: na frente só há "Virar carta"; as notas só aparecem depois de virar.

- **Modos**:
  - _Virar_ (EN → PT), com 3D `rotateY` em Framer Motion. Com reduced motion, vira fade.
  - _Inverter_ (PT → EN).
  - _Digitar_: vocab de PT para EN (usa `en` + `acceptedEn`); frases de EN para PT (usa `acceptedPt`, mais robusto). Itens de banco sem `acceptedPt`/`acceptedEn` ficam fora deste modo até a auditoria do Lote A (Fase 5). Ver o risco no §10.
  - _Ouvir e reconhecer_: TTS e 4 opções em PT. Sem TTS, o modo fica oculto.
- **Gestos** (só depois de virar): arrastar para a direita = Bom, para a esquerda = Errei, usando o `drag` do Motion (sem dependência nova). Os botões sempre existem, então o gesto nunca é o único caminho.
- **Teclado**: Espaço/Enter vira, `1`–`4` dão a nota, `←`/`→` = Errei/Bom, `Esc` sai com confirmação. Feedback em `aria-live`, e todo trecho em EN leva `lang="en"`.
- No desktop, a carta fica deitada, na proporção da carta impressa (95 × 67 mm).
- Cartas do aluno no modo digitar: são comparadas como texto literal, sem padrões. Por isso o schema proíbe `( ) [ ] |`.

## 6. Motor dos mapas (`src/domain/mindmap/` + `src/features/mindmap/`)

### 6.1 Vista principal: árvore vertical do protótipo

A vista aprovada no protótipo é uma **árvore vertical em HTML**, na ordem do conteúdo (esboço B com a "pele" do C, `docs/mapas-esbocos/GRAMATICA-VISUAL.md` §10). Ela é a vista do app.

- Cabeçalho: ícone, título com marca-texto, selo de nível, `intro` e cena do centro. O centro mostra `center.en` (`lang="en"`) e `center.pt`.
- Cada ramo é uma seção recolhível (`button aria-expanded`, alvo ≥ 48 px) com nome, ícone e cor do ramo. Há também "Abrir tudo / Fechar tudo".
- O cartão tem etiqueta da tag com **forma, ícone e rótulo** (nunca só cor), título opcional, linhas e a cena à direita, alinhada à base (`<img alt="">`, decorativa). No desktop, a coluna tem ~760 px e os cartões ficam lado a lado dentro de cada ramo.
- **Linhas**: `en` com `lang="en"` e `**negrito**` renderizado sem `dangerouslySetInnerHTML` (parser puro `parseBold` em `domain/mindmap/richText.ts`); `wrong`/`right` com ✗ riscado e ✓ em negrito; `note` em PT.
- Tocar num trecho em inglês fala o texto (serviço de TTS atual). Sem voz en-US, o botão some e um aviso explica o motivo.
- Tocar numa linha com `ref` abre um painel inferior com EN, PT, exemplo, pronúncia e "cuidado", e oferece "Adicionar ao baralho de hoje", que leva à sessão `map.<id>`.
- **Esconder o inglês**: um post-it kraft cobre cada trecho em inglês; o título e o português continuam visíveis. Tocar revela. Uma linha com `ref` oferece "Lembrei / Não lembrei" (§3). Revelar todos conclui o estudo (commit `kind: 'map'`). Estado puro em `domain/mindmap/reveal.ts`.
- **Teste rápido** (`quiz`): lacunas conferidas pelo corretor existente (`grading/`, padrões ADR-004) e "Ver respostas". Estado puro em `domain/mindmap/quiz.ts`. Não grava (§4.4).
- **Praticar este mapa**: `generatePractice` sobre os `ref` do mapa (`domain/mindmap/mapItems.ts`).
- **Acessibilidade**: estrutura nativa (títulos, listas, botões), ordem de leitura = ordem do JSON, foco visível, alvos ≥ 44 px, `lang="en"` em todo trecho em inglês, reduced motion (abrir e fechar ramo sem animação).
- **Desempenho**: rota, JSON do mapa e cenas são lazy (ADR-013). As cenas usam `loading="lazy"` e têm `width`/`height` fixos (sem salto de layout). Sem filtros SVG na tela.

### 6.2 Fora do escopo: vista radial, pan/zoom e PNG

Em 2026-11-03 o usuário reviu a decisão 9: a vista radial em SVG com pan/zoom **saiu do escopo**. A única vista do mapa é a árvore vertical do §6.1. Com isso saem também o layout radial (`layout.ts`, `sketchPath`), o `usePanZoom.ts`, a árvore `role="tree"` sincronizada, o `d3-hierarchy` como plano B e a exportação **PNG**. O PDF (§7) continua.

## 7. Exportação e impressão

**PDF pela impressão do navegador** (decisão 8, ADR-016): rotas `/imprimir/*` com páginas já paginadas pelo app, cada folha uma `<section>` de tamanho fixo em mm com `break-after: page`, `@page` com margem zero e `window.print()`. Números de página e sumário são calculados por nós (`domain/print/paginate.ts`). Antes de imprimir, a tela mostra um guia curto: "Salvar como PDF, escala 100%, frente e verso pela borda longa". Se o teste em iPhone da Fase 7 falhar, o plano B é jsPDF **lazy só na rota de impressão**, com nova aprovação do usuário.

**Sem exportação PNG** (fora do escopo, §6.2). Quem quiser imagem salva o PDF.

**Layouts aprovados no protótipo** (`print.js`/`print.css`, PDFs em `prototipo/mapas-e-cartas/pdf/`). Eles são a especificação da Fase 7:

- **Mapa**: A4 **paisagem**, só frente, ramos em colunas de cartões (esboço A).
  - Corpo de 10,5 pt; tenta 1 página a ≥ 10 pt, depois 2 páginas a ≥ 10 pt (divisão de ramos que deixa a página mais vazia o mais cheia possível) e só então reduz até 9 pt. Abaixo de 10 pt, as traduções passam para uma tinta mais escura.
  - Mapa ilustrado: cenas de 24 → 20 mm em 1 página, ou 24–28 mm em 2 páginas.
  - **Teste rápido sempre na página seguinte**, com lacunas para escrever e o **gabarito de cabeça para baixo** no pé.
  - Espaço "Minhas anotações" quando sobra lugar. Etiquetas com forma e ícone, então a página funciona em P&B.
  - Nada a menos de 8 mm da borda da folha.
- **Cartas**: A4 **retrato**, **8 por folha** (2 × 4, 95 × 67 mm), linhas de corte tracejadas, margem interna de 3 mm.
  - Páginas ímpares: frentes (emoji + inglês). Páginas pares: versos (tradução, exemplo, pronúncia, quando usar), **espelhados** para virar pela borda longa. A ordem vem de `paginateCards(items, perSheet)`, pura e testada.
  - Alinhamento frente/verso conferido com tolerância de **0,1 mm**.
  - A fonte do verso **nunca diminui** (10,5 pt). Carta cujo verso não cabe é erro de conteúdo: o teste lista a carta e quantos milímetros passam, e o texto é encurtado.
  - 10 por folha (2 × 5) continua como opção, a validar na Fase 7 com as mesmas regras.
- **Apostila**: capa, sumário com páginas e conteúdo. `apostila/mapas` reproduz o `mapas.pdf` do protótipo (capa, sumário com legenda das tags, uma ou duas páginas por mapa + teste). Apostila de coleção: cartas em lista com tradução, situação e formalidade; páginas pautadas para anotações ao fim de cada seção; margem de encadernação de 20 mm alternando o lado; rodapé com "Falaê" e nível, sem URL.

Aceite automatizado: Playwright gera `page.pdf({ preferCSSPageSize: true })` das rotas e confere número de páginas, tamanho A4, a margem de 8 mm, o alinhamento de 0,1 mm e o transbordo dos versos (as mesmas checagens do `pdf.mjs` do protótipo, portadas para teste). As capturas das páginas (imagens só para revisão, não exportação do app) vão para o designer.

## 8. Estética de caderno

É uma camada por cima da identidade atual (Manga, Anil, Areia, Noite, Tuca), sem marca nova. **Os valores vêm do protótipo aprovado** (`prototipo/mapas-e-cartas/styles.css`, claro e escuro), com contraste já calculado em `GRAMATICA-VISUAL.md` §2 e §8. Eles entram em `src/styles/tokens.css` e no tema do Tailwind, e o `tokens.test.ts` passa a conferir os pares novos:

```css
:root {
  --paper: #fff8ef;
  --paper-card: #fffdf8;
  --paper-line: #e8dcca;
  --paper-dot: #d6c6aa; /* textura < 3:1 de propósito */
  --marker: #f5c518; /* marca-texto do título */
  --postit: #e8d2ad;
  --postit-edge: #8c6a3f; /* kraft do "Esconder o inglês" */
  --mark-wrong: #8a1a12;
  --mark-right: #0a5c29;
  /* por cor de ramo: fill / on / stroke / key / tint */
  --map-folha-fill: #0f7a37;
  --map-folha-on: #fff;
  --map-folha-stroke: #0f7a37;
  --map-folha-key: #0a5c29;
  --map-folha-tint: #ddf5e3;
  /* … jabuticaba #6f2a91, anil #3b3fb6, manga #ff8a1f (stroke #a84e00), acerola #b42318, maracuja #f5c518 (stroke #8a6a00) */
}
.dark {
  --paper: #14152b;
  --paper-card: #1e2040;
  --postit: #4a3a28;
  --postit-edge: #d2b285; /* … variantes claras dos ramos */
}
```

- **Jabuticaba** (`#6F2A91`, escuro `#C58CF0`) é a única cor nova da paleta, usada no ramo "Negativa" e em capas. Ela já está no protótipo aprovado e nas cenas.
- **Regras**: o texto é sempre `ink`; a cor do ramo é preenchimento do título, traço e texto-chave (variante `key`), sempre com ícone ou rótulo. O modo escuro é um "caderno à noite". A impressão usa sempre o papel claro.
- **Fontes**: títulos em Fredoka, texto de estudo em Atkinson Hyperlegible (como hoje). **Patrick Hand** (decisão 10) só em acentos manuscritos: `doodle`, anotações e subtítulos de capa, com mínimo de 22 px na tela e 12 pt no papel, sempre redundante. Vem de `@fontsource/patrick-hand` (subset latin, 1 peso, ~24 kB woff2) e é carregada **só nas rotas de mapa, coleção e impressão** (CSS da feature).
- **Ícones desenhados**: os 16 ícones de ramo e tag (`mapIcons`) e os chips das 5 tags vêm do `common.js` do protótipo e viram componentes SVG próprios em `src/ui/notebook/`. As cenas seguem `ESTILO.md` (§12.3).
- Rabiscos, ícones e cenas são SVGs próprios, feitos para o Falaê. Nada do kit de referência.

## 9. Dependências

| Dependência                | Tamanho                              | Necessária?                                                 | Aprovação                 |
| -------------------------- | ------------------------------------ | ----------------------------------------------------------- | ------------------------- |
| `@fontsource/patrick-hand` | ~24 kB de fonte (1 peso), fora do JS | sim                                                         | **aprovada** (decisão 10) |
| `jspdf` (+ `svg2pdf.js`)   | ~120–150 kB gzip, lazy               | só se a impressão no iOS falhar                             | **sim** (pesada)          |
| Gestos, ícones, cenas      | —                                    | resolvidos com Motion (já instalado), SVG próprio e `<img>` | —                         |

Precache: os 6 mapas do protótipo e os ~33 previstos (~6 kB cada), ~270 itens nos bancos (~250 kB de JSON cru, ~50 kB gzip) e as cenas (~3 kB cada: 65 hoje, ~200 kB cru; cerca de 10 por mapa novo). Tudo lazy e fora do JS inicial.

## 10. Plano por fase

Os planos ficam em `docs/fases/mapas-e-cartas/FASE-N.md`, porque `docs/fases/FASE-2..7.md` já pertencem à v1. Toda fase de código passa por `desenvolvedor` → `revisor-de-codigo` + `qa-tester` (em paralelo) → correção → nova verificação. Portão: 0 bloqueantes e lint/typecheck/test/e2e verdes.

| Fase                           | Entregas                                                                                                                                                                                                                                                                                                                                                               | Verificação extra                                                                                                                       |
| ------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| **2 Base**                     | Plano em `docs/fases/mapas-e-cartas/FASE-2.md`. `level` e campos opcionais; schemas `bank`, `mindMap`, `collection`, `deck`, `studyPlan` com `*Issues`; manifesto e loaders; Dexie v2 + **teste de migração**; backup v2 lendo v1; `Repository` novo; `kind` `cards`/`map`; tokens do caderno; agentes e skills; **port do protótipo** (6 mapas, 60 cartas, 65 cenas). | migração, backup e commit revisados pelo `revisor-de-codigo` em `opus`; port: `revisor-linguistico` + `pedagogo`                        |
| **3 Motor dos mapas**          | Vista única do §6.1, sem radial nem pan/zoom (árvore vertical, esconder o inglês, TTS, painel, Teste rápido, Praticar este mapa); aba Mapas com estante e lista com filtros e busca; Patrick Hand e ícones desenhados. Usa os **6 mapas portados**.                                                                                                                    | visual: `designer-de-mapas` (390×844 e desktop, claro, escuro e P&B) + `revisor-ux`                                                     |
| **4 Motor das cartas**         | `flashcard`, `session`, `select`, `decks`, `isMistake`, `Quality` 1–5; 4 modos, gestos, teclado; hub do Praticar; baralhos derivados; Minhas cartas (CRUD, limite, export); contador na Trilha. Usa as **60 cartas portadas**.                                                                                                                                         | `revisor-ux`; `designer-de-mapas` (visual da carta)                                                                                     |
| **5 Conteúdo (em lotes)**      | A: 15 mapas de habilidade + auditoria de `acceptedEn`/`acceptedPt` dos bancos. B: 8 mapas temáticos (incl. falsos cognatos 2 e 3) + banco `extra-a1/a2`. C1–C2: ~96 frases. D: 28 phrasal + 4 mapas. E: 38 expressões + 18 falsos cognatos. F: baralhos temáticos + "30 dias com o Tuca". Cenas de cada mapa novo junto com o mapa.                                    | por lote: `autor-de-conteudo` → `revisor-linguistico` + `pedagogo` → correção → reconfirmação; cenas e capturas aprovadas pelo designer |
| **6 Gamificação e integração** | XP por `kind`, mapa 1×/dia, contadores do `CommitContext`, 5 conquistas, Tuca nas telas, "Ver mapa da habilidade", tela do plano, capas finais, perfil                                                                                                                                                                                                                 | `revisor-ux`                                                                                                                            |
| **7 Exportação e impressão**   | Rotas `/imprimir/*` com os layouts do §7; cartas 8 (e 10) por folha com frente e verso; apostilas; checagens do `pdf.mjs` como testes `page.pdf()`; checklist manual em iPhone (Safari e PWA) e Android. Sem PNG (fora do escopo).                                                                                                                                     | `designer-de-mapas` aprova o PDF; `revisor-ux`                                                                                          |
| **8 QA final**                 | E2E (mobile e desktop): usuário v1 com progresso semeado atualiza e mantém tudo → abre mapa → pratica o mapa → cartas deslizando → cria carta própria → gera PDF → `advanceDays(1)` → cartas vencidas no contador e na sessão. Offline após a 1ª visita; Lighthouse ≥ 90; orçamento ADR-013; README atualizado; destino da pasta `prototipo/`.                         | todos os revisores                                                                                                                      |

**Volume de conteúdo**: a meta continua ~33 mapas (16 de habilidade, 12 temáticos, 5 de phrasal) e ~270 itens novos nos bancos. **O protótipo já entrega 6 mapas e 60 cartas aprovados**, que contam para a meta:

| Tipo                           | Meta         | Do protótipo                                                                | Falta |
| ------------------------------ | ------------ | --------------------------------------------------------------------------- | ----- |
| Mapas de habilidade            | 16           | 1 (`mm-u1-sk1`)                                                             | 15    |
| Mapas temáticos                | 12           | 4 (`mm-to-be`, `mm-in-on-at`, `mm-numeros-e-horas`, `mm-falsos-cognatos-1`) | 8     |
| Mapas de phrasal               | 5            | 1 (`mm-phrasal-get`)                                                        | 4     |
| Frases (itens novos)           | ~120         | 24                                                                          | ~96   |
| Phrasal verbs                  | 40           | 12                                                                          | 28    |
| Expressões                     | 50           | 12                                                                          | 38    |
| Falsos cognatos                | 30           | 12                                                                          | 18    |
| Extras (vocabulário dos mapas) | ~40          | os que o port criar (estimativa ~10)                                        | ~30   |
| Cenas                          | ~10 por mapa | 65                                                                          | ~270  |

Faltam cerca de **27 mapas e ~210 itens**. A revisão continua sendo o gargalo, então os lotes têm no máximo 50 itens ou 4 mapas por ciclo. As cenas são o novo custo: ~5 a 10 minutos de agente por cena (`ESTILO.md`), entregues por mapa e revisadas em folha de contato.

**Trabalho futuro (fora das fases 2–8)**:

- **Ilustrações das cartas**: as cartas continuam com **emoji** na frente por enquanto. O usuário decidiu desenhá-las depois, no mesmo estilo das cenas. Quando isso acontecer, os itens ganham um campo opcional `art?` (mudança de formato com aprovação), a carta usa a cena no lugar do emoji, e a impressão deixa de depender da fonte de emoji do sistema.

**Riscos e mitigação**:

1. **A2 não existe nas unidades**. Na v1 o A2 aparece só em bancos, mapas e cartas (present continuous, phrasal, expressões). As unidades A2 continuam no ROADMAP. "30 dias com o Tuca" usa as lições A1 existentes (52 lições em 30 dias, cerca de 1,7 lição por dia).
2. **30 falsos cognatos estouram o limite de cartões**. São 3 mapas de 10 (`mm-falsos-cognatos-1` já existe). Os itens ficam no banco `falsos-cognatos`; os ~8 que já existem nas unidades entram na coleção por `itemId`, sem duplicar.
3. **Sobreposição de mapas temáticos com os de habilidade** (números, horas, to be). Os temáticos cobrem a gramática transversal e os de habilidade, o vocabulário. O pedagogo verifica isso.
4. **Pronúncia simplificada pode fixar erros**. A convenção já está escrita (`prototipo/mapas-e-cartas/conteudo/LEIA-ME.md`) e vai para a skill `criar-baralho`; o botão de áudio sempre vem junto, e sons sem equivalente em PT ficam sem transcrição.
5. **PT→EN digitado** é injusto se o `acceptedEn` estiver incompleto. Os itens do protótipo não têm `acceptedEn`/`acceptedPt`: ficam fora do modo Digitar até a auditoria do Lote A. Na v1, frases ficam em EN→PT.
6. **Gírias datadas, regionais ou ofensivas**: `avoidWhen` é obrigatório e passam pela revisão linguística e pelo pedagogo.
7. **Impressão no iOS** (PWA instalado): teste em aparelho na Fase 7, com o plano B do §7.
8. **Autoavaliação inflada** ("Fácil" sempre) deixa o SRS otimista. Mitigação: o "Fácil" nunca vale mais que um acerto de lição, e "Meus erros" usa `lapses`.
9. **Abas antigas abertas** durante a migração: tratadas com o aviso de `versionchange`.
10. **Orçamento do JS inicial**: todas as rotas novas são lazy, as cenas são arquivos (não strings no JS) e o contador da Trilha usa a store que já existe.
11. **Port com divergência silenciosa**: ao trocar linhas por `ref`, o português exibido passa a ser o do item. O script do port lista toda diferença entre o texto do protótipo e o do item, e o revisor decide (`hint`, ajuste no item ou manter como texto).
12. **Emoji nas cartas impressas** muda de desenho conforme o sistema que gera o PDF. Aceito até as ilustrações das cartas.

## 11. Decisões submetidas ao usuário

Lista original de 2026-11-03 (as respostas estão na tabela abaixo; o texto das seções acima já reflete as respostas).

1. **Navegação**: 5 itens (Trilha · Coleções · Praticar · Perfil · Ajustes), com os mapas em Coleções → Mapas mentais. Alternativa: aba literal "Mapas", com as demais coleções dentro dela.
2. **Cartas dentro de Praticar** (hub "N para revisar hoje": cartas ou exercícios), sem aba própria.
3. **Formato do conteúdo**: `level` obrigatório nas unidades; `pronunciation` opcional nos itens; pastas novas `banks/`, `mindmaps/`, `collections.json`, `decks.json`, `plans/`; itens fora das unidades só em bancos.
4. **Dados persistidos**: Dexie v2 com `userCards`, `mapProgress` e `planProgress`; `kind` `cards`/`map`; `context` e `daily.cards` opcionais; backup `schemaVersion: 2`, que continua lendo v1.
5. **Notas das cartas**: Errei 1 · Difícil 3 · Bom 4 · Fácil 5, no mesmo SM-2.
6. **XP**: cartas 8 (+5 perfeita, combo ≤ +5, mínimo 5 cartas); mapa estudado 5, uma vez por mapa por dia; "Praticar este mapa" = Praticar (+1 coração); cartas e mapas não mexem em corações.
7. **"Meus erros"** = itens com `lapses ≥ 1` e `reps < 2`, derivado.
8. **PDF via impressão do navegador** e PNG via canvas. jsPDF só se o iPhone falhar, com nova aprovação.
9. **Layout e pan/zoom próprios**, sem `d3-hierarchy`.
10. **Fonte manuscrita OFL** via `@fontsource`, só nas telas de caderno.
11. **Pronúncia simplificada** como campo opcional, com convenção do pedagogo.
12. **Nome do plano de 30 dias**: "Caderno de 30 dias", "30 dias com o Tuca" ou "Rota 30".
13. **Itens B1 nas coleções da v1**: permitir com selo honesto, no máximo 20% por coleção.

### Respostas do usuário (2026-11-03)

| #   | Decisão                                     | Resposta                                                                                                                          |
| --- | ------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Navegação                                   | **Alternativa**: aba **"Mapas"**, com as demais coleções dentro dela                                                              |
| 2   | Cartas dentro de Praticar                   | Aprovado                                                                                                                          |
| 3   | Formato do conteúdo                         | Aprovado                                                                                                                          |
| 4   | Dados persistidos (Dexie v2, backup v2)     | Aprovado                                                                                                                          |
| 5   | Notas Errei 1 · Difícil 3 · Bom 4 · Fácil 5 | Aprovado                                                                                                                          |
| 6   | XP                                          | Aprovado ("mesmo teto e bônus" = os das sessões atuais)                                                                           |
| 7   | "Meus erros" derivado                       | Aprovado                                                                                                                          |
| 8   | PDF via impressão do navegador              | Aprovado                                                                                                                          |
| 9   | Layout e pan/zoom próprios                  | Aprovado; **revisto em 2026-11-03**: vista radial, pan/zoom e PNG saem do escopo, e fica só a árvore vertical do protótipo (§6.2) |
| 10  | Fonte manuscrita                            | **Patrick Hand** (a mesma do protótipo), no lugar de Shantell Sans                                                                |
| 11  | Pronúncia simplificada                      | Aprovado                                                                                                                          |
| 12  | Nome do plano                               | **"30 dias com o Tuca"**                                                                                                          |
| 13  | Itens B1 (máx. 20% por coleção, com selo)   | Aprovado                                                                                                                          |

Também aprovado: o protótipo `prototipo/mapas-e-cartas/` (conteúdo revisado pelo `revisor-linguistico`, cenas e layouts de impressão), com as cartas em emoji por enquanto.

### Segunda rodada de respostas (2026-11-03)

| #   | Pendência                                                                                                                                                                                   | Resposta                                                                                                              |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| 1   | Ajustes de formato vindos do protótipo (ADR-017): mapa ramo → cartão → linha com `ref`/`hint` e `quiz`; `level` por item de banco; `example?`/`emoji?` em frases; coleção "Falsos cognatos" | **Aprovado**                                                                                                          |
| 2   | Vista radial com pan/zoom                                                                                                                                                                   | **Sai do escopo**: só a árvore vertical do protótipo; a exportação PNG também sai, o PDF continua (decisão 9 revista) |

Não há pendências abertas com o usuário neste plano.

## 12. Protótipo aprovado → app

O protótipo é o ponto de partida. Depois do port (Fase 2), **a fonte da verdade passa a ser `src/content/`**: a pasta `prototipo/mapas-e-cartas/` fica congelada como referência e não recebe mais edições. O destino dela é decidido na Fase 8.

O port é feito por um script descartável (`scripts/port-prototype.ts`), rodado uma vez: ele gera os JSON do app, imprime um relatório das decisões que exigem pessoa (diferenças de texto, linhas sem item, ids) e é removido no commit seguinte. O que o script não resolve, o `autor-de-conteudo` completa à mão.

### 12.1 Mapas (6)

| Protótipo (`conteudo/mapas/`)                                                         | App (`src/content/mindmaps/`)                                                                                                                                                        |
| ------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| arquivo `<slug>.json`, `id: <slug>`                                                   | `mm-<slug>.json`, `id: mm-<slug>`; `skill-u1-sk1` → `mm-u1-sk1` com `unitId: "u1-unit"` e `skillId: "u1-sk1"`                                                                        |
| —                                                                                     | `kind` (novo, obrigatório): `to-be` e `in-on-at` → `gramatica`; `numeros-e-horas`, `falsos-cognatos-1` e `phrasal-get` → `vocabulario`; `u1-sk1` → `conversacao` (pedagogo confirma) |
| `collection: "mapas"`                                                                 | removido (todo mapa aparece na aba Mapas)                                                                                                                                            |
| `collection: "phrasal"`                                                               | removido; o id entra em `mapIds` da coleção `phrasal` (`mm-falsos-cognatos-1` entra em `falsos-cognatos`)                                                                            |
| `title`, `level`, `icon`, `center`, `intro`, `doodle`, `centerArt`                    | iguais                                                                                                                                                                               |
| `figureStyle`, `centerFigure`, `branches[].figure`, `nodes[].figure`, `lines[].emoji` | descartados: os 6 mapas usam `figureStyle: "art"`, e o build do protótipo já os removia                                                                                              |
| `branches[].label/icon/color/nodes`, `nodes[].tag/title/art/lines`                    | iguais                                                                                                                                                                               |
| linha `{ en, pt }` cujo `en` sem `**` é igual ao `en` de um item                      | `{ ref }` (+ `hint` com a parte do `pt` do protótipo que o item não tem, se o revisor quiser manter)                                                                                 |
| linha de vocabulário sem item correspondente (ex.: _happy_, _late_ no `to-be`)        | novo item no banco certo (`extra-a1`/`extra-a2`, `phrasal`, `falsos-cognatos`) + `{ ref }`, ou fica texto; cada mapa precisa de ≥ 4 `ref`                                            |
| demais linhas `{ en, pt }`, `{ wrong, right, note }`, `{ note }`                      | iguais                                                                                                                                                                               |
| `exercise.instruction`, `items[].prompt`, `items[].hintPt`                            | `quiz.instruction`, `quiz.items[].prompt`, `quiz.items[].hintPt`                                                                                                                     |
| `exercise.items[].answer: "isn't\|is not"`                                            | `quiz.items[].accepted: ["isn't", "is not"]` (padrões ADR-004; o 1º é a resposta exibida)                                                                                            |

### 12.2 Cartas (60) → bancos e coleções

| Baralho do protótipo              | Banco no app                      | Schema do item                     | Coleção (`collections.json`)                          |
| --------------------------------- | --------------------------------- | ---------------------------------- | ----------------------------------------------------- |
| `frases-dia-a-dia` (24, `fr-`)    | `banks/frases.json` (A1)          | frase                              | `frases`: `topic` + `situation`                       |
| `expressoes-e-girias` (12, `ex-`) | `banks/expressoes.json` (A2)      | frase                              | `expressoes`: `formality`, `avoidWhen`, `situation`   |
| `phrasal-essenciais` (12, `pv-`)  | `banks/phrasal.json` (A2)         | vocab                              | `phrasal`: `baseVerb`; `mapIds: ["mm-phrasal-get"]`   |
| `falsos-cognatos` (12, `fc-`)     | `banks/falsos-cognatos.json` (A2) | vocab com `focus: "falso-cognato"` | `falsos-cognatos`; `mapIds: ["mm-falsos-cognatos-1"]` |

Campo a campo:

| Carta do protótipo                      | App                                                                                                                                               |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| `id`, `en`                              | iguais (o id é permanente)                                                                                                                        |
| `pt`                                    | vocab: `pt: [texto]` (dividir sentidos é opcional e passa pelo revisor); frase: `pt` igual                                                        |
| `emoji`                                 | `emoji` do item (frente da carta)                                                                                                                 |
| `example`                               | `example` do item                                                                                                                                 |
| `pronunciation`                         | `pronunciation` do item                                                                                                                           |
| `level`                                 | `level` do item **só** quando difere do nível do banco                                                                                            |
| —                                       | `difficulty` (obrigatório): A1 → 1, A2 → 2, B1 → 3; o autor ajusta                                                                                |
| —                                       | `acceptedPt`/`acceptedEn`: ausentes; item fora do modo Digitar até a auditoria (§5.4)                                                             |
| `situation`                             | entrada da coleção. Em frases, o prefixo antes de ":" vira `topic` ("Cumprimentos:" → `cumprimentos`) e o resto vira `situation`                  |
| `formality`                             | entrada da coleção                                                                                                                                |
| `dontUse`                               | `avoidWhen` na entrada da coleção                                                                                                                 |
| `falseFriend`                           | `notes` do item (texto do "cuidado"); se vier `true` sem texto, o autor escreve                                                                   |
| `baseVerb`                              | entrada da coleção                                                                                                                                |
| baralho `title`, `description`, `level` | coleção `title`/`description`; `subtitle`, `cover.icon` e `cover.color` vêm da tabela `COLLECTIONS` do `build.mjs`; `level` vira o nível do banco |

As capas seguem o protótipo: Frases (`chat`, folha), Phrasal verbs (`swap`, jabuticaba), Expressões e gírias (`star`, manga), Falsos cognatos (`ban`, acerola). A capa de "30 dias com o Tuca" é definida no lote F. O `decks.json` começa vazio, porque todo baralho do protótipo virou coleção.

### 12.3 Cenas (65 SVG)

- **Onde ficam**: `prototipo/mapas-e-cartas/ilustracoes/cenas/*.svg` → `src/content/art/<nome>.svg`, com os mesmos nomes (são as chaves de `art`/`centerArt`). As cenas seguem `ESTILO.md` (`viewBox` 160, `<title>` PT, sem texto, `<defs>`, filtros nem ids, fundo `#FFF1D6` que garante leitura no tema escuro). O `ESTILO.md` é copiado para a skill `criar-mapa-mental`.
- **Como carregam**: um módulo da feature, `src/features/mindmap/art.ts`, importado só pelas rotas lazy, faz `import.meta.glob('../../content/art/*.svg', { query: '?no-inline', import: 'default', eager: true })`. O resultado é um mapa nome → URL com hash: ~65 strings curtas no chunk da feature, sem o conteúdo das SVG. Se `?no-inline` não estiver disponível na versão do Vite, o `assetsInlineLimit` em função exclui `src/content/art/`.
- **Como aparecem**: `<img src alt="" aria-hidden="true" loading="lazy" decoding="async" width height>`. A cena é decorativa: a informação está no texto do cartão. `<img>` com SVG sai vetorial na impressão.
- **Offline**: `svg` já está em `globPatterns` do `vite-plugin-pwa`, então as cenas entram no precache.
- **Garantias**: `validate:content` falha se um `art` não tem arquivo e avisa se um arquivo não é usado. Um teste confere que cada SVG segue as regras do `ESTILO.md` (sem `<text>`, `<defs>`, `filter`, `id=`, `<script>`, nem atributos `on*`), porque as cenas entram no site. O `check-prod-bundle` falha se alguma cena (ou `data:image/svg+xml`) aparecer no JS inicial.
- Os 16 SVGs 64×64 do piloto (`ilustracoes/*.svg`) não são portados agora. Eles voltam a ser avaliados com as ilustrações das cartas (trabalho futuro).

### Ajustes da etapa 3 (2026-11-03)

- **Um lugar para cada item (§2.1):** um item de banco não pode ter o mesmo `en` normalizado de um item de unidade; a entrada de coleção aponta para o item da unidade. No port, `fc-001`, `fc-002`, `fc-003`, `fc-005`, `fr-001` e `pv-001` viram referências a `u1-actually`, `u4-pretend`, `u3-push`, `u2-parents`, `u1-s-nice-to-meet-you` e `u4-get-up`.
- **`topic` da entrada precisa constar em `topics`** da coleção (regra mais rígida que o §2.6, aceita).
- **Linha só com `right`** em `falsos-cognatos-1` (ramo 6, cartão 2): no port vira `{ en }`; o schema continua com as 4 formas do §2.5.
- **Mínimo de 4 `ref`:** `mm-to-be`, `mm-numeros-e-horas` e `mm-in-on-at` ganham itens novos em `extra-a1`/`extra-a2` na etapa 10, revisados pelo `revisor-linguistico` e pelo `pedagogo`.
