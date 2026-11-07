# Mapas e cartas — Fase 4: Motor das cartas

**Objetivo:** pôr no ar as cartas dentro do Praticar sobre as 60 cartas portadas e os itens das unidades. No fim da fase, o aluno vê na Trilha "N cartas para revisar hoje", entra no Praticar (agora um hub), escolhe "Revisar com cartas" ou "Revisar com exercícios", abre um baralho (unidade, mapa, coleção, Meus erros, Minhas cartas, hoje), estuda em um dos 4 modos (Virar, Inverter, Digitar, Ouvir e reconhecer) com botões, teclado ou gesto de arrastar, e o fim da sessão grava pelo caminho único (`commitSession`, `kind: 'cards'`), com XP, ofensiva, meta e SRS. Ele também cria, edita, apaga e exporta as próprias cartas (até 500). As telas de mapa e de coleção ganham os atalhos deixados pela Fase 3.

Referências: `docs/MAPAS-E-CARTAS.md` (§2.6, §3, §4.4, §4.5, §5.1, §5.2, §5.3, §5.4, §10, §11), `docs/ARQUITETURA.md` §7, §8, §11 e §13, ADR-013, ADR-015, ADR-018, ADR-019, ADR-021 e ADR-022 (aprovado em 2026-11-07). Comportamento de referência da sessão: `prototipo/mapas-e-cartas/` (congelado), "na frente só há Virar carta; as notas só aparecem depois de virar".

**Decisões já tomadas (não reabrir):** cartas ficam dentro de Praticar, sem aba própria; carta = item = um `SrsCard` (cartas do aluno com `uc-`); notas Errei · Difícil · Bom · Fácil = `q` 1 · 3 · 4 · 5 no mesmo SM-2; Digitar usa as notas da lição (5 · 4 · 2 · 1) e Ouvir usa 4 · 1; "Meus erros" = `lapses ≥ 1 && reps < 2`, derivado; sessão de cartas vale 8 XP + 5 se perfeita + combo (máx. +5), sem corações (ADR-018 a); seleção: vencidas primeiro, depois até 10 novas, no máximo 20; gestos com o `drag` do Motion, sem dependência nova; itens de banco sem `acceptedEn`/`acceptedPt` ficam fora do Digitar até a auditoria do Lote A (Fase 5).

**Não muda o modelo persistido:** nenhuma tabela Dexie, nenhum campo novo, `schemaVersion` do backup continua 2. Tudo que a fase grava já existe desde a Fase 2: `LessonResult` `kind: 'cards'` com `context.deckKey`, `DailyStats.cards` (somado pelo repositório), `userCards` com `saveUserCard`/`deleteUserCard`/`countUserCards` e `UserCardLimitError`, `itemOutcomes.q` aceitando 0–5. A única coisa nova guardada é o estado da sessão de cartas em andamento no `sessionStorage` (por aba, versionado e descartável, como a lição). **Nenhuma dependência nova.**

**Bloqueios:** nenhum. Respostas do usuário em 2026-11-07, todas pela recomendação: Q4 ADR-022 aprovado; Q3 A (só unidades desbloqueadas); Q2 A (CSV só exportar); Q1 A ("Revisar com cartas" começando pela carta). Detalhes no fim do arquivo.

## Etapas (um commit por etapa)

### 1. `docs: plan cards phase 4` (arquiteto)

Este plano e a ADR-022 (proposta, em `DECISOES.md`). No fim da fase, o arquiteto atualiza `ARQUITETURA.md` §3, §7, §11 e §13 e o `MAPAS-E-CARTAS.md` §3, §5.1–§5.4 e §6.1 com o que mudou na implementação (etapa 13).

### 2. `fix: pay phase 3 debts`

Executor: `desenvolvedor`. Quatro das cinco pendências do fim de `FASE-3.md`. A quinta (atalho "Praticar este mapa" na barra do mapa) vai para a etapa 11, que mexe na mesma barra.

Arquivos: `src/app/router.tsx`, `src/app/RouteError.tsx` (novo), `src/features/mindmap/QuickTestItem.tsx`, `src/features/mindmap/MapLine.tsx` (ou o CSS do caderno), `src/features/path/StatsBar.tsx`, `src/features/path/GoalRing.tsx`, `src/i18n/pt-BR.ts`, `e2e/qa-mapas-etapa10.spec.ts`, testes.

- **URL com escape malformado** (`/mapas/colecoes/%E0%A4%A`): o `react-router` lança `URIError` ao decodificar e a tela fica em branco. Correção: `errorElement` na raiz (`RouteError`) com Tuca, texto e "Voltar para a Trilha", que cobre também as rotas novas desta fase (`/baralho/:deckKey`, `/cartas/:id`). Erro de rota nunca mostra pilha de erro. O `test.fail` do `qa-mapas-etapa10.spec.ts` vira `test`.
  - **Desvio na implementação (2026-11-07):** o diagnóstico acima estava errado. O `react-router` não lança `URIError`: o `decodePath` captura o erro e devolve o caminho cru, e o `CollectionScreen` mostra "Coleção não encontrada". A tela branca vinha do servidor (preview do Vite) respondendo 404 vazio antes de o app carregar; o e2e serve o shell com `page.route`. O `RouteError` ficou como proteção para erros de render e de `import()` lazy (com "Recarregar"). No GitHub Pages, quem já tem o service worker abre o app; na primeira visita depende do servidor do GitHub (conferir à mão depois do deploy).
- **Lacuna do Teste rápido corta palavras longas**: largura do campo pela maior resposta aceita (em `ch`, com mínimo e máximo), quebra de linha permitida no enunciado; nada de rolagem horizontal em 390 px.
- **Espaçamento das linhas da regra no `mm-to-be` no celular**: ajuste de `gap`/`line-height` do cartão de regra; o `designer-de-mapas` confere por captura antes do commit.
- **Meta diária lida duas vezes**: o `GoalRing` vira `aria-hidden` quando o texto ao lado já diz a meta (ou o texto some e o anel leva o rótulo). Um único rótulo acessível por estatística.
- Testes: rota com `%E0%A4%A` não fica em branco (mostra a tela de não encontrada); erro de render ou de lazy mostra a tela de erro (unidade com `createMemoryRouter` + e2e); `StatsBar` tem exatamente um nome acessível com a meta; campo da lacuna com a maior resposta de `mm-to-be` não transborda (e2e 390×844).

### 3. `feat: add card decks, selection and quality 3`

Executor: `desenvolvedor`. Tudo puro em `src/domain/`, sem React, Dexie nem `content`; entradas estruturais e mínimas, como em `mindmap/`.

Arquivos: `src/domain/srs/sm2.ts`, `src/domain/cards/{decks,select,mistakes,flashcard,modes}.ts`, testes ao lado.

- **`Quality = 1 | 2 | 3 | 4 | 5`** em `sm2.ts`. `review()` não muda (já aceita qualquer `q`). Teste: `q` 3 reduz o `ease` em 0,14 e conta como acerto; os testes atuais do SM-2 continuam verdes sem edição.
- **`mistakes.ts`**: `isMistake(c) = c.lapses >= 1 && c.reps < 2` (§3).
- **`decks.ts`** (§5.3): gramática das chaves e resolução.
  ```ts
  type DeckKey =
    | { kind: 'unit'; unitId: string }
    | { kind: 'skill'; skillId: string }
    | { kind: 'map'; mapId: string }
    | { kind: 'theme'; deckId: string }
    | { kind: 'col'; collectionId: string; topic?: string }
    | { kind: 'erros' }
    | { kind: 'minhas' }
    | { kind: 'hoje' };
  export function parseDeckKey(raw: string): DeckKey | null; // só [a-z0-9-] por segmento; senão null
  export function formatDeckKey(k: DeckKey): string; // parse(format(k)) == k
  /** Catálogo estrutural montado pela store a partir do manifesto, das coleções e das cartas do aluno. */
  type DeckCatalog = {
    units: {
      id: string;
      itemIds: readonly string[];
      skills: { id: string; itemIds: readonly string[] }[];
    }[];
    maps: { id: string; itemIds: readonly string[] }[];
    themes: { id: string; itemIds: readonly string[] }[];
    collections?: { id: string; entries: { itemId: string; topic?: string }[] }[]; // lazy
    userCardIds: readonly string[];
  };
  export function deckItemIds(
    k: DeckKey,
    catalog: DeckCatalog,
    cards: readonly Card[],
    today: DayKey,
  ): string[] | null;
  ```
  `erros` = cartas com `isMistake` cujo item ainda existe; `minhas` = `userCardIds`; `hoje` = cartas vencidas de qualquer item existente (conteúdo ou aluno). Chave desconhecida, ou id fora do catálogo → `null` (a tela mostra "baralho não encontrado"). Ordem: a do conteúdo (para `minhas`, a da lista: mais recente primeiro).
- **`select.ts`** (§3, ADR-018 a, ADR-022):
  ```ts
  export const CARD_SESSION_MAX = 20;
  export const CARD_SESSION_NEW_MAX = 10;
  export const CARD_SESSION_MIN = 5;
  export function selectCards(input: {
    deckItemIds: readonly string[];
    cards: readonly Card[];
    today: DayKey;
    allowNew: boolean; // false em `hoje` e `erros`
  }): string[];
  ```
  Vencidas do baralho na ordem do Praticar (mais atrasadas, mais lapsos, menor `ease`, id) → até 10 novas (itens sem `SrsCard`) na ordem do baralho → se ainda houver menos de 5, completa com as não vencidas de menor `ease` (revisão extra, como o Praticar) → corta em 20. Um baralho com menos de 5 itens entra inteiro. Determinística: mesma entrada, mesma saída (a aleatoriedade fica no motor da sessão, por `seed`).
- **`flashcard.ts`** (estende o da Fase 3, sem quebrar o painel do mapa): `back.notes?` para carta do aluno; `userCardToFlashcard(card)` com `source: 'user'` (o `en` é literal, sem padrões).
- **`modes.ts`**: `type CardMode = 'virar' | 'inverter' | 'digitar' | 'ouvir'` e as regras de quem entra em cada modo.
  ```ts
  export function typingTarget(
    item: TypingShape,
  ): { prompt: string; promptLang: Lang; patterns: string[]; answerLang: Lang } | null;
  ```
  Vocab: PT → EN com `[en, ...acceptedEn]`. Frase: EN → PT com `[pt, ...acceptedPt]`. Item de banco sem `acceptedEn` (vocab) ou sem `acceptedPt` (frase) → `null` (fora do Digitar até o Lote A). Carta do aluno: PT → EN com `[en]` literal (o schema já proíbe `( ) [ ] |`). `listenOptions(target, pool, rng)`: 4 traduções PT distintas (normalizadas), a certa + 3 do próprio baralho e, se faltar, do resto do pool; menos de 4 distintas → `null` (modo indisponível para o baralho).
- Testes: `parseDeckKey` com todas as formas, chave com `..`, maiúsculas, `%`, segmento vazio; ida e volta; `deckItemIds` de cada tipo sobre um catálogo de fixture; `erros` ignora item que sumiu do conteúdo; `selectCards`: só novas, só vencidas, mistura, teto de 10 novas e de 20, completar até 5, baralho de 3 itens, `allowNew: false`; `typingTarget` para vocab de unidade, frase de unidade, item de banco sem `accepted*` e carta do aluno; `listenOptions` sem repetir tradução e com pool pequeno.

### 4. `feat: add card session engine`

Executor: `desenvolvedor` com **`model: opus`** (máquina de estados com fila, reinserção, 4 modos e retomada). Puro em `src/domain/cards/session.ts`, teste ao lado.

```ts
type CardSessionState = {
  deckKey: string;
  mode: CardMode;
  queue: string[]; // itemIds; "Errei" reinsere uma vez no fim
  index: number;
  phase: 'presenting' | 'flipped' | 'answered' | 'finished';
  retried: string[]; // itens já reinseridos (só uma vez)
  outcomes: Record<string, number>; // menor q por item
  answer?:
    { value: string; grade: 'right' | 'almost' | 'wrong' } | { choice: number; right: boolean };
  combo: number;
  comboBonus: number;
  mistakes: number;
  startedAt: number;
  seed: number;
};
type CardAction =
  | { type: 'flip' } // virar / inverter
  | { type: 'rate'; rating: 'errei' | 'dificil' | 'bom' | 'facil' }
  | { type: 'type'; grade: GradeResult } // digitar: a tela chama gradeText
  | { type: 'choose'; index: number; right: boolean } // ouvir
  | { type: 'next' };
export function startCardSession(input: {
  deckKey: string;
  mode: CardMode;
  itemIds: string[];
  nowMs: number;
  seed: number;
}): CardSessionState;
export function cardReducer(s: CardSessionState, a: CardAction): CardSessionState;
export function cardSessionSummary(s: CardSessionState, nowMs: number): LessonSummary;
```

- **Virar / Inverter**: `presenting` só aceita `flip`; `flipped` só aceita `rate`. As notas viram `q` 1 · 3 · 4 · 5. "Errei" reinsere o item uma vez no fim da fila; ao vê-lo de novo, o aluno avalia outra vez, e vale o menor `q` (§3).
- **Digitar**: `type` com o `GradeResult` do corretor. Certo de primeira 5, "quase" 4; errado reinsere uma vez: acertou na repetição 2, errou de novo 1 (igual à lição). `next` avança.
- **Ouvir**: `choose`; certo 4, errado 1, errado reinsere uma vez.
- Ações fora da fase certa são ignoradas (estado igual), nunca lançam: o teclado e o gesto podem disparar em qualquer momento.
- **Resumo** (`LessonSummary`, o mesmo da lição): `xp = sessionXp('cards', perfect, comboBonus)`; `perfect` = nenhum "Errei" e nenhuma resposta errada ("Difícil" e "quase" não quebram); combo +1 a cada 5 respostas seguidas sem falha, máx. +5; `mistakes` = falhas; `accuracy` = itens sem falha na 1ª vez ÷ itens distintos; `itemOutcomes` = `outcomes`. O XP final continua decidido no commit.
- **`cardSessionStateSchema`** (Zod, em `src/features/cards/cardSessionStore.ts`, etapa 6) espelha este tipo; a etapa 4 só garante que o estado é serializável (sem funções, sem `Map`).
- Testes: fila com "Errei" que volta uma vez e não duas; menor `q` com Errei → Bom; ações fora de fase ignoradas; Digitar 5/4/2/1; Ouvir 4/1; combo em 5 e 10 e teto +5; perfeita com "Difícil"; resumo de sessão de 1 carta; `startedAt`/`seed` preservados; estado sobrevive a `JSON.parse(JSON.stringify(s))`.

### 5. `refactor: split due count store and add path counter`

Executor: `desenvolvedor`. Etapa sensível ao **orçamento** (ADR-021): a faixa da Trilha entra no JS inicial e não pode puxar `generatePractice`, o motor da lição nem o das cartas.

Arquivos: `src/stores/useSrsCards.ts` (novo), `src/stores/usePractice.ts`, `src/features/path/{PathScreen,DueCardsStrip}.tsx`, `src/i18n/pt-BR.ts`, `scripts/check-prod-bundle.ts`, testes.

- **`useSrsCards`** (Zustand, leve): `repository.getSrsCards()` + ids de `repository.listUserCards()`; recarrega com `onLessonCommitted` e `onDataReplaced`. Exporta `dueTodayCount(cards, existingIds, today)` (do domínio) e `existingItemIds()` = `manifestItemIds()` ∪ ids das cartas do aluno. Só importa `data`, `content/loader` (já no inicial) e `domain/srs`.
- **`usePractice`** passa a ler as cartas de `useSrsCards` (sem segunda leitura) e mantém só os montadores de sessão; `practiceDueCount` vira fachada do novo cálculo e **passa a contar as cartas do aluno** (§3). O Praticar por exercícios continua só com itens do conteúdo (ADR-022).
- **`DueCardsStrip`** na Trilha, acima da primeira unidade: "N cartas para revisar hoje" → link para `/praticar`. Some com N = 0, com erro de leitura ou enquanto carrega (sem salto de layout: reserva altura só quando já há número). Ícone desenhado + texto, `aria-live` não (não é feedback).
- **`check-prod-bundle`**: o grafo do chunk de entrada (manifesto do Vite) não pode incluir os módulos `domain/cards/session`, `domain/cards/select`, `domain/practice/generate`, `features/cards/*` nem `stores/useDecks`/`useUserCards`. Conferir por caminho de módulo, não por texto (nomes somem na minificação, e os textos do `pt-BR.ts` estão no inicial de propósito). O PR informa o tamanho antes e depois.
- Testes: contador com cartas de conteúdo, de banco e do aluno; carta órfã (item removido) não conta; faixa some com 0; `usePractice.test.ts` e `usePractice.map.test.ts` verdes sem edição de expectativa; teste do bundle.

### 6. `feat: add card session screen`

Executor: `desenvolvedor`. Revisão do commit em **`opus`** (escreve `results`, `srs`, `daily`).

Arquivos: `src/app/{routes,router}.tsx`, `src/features/cards/{CardSessionScreen,FlashcardView,CardFace,RatingBar,CardSessionDone,CardDeckNotFound}.tsx`, `src/features/cards/{useCardSession,cardSessionStore,buildCardSession}.ts`, `src/i18n/pt-BR.ts`, testes.

- Rota **`/cartas/sessao?baralho=&modo=`** em tela cheia, **fora** do `AppLayout` (como a lição), `lazy`. `paths.cardSession(deckKey, mode)`. Modo ausente ou inválido → `virar`. Chave inválida ou baralho vazio → `CardDeckNotFound` (texto + voltar para `/praticar`). `?de=` opcional com o caminho de volta (mapa, coleção, baralho), validado contra uma lista de prefixos internos; sem ele, volta para `/praticar`.
- **`buildCardSession(deckKey, mode, caps)`**: lê `useSrsCards`, monta o `DeckCatalog` (coleções por `loadCollections()` só quando a chave é `col.*`), `deckItemIds` → `selectCards` → `loadItems` + cartas do aluno → `toFlashcard`/`userCardToFlashcard` → filtra pelo modo (`typingTarget`, `listenOptions`) → `startCardSession` com `seed = clock.now()`. Nesta etapa só **Virar** e **Inverter**; Digitar e Ouvir chegam na etapa 8.
- **Retomada**: `cardSessionStore` salva o estado no `sessionStorage` a cada ação (`falae.cardSession`, `version: 1`, Zod). Ao abrir, retoma só se `deckKey` e `mode` forem os mesmos e todos os itens ainda existirem; senão gera nova. Estado inválido é descartado em silêncio. Concluída ou abandonada → apaga.
- **Tela**: barra com progresso ("3 de 12", `progressbar` com rótulo), botão sair. Carta com a frente (EN com `lang="en"` e emoji `aria-hidden`; no Inverter, PT na frente e EN no verso), botão "Virar carta". Virada: verso com `toFlashcard` (PT, exemplo, pronúncia, "cuidado", situação, formalidade com texto) e a `RatingBar` com Errei · Difícil · Bom · Fácil (ícone + texto, alvo ≥ 48 px, a cor nunca sozinha). Áudio do EN quando há TTS (`SpeakText` do mapa, movido para `src/ui/` se preciso).
- **Teclado** (§5.4): Espaço/Enter vira; `1`–`4` = Errei/Difícil/Bom/Fácil (as teclas não são o `q`); `←`/`→` = Errei/Bom; `Esc` abre a confirmação de saída (`ExitDialog` atual). Atalhos no contêiner da sessão, ignorados quando o foco está em campo de texto ou num diálogo. Ao virar, o foco vai para o título do verso; ao avaliar, para a frente da próxima carta. Anúncio em `aria-live="polite"` ("Bom. Carta 4 de 12").
- **Fim**: `commitSession({ lessonId: 'deck:<deckKey>', kind: 'cards', context: { deckKey }, startedAt, summary })`, id determinístico `deck:<deckKey>-<startedAt>`. `CardSessionDone` (`role="status"`, Tuca `comemorando`; `incentivando` em `erros`): XP lido do `CommitSummary` (nunca recalculado), ofensiva e meta quando mudarem, contagem por nota, "Revisar de novo" e "Voltar". Falha ao salvar → "Tentar de novo" com o mesmo resumo e o mesmo id. Sair antes do fim não grava nada (como a lição).
- Testes: sessão de `unit.u1-unit` real (loader com glob real) do início ao fim pelo teclado; commit `cards` grava `itemOutcomes` com `q` 1/3/4/5, `daily.cards` = cartas distintas, `context.deckKey`, XP 8 (+5 perfeita), corações intactos; mesmo id não soma duas vezes; reload no meio retoma a mesma carta; outro baralho na URL não retoma; chave inválida → não encontrado; sem TTS → nenhum botão de áudio; Inverter mostra PT na frente e `lang="en"` só no EN; `useProfile.test.ts` verde sem edição.

### 7. `feat: add card flip animation and swipe gestures`

Executor: `desenvolvedor` com **`model: opus`** (gesto + animação + acessibilidade, difícil de testar). Visual: `designer-de-mapas`.

Arquivos: `src/features/cards/{FlashcardView,SwipeHint}.tsx`, `src/features/cards/swipe.ts` (função pura de decisão, teste ao lado), `src/styles` (tokens da carta, se faltarem), `src/features/showcase/Showcase.tsx`, testes.

- **Virar**: `rotateY` 3D com Framer Motion (frente e verso com `backface-visibility: hidden`). Com `useReducedMotion()`, troca por fade curto. A face escondida fica `inert` + `aria-hidden` (o leitor de tela nunca lê as duas).
- **Gesto** (§5.4), só depois de virar: `drag="x"` do Motion com `dragSnapToOrigin`; direita = Bom, esquerda = Errei. `swipeDecision(offsetX, velocityX, width)` → `'bom' | 'errei' | null` (limiar: 35% da largura ou 500 px/s; abaixo disso a carta volta). Durante o arraste, a etiqueta "Bom ✓" / "Errei ✗" aparece com ícone e texto. `touch-action: pan-y` (rolagem vertical continua). Com reduced motion, o gesto continua valendo, mas sem a carta "voar": a próxima aparece direto. Antes de virar, arrastar não faz nada. Os botões existem sempre; o gesto nunca é o único caminho.
- **Proporção**: no desktop a carta fica deitada, na proporção da carta impressa (95 × 67 mm); no celular, em pé, ocupando a largura útil sem rolagem em 390×844 com a barra de notas visível.
- **Visual da carta**: papel do caderno (`--paper-card`), borda e sombra dos tokens, selo de nível, emoji grande na frente; nada de hex solto. Showcase: frente, verso, arrastando para cada lado, claro e escuro.
- Testes: `swipeDecision` (limiar, velocidade, sinal, largura 0); arrastar antes de virar não avalia; com reduced motion não há `rotateY` (componente com `useReducedMotion` mockado); a face oculta é `inert`.
- **Portão visual:** `designer-de-mapas` aprova a carta no showcase (390×844 e desktop, claro, escuro e escala de cinza) antes do commit.

### 8. `feat: add typing and listening card modes`

Executor: `desenvolvedor`.

Arquivos: `src/features/cards/{TypingCard,ListenCard}.tsx`, `src/features/cards/buildCardSession.ts`, `src/i18n/pt-BR.ts`, testes.

- **Digitar**: enunciado de `typingTarget` (`lang` do enunciado e do campo corretos), `<input>` rotulado, "Conferir" e Enter. Corrige com `gradeText` + `loadKnownWords()` (lazy), mostra certo/quase/errado com ícone, texto e a forma correta (como o `FeedbackPanel` da lição, reutilizado se couber), em `aria-live`. "Continuar"/Enter avança. Atalhos `1`–`4` e setas desligados neste modo.
- **Ouvir e reconhecer**: toca o EN ao mostrar a carta (e no botão "Ouvir de novo", com velocidade lenta como na lição); 4 opções PT em lista (`1`–`4` escolhem). Sem `ttsSupported()` ou com `hasNoVoice()`, o modo **não aparece** na escolha e uma URL com `modo=ouvir` cai em `virar` com aviso.
- **Itens fora do modo**: o montador tira os itens sem `typingTarget` (Digitar) ou sem `listenOptions` (Ouvir). Se sobrar zero, a tela mostra "Este baralho ainda não tem cartas para este modo" com os modos que funcionam. Se sobrar parte, o resumo diz quantas ficaram de fora.
- Testes: vocab PT → EN certo, quase (erro de digitação) e errado com repetição (`q` 5/4/2/1 no commit); frase EN → PT com `acceptedPt`; item de banco sem `acceptedPt` fora do Digitar; carta do aluno comparada como texto literal; Ouvir com TTS simulado (4 opções distintas, `q` 4/1); sem TTS o modo some.

### 9. `feat: turn practice into a hub with decks`

Executor: `desenvolvedor`. Depende de **Q3**.

Arquivos: `src/features/practice/{PracticeScreen,PracticeHub,DeckList,DeckListItem}.tsx`, `src/features/cards/{DeckScreen,ModePicker}.tsx`, `src/stores/useDecks.ts` (novo, lazy), `src/app/{routes,router}.tsx`, `src/i18n/pt-BR.ts`, testes.

- **Hub `/praticar`** (§5.1), Tuca `incentivando` como hoje, em três partes:
  1. **"N para revisar hoje"** com _Revisar com cartas_ (→ `/cartas/sessao?baralho=hoje&modo=virar`) e _Revisar com exercícios_ (→ `/praticar/sessao`, o fluxo atual). Texto curto dizendo que são duas formas de revisar a mesma fila. Com cartas do aluno vencidas: "M delas são suas cartas e só aparecem no modo cartas" (ADR-022). Com 0 vencidas: "Nada vencido hoje" e os dois botões continuam como revisão extra (completam até 5 / até 4 como hoje).
  2. **Baralhos**: Meus erros (some sem erros), Minhas cartas, por unidade (Q3), por mapa (os 6), coleções de cartas (`col.*`, sem a `study-plan`) e temáticos (`theme.*`, hoje nenhum: a seção some). Cada um com ícone, título, "N para hoje · M novas" (sem carregar JSON; coleções mostram o total do manifesto até `loadCollections()` responder).
  3. **Minhas cartas**: contagem "N de 500" e "Nova carta" (etapa 10).
- O fluxo `?from=outOfHearts` continua levando a `/praticar/sessao` (exercícios dão coração; cartas não). O `OutOfHearts` não muda.
- **`/baralho/:deckKey`** (dentro do `AppLayout`, `handle: { hideBottomNav: true }`): título, contagem, lista das cartas (EN `lang="en"`, PT, selo "vence hoje" / "nova" / "aprendida" com texto), `ModePicker` (os modos disponíveis para o baralho, com o motivo dos indisponíveis) e "Começar". No baralho de unidade, as habilidades como sub-baralhos (`skill.*`). No `minhas`, "Editar" por carta. Chave inválida → não encontrado. "Imprimir" fica para a Fase 7.
- **`useDecks`** (lazy, importado só pelo hub e pelo baralho): monta o `DeckCatalog` e as contagens a partir de `useSrsCards` e do manifesto.
- Estados: carregando (esqueleto), erro ao ler cartas (hub sem contagens, botões ainda funcionam), sem nada estudado (só cartas novas).
- Testes: hub com 0 e com N vencidas; botão de exercícios leva à sessão atual; Meus erros aparece com uma carta `lapses 1, reps 0` e some com `reps 2`; contagens por baralho; teclado chega a todos os baralhos; baralho inválido; modos indisponíveis explicados; `PracticeScreen` antiga não tem mais teste quebrado (testes atualizados para o hub, com o mesmo comportamento de exercícios).

### 10. `feat: add my cards editor and export`

Executor: `desenvolvedor`. Depende de **Q2** (formato do export).

Arquivos: `src/features/cards/{UserCardEditor,UserCardForm,DeleteCardDialog}.tsx`, `src/stores/useUserCards.ts` (lazy), `src/domain/cards/userCardDraft.ts` (puro, teste ao lado), `src/domain/cards/exportCards.ts` (puro, teste ao lado), `src/services/ids.ts` (novo), `src/app/{routes,router}.tsx`, `src/i18n/pt-BR.ts`, testes.

- Rotas **`/cartas/nova`** e **`/cartas/:id`** (dentro do `AppLayout`, `hideBottomNav`), `lazy`. Segmento fixo `sessao` e `nova` antes de `:id`; ids do aluno começam com `uc-`, então não há colisão. Id desconhecido → não encontrado.
- **Formulário** (Tuca `pensando`): EN e PT obrigatórios, exemplo (EN + PT, os dois ou nenhum), anotação (até 280), emoji opcional. `userCardDraft.ts`: `validateDraft(draft)` devolve erros por campo (chaves de i18n), com as **mesmas** regras do `userCardSchema` (1–120, sem `( ) [ ] |`, trim). Teste garante que rascunho válido ⇔ schema aceita. Erros ligados ao campo (`aria-describedby`, `aria-invalid`), foco no primeiro erro ao salvar. EN com `lang="en"`.
- **Ids**: `services/ids.ts` gera `uc-` + 10 caracteres `[a-z0-9]` com `crypto.getRandomValues`; `createdAt`/`updatedAt` por `clock.iso()`. Domínio não gera ids nem lê o relógio.
- **Limite 500**: "N de 500" no hub e no editor; na 500ª, "Nova carta" fica desabilitado com o motivo. `UserCardLimitError` (outra aba encheu) → mensagem, sem perder o texto digitado.
- **Editar** mantém o histórico do SRS (mesmo id). **Apagar** pede confirmação ("A carta e o progresso dela serão apagados") e usa `deleteUserCard` (carta + `SrsCard` na mesma transação). Depois de salvar ou apagar, `useSrsCards` recarrega (a faixa da Trilha e o hub se atualizam).
- **Export** (Q2, recomendação A): "Exportar minhas cartas" gera `falae-cartas-AAAA-MM-DD.csv` por `exportCardsCsv(cards)` (puro): UTF-8 com BOM, separador `;`, cabeçalho `en;pt;exemplo_en;exemplo_pt;anotacao`, aspas e quebras de linha escapadas. Só exportar: restaurar continua sendo pelo backup completo de Ajustes, que já inclui as cartas. Sem cartas, o botão fica desabilitado.
- Testes: criar, editar e apagar pelo teclado; validação de cada campo (incluindo `(`, `|`, 121 caracteres, exemplo pela metade); limite com 500 cartas semeadas; `UserCardLimitError` simulado; apagar remove o `SrsCard`; CSV com `;`, aspas, quebra de linha e acento, abrindo igual no parser de teste; carta nova aparece em `minhas` e entra em sessão nova.

### 11. `feat: link maps and collections to cards`

Executor: `desenvolvedor`. Os ganchos deixados pela Fase 3 e a pendência do atalho na barra do mapa. Depende de **Q1**.

Arquivos: `src/features/mindmap/{MapHeader,LineDetailSheet,MapStudyComplete}.tsx`, `src/features/maps/{CollectionScreen,CollectionEntry}.tsx`, `src/i18n/pt-BR.ts`, testes.

- **Barra do mapa**: "Praticar este mapa" (pendência da Fase 3) e "Revisar com cartas" (→ sessão `map.<mapId>`, `de=` o mapa). Os dois somem enquanto "Esconder o inglês" está ligado (não competem com o estudo).
- **Painel da linha** (Q1, recomendação A): o botão do §6.1 vira **"Revisar com cartas"** e abre a sessão `map.<mapId>` **começando por esta carta** (`&primeira=<itemId>`: o montador põe o item na frente da fila do `selectCards`, entrando mesmo que não tivesse sido selecionado e respeitando o teto de 20; não grava nada antes do fim). Escondido enquanto o trecho está coberto, como o "Ver detalhes".
- **Coleção**: "Revisar com cartas" no topo (→ `col.<id>`) e, nas coleções com tópicos, um por tópico (→ `col.<id>.<topic>`). Não aparece na `study-plan`.
- **`MapStudyComplete`**: atalho "Revisar com cartas" junto dos atuais.
- Testes: cada atalho leva à URL certa com `de=`; `primeira` coloca o item na frente e é ignorado se não pertence ao baralho; atalhos escondidos com o modo ligado; coleção sem tópicos tem só um botão.

### 12. `test: add cards e2e and screenshots`

Executor: `qa-tester` (escreve), `desenvolvedor` corrige o que falhar. Antes de rodar, matar o servidor na porta 4173 (pré-visualização antiga).

Arquivos: `e2e/cards.spec.ts` (novo), `e2e/screenshots.spec.ts` (ou o script de `npm run screenshots`), `e2e/offline.spec.ts` (ou um spec próprio, como na Fase 3).

- Jornada (mobile 390×844 e desktop): usuário com progresso semeado → Trilha mostra "N cartas para revisar hoje" → Praticar → "Revisar com cartas" → vira e avalia pelo teclado → arrasta para a direita e para a esquerda (mouse no desktop, toque no mobile) → "Errei" volta no fim → fim com "+8 XP" e a meta → `advanceDays(1)` → as cartas avaliadas aparecem como vencidas no contador e na sessão → Meus erros → Digitar com um erro de digitação ("quase") → Ouvir (TTS simulado) → cria uma carta própria → ela aparece em Minhas cartas e numa sessão → edita → exporta o CSV (download conferido) → apaga → mapa `mm-to-be` → "Revisar com cartas" pelo painel → coleção "Frases" → revisar por tópico.
- Reload no meio da sessão retoma a mesma carta.
- Offline: depois da 1ª visita, hub, baralho e sessão de um baralho de banco abrem sem rede.
- Reduced motion: virar sem `rotateY`, arrastar sem a carta voar.
- Capturas para o `revisor-ux` e o `designer-de-mapas`: Trilha com a faixa, hub (com e sem vencidas), baralho de unidade, sessão (frente, verso, arrastando para cada lado, Digitar com "quase", Ouvir), fim de sessão, Meus erros vazio, editor (vazio, com erro, no limite), painel do mapa com o botão novo, coleção com os botões. Em 390×844 e 1280×800, claro e escuro; escala de cinza para o designer.

### 13. `docs: update architecture for cards` (arquiteto)

`ARQUITETURA.md` §3 (`domain/cards`, `features/cards`, `stores/useSrsCards`, `useDecks`, `useUserCards`, `services/ids`), §7 (`Quality` 1–5, `selectCards`, `isMistake`), §11 (`cards` no commit, `daily.cards`, export de cartas), §13 (rotas novas e hub); `MAPAS-E-CARTAS.md` §3, §5.1–§5.4 e §6.1 com os ajustes da implementação; ADR-022 com o status final.

## Agentes de apoio (agente principal)

Antes da etapa 6, o agente principal ajusta em `.claude/` (fora do alcance do arquiteto; aqui só a especificação):

- `revisor-ux`: checklist da carta (frente só com "Virar carta"; notas só depois de virar; nota com ícone + texto; gesto nunca é o único caminho; uma face lida por vez; atalhos não disparam em campo de texto).
- `qa-tester`: `sessionStorage` da sessão de cartas, gesto com mouse e toque no Playwright, `advanceDays`, TTS simulado, download do CSV, porta 4173 livre antes do e2e.
- `desenvolvedor`: `features/cards` vs `features/practice`; `useSrsCards` é a única store de cartas no inicial; `useDecks`/`useUserCards` só em rotas lazy.

## Agentes e modelos por etapa

| Etapa    | Executor                   | Revisão (paralelo)                                                                                        |
| -------- | -------------------------- | --------------------------------------------------------------------------------------------------------- |
| 1, 13    | `arquiteto` (opus)         | usuário (diff dos docs)                                                                                   |
| 2        | `desenvolvedor` (sonnet)   | `revisor-de-codigo` (opus) + `qa-tester` (sonnet); `designer-de-mapas` (sonnet) no `mm-to-be` e na lacuna |
| 3        | `desenvolvedor` (sonnet)   | `revisor-de-codigo` (opus) + `qa-tester` (sonnet)                                                         |
| **4**    | `desenvolvedor` (**opus**) | `revisor-de-codigo` (opus) + `qa-tester` (sonnet)                                                         |
| 5        | `desenvolvedor` (sonnet)   | `revisor-de-codigo` (opus) + `qa-tester` (sonnet); número do bundle no PR                                 |
| **6**    | `desenvolvedor` (sonnet)   | `revisor-de-codigo` (**opus**, escreve `results`/`srs`/`daily`) + `qa-tester` (sonnet)                    |
| **7**    | `desenvolvedor` (**opus**) | `revisor-de-codigo` (opus) + `qa-tester` (sonnet); `designer-de-mapas` (sonnet) no showcase               |
| 8, 9, 11 | `desenvolvedor` (sonnet)   | `revisor-de-codigo` (opus) + `qa-tester` (sonnet)                                                         |
| 10       | `desenvolvedor` (sonnet)   | `revisor-de-codigo` (**opus**, escreve e apaga `userCards`/`srs`) + `qa-tester` (sonnet)                  |
| 12       | `qa-tester` (sonnet)       | `revisor-de-codigo` (opus) nos testes                                                                     |
| Fim      | —                          | `revisor-ux` (sonnet) + `designer-de-mapas` (sonnet), em paralelo, com as capturas da etapa 12            |

Comandos mecânicos (rodar lint/test/build e resumir saída, conferir checklist) podem ir para `haiku`; portões de revisão nunca. O agente principal passa `model` explicitamente em toda delegação.

## Testes exigidos (resumo)

| Área               | Teste                                                                                                                       |
| ------------------ | --------------------------------------------------------------------------------------------------------------------------- |
| Dívidas da Fase 3  | URL malformada mostra erro de rota; meta com um só nome acessível; lacuna sem transbordo                                    |
| Domínio das cartas | `Quality` 3, `isMistake`, `parseDeckKey`/`formatDeckKey`, `deckItemIds`, `selectCards`, `typingTarget`, `listenOptions`     |
| Motor da sessão    | fila com uma reinserção, menor `q`, 4 modos, combo, perfeita, ações fora de fase, serialização                              |
| Commit de cartas   | `kind: 'cards'`, `context.deckKey`, `q` 1/3/4/5 e 5/4/2/1, `daily.cards`, 8 (+5) XP, corações intactos, id determinístico   |
| Telas              | sessão, hub, baralho, editor, não encontrado, modo indisponível, sem TTS, limite de 500, falha ao salvar com tentar de novo |
| Acessibilidade     | teclado em tudo, atalhos fora de campos, foco ao virar/avaliar, `aria-live`, uma face lida, `lang="en"`, reduced motion     |
| Bundle             | sessão, seletor, editor e `generatePractice` fora do inicial; JS inicial ≤ 250 kB gzip                                      |
| E2E                | `cards.spec.ts` mobile + desktop com gesto, `advanceDays`, reload, offline; suíte atual verde                               |

## Critérios de aceite

- `npm run lint`, `typecheck`, `test`, `e2e`, `validate:content` e `build` verdes; `check-prod-bundle` verde com os marcadores novos.
- JS inicial **≤ 250 kB gzip** (ADR-021; hoje 239,6 kB) e teto de 260 kB (ADR-013). Só a faixa da Trilha, `useSrsCards`, rotas e textos de `pt-BR.ts` entram no inicial. O PR informa o número. Se passar de 250 kB, rever o que está no inicial antes de qualquer outra coisa (ADR-021).
- A Trilha mostra "N cartas para revisar hoje" quando N > 0, contando conteúdo e cartas do aluno, e leva ao Praticar.
- O Praticar é um hub: as duas formas de revisar a mesma fila, os baralhos e Minhas cartas; o fluxo de exercícios e o `?from=outOfHearts` continuam iguais.
- Os 4 modos funcionam sobre as 60 cartas portadas e os itens das unidades, respeitando quem entra em cada modo; sem TTS, Ouvir não aparece.
- A carta só mostra as notas depois de virar; botões, teclado e gesto dão o mesmo resultado; "Errei" volta uma vez no fim.
- O fim da sessão grava um `LessonResult` `kind: 'cards'` pelo `commitSession`, com `context.deckKey`, XP de 8 (+5 perfeita, combo ≤ +5), ofensiva, meta, `daily.cards` e SRS; corações não mudam; repetir o commit não duplica.
- Reload no meio da sessão retoma a mesma carta.
- Minhas cartas: criar, editar, apagar (com o `SrsCard`), limite de 500 com mensagem, export (Q2).
- Mapa, painel da linha e coleção levam às sessões certas.
- Navegável só pelo teclado, foco visível, `lang="en"` em todo trecho em inglês, feedback em `aria-live`, sem animação com reduced motion.
- Offline: hub, baralho e sessão de um baralho já visitado abrem sem rede.
- Nenhuma mudança em tabela Dexie nem no formato do backup; `domain` sem React, Dexie ou `content`.
- `revisor-ux` e `designer-de-mapas` sem bloqueantes; revisores de código sem bloqueantes.

## Portões

| Etapas               | Revisão                                                                                                                                |
| -------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| 2, 3, 4, 5, 8, 9, 11 | `revisor-de-codigo` (opus) + `qa-tester` (paralelo) → correção → nova verificação                                                      |
| **6, 10**            | `revisor-de-codigo` em **opus** com atenção ao commit e às escritas em `userCards`/`srs` + `qa-tester`                                 |
| 7                    | `revisor-de-codigo` + `qa-tester`; **`designer-de-mapas`** aprova a carta no showcase                                                  |
| 2, 6, 7, 9, 10       | `designer-de-mapas` confere cada tela nova por capturas parciais antes do commit (claro, escuro, escala de cinza)                      |
| 12                   | `revisor-de-codigo` nos testes; capturas finais para o portão de fase                                                                  |
| **Fim da fase**      | `revisor-ux` com screenshots 390×844 e desktop (claro e escuro) + `designer-de-mapas` (mesmas capturas + escala de cinza), em paralelo |
| 1, 13                | o usuário vê o diff dos docs no commit                                                                                                 |

Nenhuma etapa avança com bloqueante. Commit ao fim de cada etapa aprovada.

## Riscos

1. **Orçamento**: o `pt-BR.ts` é um só módulo no inicial, então todos os textos desta fase entram nele (estimativa: 1,5–3 kB gzip). Somado à faixa e ao `useSrsCards`, a previsão é ~243–245 kB. Se passar de 250 kB, a saída é dividir os textos das telas lazy em módulos próprios, o que é mudança estrutural e vira ADR antes.
2. **Gesto e rolagem no celular**: `drag="x"` pode brigar com a rolagem vertical e com o gesto de voltar do iOS. Mitigação: `touch-action: pan-y`, limiar de 35%, e2e com toque; se o iOS brigar, o gesto fica só no meio da carta (margens livres).
3. **Autoavaliação inflada** ("Fácil" sempre): já mitigado no §3; "Meus erros" usa `lapses`.
4. **Sessões curtas pagando 8 XP** (baralho de 1–4 cartas, revisão extra): é a regra aprovada (ADR-018 a) e igual ao Praticar de hoje; o `pedagogo` pode reavaliar na Fase 6, junto com a gamificação.
5. **Digitar com poucos itens elegíveis** (bancos sem `accepted*`): o modo explica o motivo; resolve no Lote A (Fase 5).

## Fora desta fase

- Conquistas `cards-100`, `card-streak-7`, `mistakes-cleared`, "cartas revisadas" no perfil e os contadores novos do `CommitContext` (Fase 6).
- `context.planDay` e "30 dias com o Tuca" (Fases 5 e 6).
- Baralhos temáticos com conteúdo (`decks.json` continua vazio; Fase 5, lote F) e auditoria de `acceptedEn`/`acceptedPt` (Fase 5, lote A).
- Imprimir baralho (`/imprimir/baralho/:deckKey`, Fase 7).
- Ilustrações das cartas no lugar do emoji (trabalho futuro).
- Importar só as cartas do aluno (fora do escopo; o backup completo já restaura).

## Pendências encontradas durante a fase

- **Etapa 2 (2026-11-07):** com a fonte a 200% em 390 px, `/mapas/mm-to-be` rola 51 px na horizontal (cartão `li.relative.mt-4` e linhas do `MapLine`). Já existia antes da etapa 2 (medido pelo `designer-de-mapas`). Sugestão do designer, opcional: tirar o `py-1` das linhas de texto do `MapLine` (o `min-h-11` já dá a altura) se o mapa parecer arejado demais no desktop.
- **Teste intermitente:** o QA viu uma falha única numa contagem de `[data-tag]` no Vitest, que não se repetiu em 3 rodadas. Observar.

## Perguntas ao usuário (antes das etapas indicadas)

1. **Q1 — "Adicionar ao baralho de hoje" no painel da linha do mapa** (etapa 11). Sem mudar o modelo persistido, as opções são:
   - **A (recomendada)**: o botão vira "Revisar com cartas" e abre a sessão do mapa começando por essa carta. Nada é gravado antes do fim da sessão.
   - B: guardar a carta numa lista temporária da aba (`sessionStorage`) que entra no baralho "hoje". Some ao fechar a aba, o que confunde.
   - C: criar o `SrsCard` vencido hoje na hora. Seria um segundo caminho de escrita no SRS (contra ADR-015); não recomendado.
2. **Q2 — Formato do "export" de Minhas cartas** (etapa 10).
   - **A (recomendada)**: CSV (`;`, UTF-8, abre no Excel, Google Planilhas e Anki), só exportar. Restaurar continua pelo backup completo.
   - B: JSON próprio com importação. Novo formato de arquivo, mais trabalho e mais testes.
   - C: só um atalho para o backup completo que já existe em Ajustes.
3. **Q3 — Baralhos por unidade no hub** (etapa 9).
   - **A (recomendada)**: só as unidades já desbloqueadas na Trilha (como os distratores do Praticar). Os baralhos por mapa e por coleção ficam todos abertos, como os mapas.
   - B: todas as unidades, com selo "ainda não chegou aqui".
4. **Q4 — ADR-022 (proposto)** (etapas 3, 5 e 9): aprovar as regras de montagem da sessão de cartas e a fila única com duas formas de revisar, em que as cartas do aluno entram no contador e nas cartas, mas não no "Revisar com exercícios" (o gerador de exercícios precisa de itens do conteúdo). Recomendação: aprovar.

**Respostas do usuário (2026-11-07):** Q1 A · Q2 A · Q3 A · Q4 aprovado.
