# Mapas e cartas — Fase 3: Motor dos mapas

**Objetivo:** pôr no ar a aba **Mapas** e o visualizador de mapa mental sobre os 6 mapas portados na Fase 2. No fim da fase, o aluno abre a aba Mapas pela navegação, filtra e busca mapas, abre um mapa em árvore vertical (centro → ramos → cartões → linhas, com cenas), ouve os trechos em inglês, consulta o item de uma linha com `ref`, estuda com "Esconder o inglês" (que grava `mapProgress` e dá 5 XP uma vez por dia), faz o Teste rápido e pratica o mapa. Tudo lazy, acessível e sem tocar no modelo persistido.

Referências: `docs/MAPAS-E-CARTAS.md` (§3, §4.4, §4.5, §5.1, §5.2, §6.1, §8, §12.3), ADR-013, ADR-015, ADR-017, ADR-018, `docs/ESTILO-CENAS.md`. Comportamento e visual de referência: `prototipo/mapas-e-cartas/` (`app.js` `viewMap`/`setHide`/`quizHtml`, `common.js` `renderNode`/ícones, `styles.css`), congelado.

**Decisões já tomadas (não reabrir):** navegação Trilha · Mapas · Praticar · Perfil · Ajustes; cartas ficam em Praticar (Fase 4); só a árvore vertical, sem radial, pan/zoom nem PNG; Patrick Hand; mapa estudado vale 5 XP uma vez por mapa por dia; mapas não mexem em corações (o "Praticar este mapa" é Praticar e dá +1 coração, §4.5); ligação com o SRS só pelo `ref`.

**Não muda o modelo persistido:** nenhuma tabela Dexie, nenhum campo novo, `schemaVersion` do backup continua 2. Tudo que a fase grava já existe desde a Fase 2 (`LessonResult` `kind: 'map' | 'practice'` com `context.mapId`, upsert de `mapProgress`, `AppliedCommit.xp`). A única mudança de formato é no `sessionStorage` da lição em andamento (etapa 2), que é por aba, versionado e descartável. **Nenhuma dependência nova** além de `@fontsource/patrick-hand`, já aprovada (decisão 10, §9).

**Sem bloqueios:** Q1–Q4 decididas pelo usuário em 2026-11-04 (fim do arquivo).

**Status: concluída.** Etapas 1 a 12 entregues, uma por commit. Desvios e pendências em "Fechamento da fase", no fim do arquivo.

## Etapas (um commit por etapa)

### 1. `docs: plan mind maps phase 3` (arquiteto)

Este plano, as pendências herdadas da Fase 2 movidas para cá (etapa 6; `FASE-2.md` aponta para cá) e a ADR-019 (aprovada, em `DECISOES.md`). No fim da fase, o arquiteto atualiza `ARQUITETURA.md` §3 e §13 (rotas, navegação de 5 itens) e o §5.2 de `MAPAS-E-CARTAS.md` com o que mudou na implementação (etapa 12).

### 2. `refactor: extract pure helpers for map screens`

Executor: `desenvolvedor`. Sem mudança de comportamento; prepara o que as telas novas reutilizam.

Arquivos: `src/domain/grading/grade.ts`, `src/domain/grading/patterns.ts`, `src/domain/practice/generate.ts`, `src/domain/text/search.ts` (novo), `src/content/buildManifest.ts`, `src/features/lesson/sessionStore.ts`, testes ao lado.

- **`gradeText`**: extrair de `gradeExercise` a correção de texto livre que o Teste rápido precisa, sem `Exercise`:
  ```ts
  export function gradeText(
    value: string,
    patterns: readonly string[], // ADR-004; o 1º é a resposta exibida
    lang: Lang,
    ctx: GradeContext,
  ): GradeResult;
  ```
  `gradeExercise` passa a chamá-la nos tipos de texto. Os testes atuais do corretor continuam verdes sem edição.
- **`displayPattern(pattern)`** em `patterns.ts` (hoje `display` privado em `generate.ts`): primeira forma concreta de um padrão. A tela usa para mostrar e falar o `en` dos itens, que pode ter `(x)`/`[a|b]`.
- **`searchWords(texts)`** em `src/domain/text/search.ts`: a normalização de `searchText` sai de `buildManifest.ts` para o domínio (o `content` importa o `domain`, nunca o contrário). `searchText` vira uma fachada; `manifest.test.ts` continua sem divergência.
- **`sessionStore.ts`** (pendência descoberta no plano): o `stateSchema` hoje usa `z.object` sem `context` e com `kind` sem `'cards' | 'map'`. Depois de recarregar a página no meio do "Praticar este mapa", o `context.mapId` seria **descartado em silêncio**, e o commit não gravaria `mapProgress`. Correção: `kind` com todos os `SessionKind` (derivado da mesma lista, sem repetir literais) e `context` opcional com o mesmo formato de `LessonContext`. Campos opcionais: sessões salvas antes continuam válidas, sem subir `SESSION_VERSION`.
- Testes: `gradeText` (certo, quase, errado, padrão com alternativa); `displayPattern` (`"(I'm) fine"`, `"[hi|hello]"`); `searchWords` igual ao `searchText` antigo sobre o conteúdo real; sessão com `context: { mapId }` sai igual de `saveSession` → `loadSession`; sessão antiga sem `context` continua carregando.

### 3. `feat: add pure mind map view model`

Executor: `desenvolvedor`. Tudo em `src/domain/`, puro, sem React, Dexie nem `content`: os tipos de entrada são **estruturais** e mínimos (o `MindMap` do `z.infer` é atribuível a eles), como o `ctx` do `mindMapIssues`.

Arquivos: `src/domain/mindmap/{lines,reveal,quiz,filter}.ts`, `src/domain/cards/flashcard.ts`, testes ao lado.

- **`lines.ts`**: transforma cada linha em um modelo de exibição.
  ```ts
  type LineView =
    | { kind: 'item'; itemId: string; en: string; pt: string; hint?: string; strong: boolean }
    | { kind: 'text'; en: RichSegment[]; speakText: string; pt?: string }
    | { kind: 'fix'; wrong: string; right: string; note?: string }
    | { kind: 'note'; text: string };
  export function lineView(
    line: MapLineShape,
    tag: MapTagShape,
    lookup: ItemLookup,
  ): LineView | null;
  ```
  `item`: `en` por `displayPattern`, `pt` = sentidos juntados por ", ", `strong` nos cartões `vocabulario` (§2.5). `text`: `parseBold`, `speakText` sem `**`. `ref` que não está no `lookup` → `null` (a tela pula a linha e registra no console; o loader já rejeita `ref` inexistente, mas a tela não depende disso).
- **`reveal.ts`** ("Esconder o inglês", §6.1): `hideableChunks(map, lookup)` lista os trechos cobertos na ordem do JSON, com chave estável (`b{i}.n{j}.l{k}`). Ficam cobertos: `en` de linhas `item` e `text` e o `right` de `fix`; continuam visíveis o centro, títulos, português, `wrong` e `note`. Estado e ações:
  ```ts
  type RevealState = {
    on: boolean;
    revealed: string[];
    ratings: Record<string, 'remembered' | 'forgot'>;
  };
  // toggle, reveal(key), rate(key, itemId, r), reset
  export const isComplete = (s: RevealState, total: number) => s.on && s.revealed.length >= total;
  export function revealOutcomes(s, chunks): { itemId: string; q: 4 | 1 }[]; // §3: Lembrei 4, Não lembrei 1
  ```
  A nota é opcional por linha (sem nota, o item não entra em `itemOutcomes` e o SRS não muda). O mesmo `itemId` em duas linhas usa o menor `q`. Desligar o modo zera o estado.
- **`mapStudySummary(state, chunks, startedAt, nowMs)`**: o `LessonSummary` da sessão `map` (`xp: MAP_STUDY_XP`, `perfect: false`, `mistakes` = "Não lembrei", `accuracy` = Lembrei ÷ linhas avaliadas, 1 se nenhuma foi avaliada, `itemOutcomes` de `revealOutcomes`). O XP final (5 ou 0) continua decidido no commit por `finalSessionXp`.
- **`quiz.ts`** (Teste rápido): estado por item (`empty | right | almost | wrong`), `check(i, value, ctx)` com `gradeText(value, accepted, 'en', ctx)`, `checkAll`, `toggleAnswers`, `score`. "Quase" conta como certo e mostra a forma correta (como na lição). Não grava nada.
- **`filter.ts`**: `parseMapFilters(searchParams)` / `toSearchParams(filters)` (`nivel`, `unidade`, `tipo`, `estudado`, `q`; valores desconhecidos são ignorados, nunca quebram a tela) e `filterMaps(maps, filters, studiedIds)`. Busca: cada palavra da consulta, normalizada por `searchWords`, é prefixo de alguma palavra do `search` do manifesto. Ordem: a do manifesto. `filterOptions(maps)` só oferece níveis, unidades e tipos que existem (§2.2).
- **`flashcard.ts`** (adiantado da Fase 4, só o necessário): `toFlashcard(item, entry?)` monta o `Flashcard` do §2.6. O painel da linha com `ref` mostra exatamente o verso da carta, então a função nasce aqui e a Fase 4 a estende, sem duplicar.
- Testes: um caso por forma de linha; `ref` ausente → `null`; trechos cobertos do `mm-to-be` real (via fixture copiada, não import de `content`); `revealOutcomes` com nota dupla no mesmo item; `isComplete` só com o modo ligado; quiz com `"isn't"` / `"is not"` / erro de digitação; filtros combinados, URL com valor inválido, busca sem acento ("voce" acha "você"); `toFlashcard` com falso cognato (`caution` = `notes`).

### 4. `feat: add notebook icons, tag chips and hand font`

Executor: `desenvolvedor`. Visual: `designer-de-mapas`.

Arquivos: `package.json` (`@fontsource/patrick-hand`), `src/ui/notebook/{NotebookIcon,TagChip,Marker,PaperSheet}.tsx`, `src/ui/notebook/notebook.css`, `src/ui/icons` (`MapsIcon`), `src/features/showcase/Showcase.tsx`, `src/i18n/pt-BR.ts` (`t.maps.tags`), testes.

- `NotebookIcon` com os 16 `mapIcons` e `TagChip` com as 5 tags (forma + ícone + rótulo, nunca só cor), redesenhados a partir do `common.js` do protótipo como componentes SVG próprios, `aria-hidden` (o rótulo é texto). Traço com `currentColor` ou tokens `--map-*`; nada de hex solto.
- `MapsIcon` da navegação, no mesmo padrão dos ícones atuais (`filled` quando ativo), desenhado no conjunto do §8, não emoji.
- **Patrick Hand**: `@fontsource/patrick-hand` (subset latin, 1 peso) importada **só** em `notebook.css`, que só é importado pelos módulos das rotas lazy de mapa. Classe `font-hand` com mínimo de 22 px, só em acentos redundantes (`doodle`, anotações, subtítulos de capa). `font-display: swap`.
- Showcase: seção "Caderno" com ícones, chips das tags, marca-texto e papel, em claro e escuro.
- Testes: cada `mapIcons` e cada `mapTags` renderiza (lista derivada das constantes do schema, sem repetir literais); `TagChip` expõe o rótulo em texto.
- **Portão visual:** `designer-de-mapas` aprova ícones e chips no showcase (390×844 e desktop, claro, escuro e escala de cinza).

### 5. `feat: add maps tab and routes`

Executor: `desenvolvedor`. Mostra a estante de coleções (Q1 = A) e todos os mapas abertos (Q2).

Arquivos: `src/app/routes.ts`, `src/app/router.tsx`, `src/app/AppLayout.tsx`, `src/features/maps/{MapsScreen,MapFilters,MapListItem,CollectionShelf}.tsx`, `src/stores/useMapProgress.ts` (novo), `src/i18n/pt-BR.ts`, testes.

- `paths.maps = '/mapas'`, `paths.map(id)`, `paths.mapPractice(id)`, `paths.collection(id)`. Segmentos fixos antes de `:mapId` (§5.2). Toda rota nova é `lazy`.
- **Navegação de 5 itens** na posição do §5.1 (`grid-cols-5`; ≥ 78 px por alvo em 390 px). O item Mapas **não** usa `end`, para ficar ativo em todo `/mapas/*`. Rótulo em `t.nav.maps`.
- **`AppLayout`**: as rotas podem pedir `handle: { hideBottomNav?: true; wide?: true }` (lidos com `useMatches`). O visualizador esconde a barra inferior no celular (mantém o trilho no desktop) e usa coluna de ~760 px. Sem `handle`, nada muda nas telas atuais.
- **`MapsScreen`** (`/mapas`), Tuca `feliz`:
  1. Estante de coleções (capas compactas; ver Q1), só para coleções que existem em `manifest.collections`.
  2. Lista de mapas do manifesto (sem carregar nenhum JSON de mapa): ícone, título, selo de nível, tipo, número de cartões, "Teste rápido" quando `hasQuiz`, selo "já estudado" (com ícone e texto, não só cor). Contador "N de M mapas estudados".
  3. Filtros (nível, unidade, tipo, estudado) e busca, todos na URL (`filter.ts`), com "Limpar filtros". Resultado anunciado em `aria-live="polite"` ("3 mapas").
- **`useMapProgress`** (Zustand): `repository.getMapProgress()`; recarrega com `onLessonCommitted` e `onDataReplaced`, como o `usePractice`. Importado só pelas rotas de mapa.
- **Estados**: sem mapas no manifesto → vazio com Tuca e texto; filtros sem resultado → mensagem + "Limpar filtros"; erro ao ler `mapProgress` → lista sem selos, sem quebrar.
- Testes (Testing Library): navegação tem 5 itens na ordem certa e Mapas ativo em `/mapas/mm-to-be`; filtros refletem a URL e vice-versa; busca "voce"; vazio; filtros sem resultado; selo "já estudado" com progresso semeado; teclado chega a todos os filtros.

### 6. `feat: add mind map viewer`

Executor: `desenvolvedor`. Inclui as **pendências herdadas da Fase 2** (retiradas de `FASE-2.md`, ver nota no fim desta etapa).

Arquivos: `src/features/mindmap/{MapScreen,MapHeader,MapBranch,MapCard,MapLine,MapScene,SpeakText,LineDetailSheet,MapNotFound}.tsx`, `src/features/mindmap/useMap.ts`, `src/features/mindmap/art.ts` (só leitura), `scripts/check-prod-bundle.ts`, `scripts/lib/contentLeaks.ts`, `src/i18n/pt-BR.ts`, testes.

- `useMap(mapId)`: `loadMap` + `loadItems(manifest.maps[i].itemIds)` em paralelo (`useAsync`). `mapId` fora do manifesto → `MapNotFound` (texto + voltar para `/mapas`), sem chamar o loader. `ContentLoadError` → `ContentError` com "Tentar de novo" (offline incluído). Carregando → `ContentSkeleton`.
- Cabeçalho (§6.1): ícone, título com marca-texto, selo de nível, `intro`, `doodle` em `font-hand`, cena do centro; centro com `center.en` (`lang="en"`) e `center.pt`. `document.title` = título do mapa.
- Ramos: `<section>` com `<h2><button aria-expanded aria-controls>` (alvo ≥ 48 px), nome, ícone, cor (`--map-<cor>-*`) e contagem de cartões. "Abrir tudo / Fechar tudo". Abrir e fechar sem animação com `useReducedMotion()`; com movimento, só altura/opacidade curtas (Framer Motion).
- Cartões: `TagChip`, título opcional (rich text), linhas de `lineView`, cena à direita alinhada à base. No desktop, cartões lado a lado dentro do ramo.
- Linhas: `en` com `lang="en"` e negrito por segmentos (sem `dangerouslySetInnerHTML`); `fix` com ✗ riscado (`--mark-wrong`) e ✓ em negrito (`--mark-right`) + texto para leitor de tela ("errado"/"certo"); `note` em PT.
- **Cenas** (`MapScene`): `<img src={artUrl(name)} alt="" aria-hidden="true" loading="lazy" decoding="async" width height>` com tamanho fixo (80 px no celular, 96–128 px no desktop, `ESTILO-CENAS.md`). **Pendência herdada 1:** se `artUrl(name)` é `undefined` (cena ausente ou renomeada), o componente **não renderiza `<img>`** e o cartão mantém o layout sem a coluna da cena; um `console.warn` com o nome. Vale para `art` e `centerArt`.
- **Áudio** (`SpeakText`): tocar num trecho em inglês chama `speak(text)` com `speakText`/`displayPattern`; estado "falando" com `aria-pressed` e ícone. Sem `ttsSupported()` ou com `hasNoVoice()`, o trecho vira texto simples e aparece **um** aviso no fim do mapa (`subscribeNoVoice`). Sair da tela chama `stopSpeaking()`.
- **Painel da linha com `ref`** (`LineDetailSheet`): botão "Ver detalhes" na linha (separado do botão de áudio) abre um diálogo inferior (`role="dialog"`, `aria-modal`, foco preso, `Esc` fecha e devolve o foco à linha) com o verso de `toFlashcard`: EN, PT, exemplo, pronúncia, "cuidado". "Adicionar ao baralho de hoje" fica para a Fase 4 (depende da sessão de cartas).
- **Pendência herdada 2 — lazy:** o primeiro e único importador de `src/features/mindmap/art.ts` é o `MapScreen` (rota lazy). Teste de unidade no `check-prod-bundle`/`contentLeaks`: além de nomes de cena, o JS inicial não pode conter o mapa de cenas (marcador: o caminho `content/art/` e qualquer URL `assets/*.svg` de cena). Limite do JS inicial: 260 kB gzip (ADR-013); hoje 235 kB.
- **Pendência herdada 3 — cenas como arquivos:** o `check-prod-bundle` passa a conferir em `dist/assets/` que **cada** cena de `src/content/art/` virou um `.svg` próprio (contagem por nome com hash, efeito do `?no-inline`) e que **nenhum** JS ou CSS do build (não só o inicial) contém `data:image/svg+xml`. O mesmo script confere que o `index.html` não pré-carrega a fonte Patrick Hand nem o CSS do caderno.
- Testes: renderiza `mm-to-be` real (via loader com glob real) com 6 ramos e todos os cartões; `artUrl` mockado para `undefined` → nenhum `<img>` e o cartão continua com título e linhas; `mapId` desconhecido → "não encontrado"; `ContentLoadError` → botão de tentar de novo; teclado abre/fecha ramo; sem TTS → nenhum botão de áudio e um aviso; painel abre, prende o foco e devolve ao fechar; todo trecho em inglês tem `lang="en"`.

> Pendências movidas de `docs/fases/mapas-e-cartas/FASE-2.md` ("Pendências para a Fase 3"): as três acima. A seção da Fase 2 já está marcada como movida para cá.

### 7. `feat: add hide-english study and map commit`

Executor: `desenvolvedor`. Revisão do commit em `opus` (escreve dados persistidos).

Arquivos: `src/stores/useProfile.ts`, `src/features/mindmap/{HideEnglishBar,HiddenChunk,MapStudyComplete}.tsx`, `src/features/mindmap/MapScreen.tsx`, `src/i18n/pt-BR.ts`, testes (`useProfile.mapStudy.test.ts`, componentes, `dexieRepository` já coberto na Fase 2).

- Botão "Esconder o inglês" (`aria-pressed`) na barra do mapa. Ligado: cada trecho de `hideableChunks` vira um post-it kraft (`--postit`, `--postit-edge`) com botão "Mostrar o trecho em inglês"; o conteúdo coberto fica `inert`. Revelar foca o trecho revelado (como no protótipo). Progresso "3 de 24 revelados" em `aria-live="polite"`. Tuca `pensando` na barra. Ramos fechados abrem ao ligar o modo.
- Linha com `ref` revelada mostra "Lembrei / Não lembrei" (opcional, §3). Uma linha avaliada mostra a escolha com ícone e texto.
- **Concluir** = revelar todos (`isComplete`). Só então grava: um commit `kind: 'map'`, `lessonId: 'map:<mapId>'`, `context: { mapId }`, id determinístico `map:<mapId>-<startedAt>` (recarregar no meio do salvamento não duplica), resumo de `mapStudySummary`. Abrir o mapa ou só ler **não** grava nada (ver Q3).
- **`commitSession`**: `commitLesson` hoje exige `LessonState`. Extrair `commitSession({ lessonId, kind, context, startedAt, summary }, dailyGoalXp, placement?)` com o mesmo `apply` (XP final por `finalSessionXp`, ofensiva, meta, conquistas, corações por `sessionGainsHeart`); `commitLesson` vira uma fachada. Nenhuma regra muda, nenhum segundo caminho de escrita (ADR-015).
- **`MapStudyComplete`** (painel no fim do mapa, `role="status"`, Tuca `comemorando`): "+5 XP" ou "Você já estudou este mapa hoje: sem XP desta vez" (XP lido do `CommitSummary`, nunca recalculado na tela), ofensiva e meta quando mudarem, e os atalhos "Teste rápido" (se houver) e "Praticar este mapa". Falha ao salvar → mensagem com "Tentar de novo", sem perder o estado revelado.
- Testes: commit `map` grava `mapProgress` e dá 5 XP; segundo estudo no mesmo dia = 0 XP e `timesStudied` 2; `practice` com `mapId` antes → `map` depois vale 0 (ADR-018 c); corações intactos; "Lembrei" vira `q` 4 e "Não lembrei" `q` 1 no `SrsCard`; linha sem nota não cria `SrsCard`; commit repetido (mesmo id) não soma de novo; desligar o modo antes do fim não grava; `useProfile.test.ts` atual verde sem edição.

### 8. `feat: add map quick test`

Executor: `desenvolvedor`.

Arquivos: `src/features/mindmap/{QuickTest,QuickTestItem}.tsx`, `src/i18n/pt-BR.ts`, testes.

- Seção "Teste rápido" (`<section aria-labelledby>`, `h2` focável) depois dos ramos, só com `quiz`. Botão na barra leva até ela e foca o título.
- Cada item: enunciado com a lacuna como `<input>` rotulado ("Lacuna 1"), `lang="en"` no enunciado e no campo, `hintPt` visível. "Conferir" por item e "Conferir tudo"; "Ver respostas" (`aria-pressed`) mostra o 1º `accepted`. Resultado com ícone e texto, em `aria-live`. Enter confere e vai para a próxima lacuna.
- Usa `loadKnownWords()` (lazy) para o "quase certo". **Não grava** nada, sem XP nem SRS (§4.4). Dica "Tente com o inglês escondido" liga o modo da etapa 7.
- Testes: certo, quase e errado; "Conferir tudo" com lacunas vazias; "Ver respostas"; teclado; nenhum `recordLessonResult` chamado.

### 9. `feat: add practice this map`

Executor: `desenvolvedor`.

Arquivos: `src/features/mindmap/MapPracticeSession.tsx`, `src/stores/usePractice.ts` (`buildMapPracticeSession`), `src/app/router.tsx`, testes.

- Rota `/mapas/:mapId/praticar` em tela cheia (fora do `AppLayout`), `LessonPlayer` com `kind: 'practice'`, `lessonId: 'map-practice:<mapId>'`, `context: { mapId }`, `exitTo` = o mapa.
- `buildMapPracticeSession(mapId, caps)`: itens = `manifest.maps[i].itemIds` → `loadItems` → `toPracticeItem` → `generatePractice` (seed do `clock`) → `applyFallbacks`. Distratores: itens dos mesmos arquivos carregados. Retoma a sessão salva com o mesmo `lessonId` (depende da correção do `sessionStore` da etapa 2).
- Commit pelo caminho atual: +1 coração, XP do Praticar, upsert de `mapProgress` (já implementado na Fase 2). `mapId` desconhecido → volta para `/mapas`.
- Testes: sessão gerada só com itens do mapa; recarregar no meio mantém `context.mapId` e o commit grava `mapProgress`; sem TTS não há `listen-type` (fallbacks atuais).

### 10. `feat: add read-only collection screen` (Q1 = A)

Executor: `desenvolvedor`. Entra nesta fase (Q1 = A).

Arquivos: `src/features/maps/{CollectionScreen,CollectionEntry}.tsx`, `src/i18n/pt-BR.ts`, testes.

- `/mapas/colecoes/:collectionId`: `loadCollections` + `loadItems` das entradas. Entradas agrupadas por `topic` (frases), por `baseVerb` (phrasal) ou em lista (expressões, falsos cognatos), com EN (`lang="en"`, áudio), PT, `situation`, selo de `formality` com texto, `avoidWhen` e "cuidado". Mapas da coleção (`mapIds`) no topo. Leitura apenas: "Revisar com cartas" entra na Fase 4.
- Estados: coleção desconhecida → não encontrada; erro de conteúdo → tentar de novo.
- Testes: as 4 coleções portadas renderizam; selo de formalidade com texto; mapas da coleção levam ao visualizador.

### 11. `test: add maps e2e and screenshots`

Executor: `qa-tester` (escreve), `desenvolvedor` corrige o que falhar.

Arquivos: `e2e/maps.spec.ts` (novo), `e2e/screenshots.spec.ts` (ou o script de `npm run screenshots`), `e2e/offline.spec.ts`.

- Jornada (mobile 390×844 e desktop): Trilha → aba Mapas → filtra por A2 → busca "get" → abre `mm-phrasal-get` → abre e fecha um ramo pelo teclado → ouve um trecho (TTS simulado) → abre o painel de uma linha → liga "Esconder o inglês" → revela tudo com uma nota → vê "+5 XP" → volta à lista e vê "já estudado" → estuda de novo e vê "sem XP desta vez" → Teste rápido → Praticar este mapa até o fim.
- Offline: depois da 1ª visita a `/mapas` e a um mapa, o mesmo mapa e suas cenas abrem sem rede.
- Reduced motion (`page.emulateMedia({ reducedMotion: 'reduce' })`): ramos abrem sem transição.
- Capturas para o `revisor-ux` e o `designer-de-mapas`: `/mapas` (com e sem filtros, vazio de filtros), `mm-to-be` (topo, ramo aberto, painel, modo escondido no meio e concluído, Teste rápido conferido), `mm-falsos-cognatos-1`, coleção (se etapa 10). Em 390×844 e 1280×800, claro e escuro; escala de cinza para o designer.

### 12. `docs: update architecture for maps tab` (arquiteto)

`ARQUITETURA.md` §3 (pastas `features/maps`, `features/mindmap`, `ui/notebook`, `domain/text`), §13 (rotas e navegação de 5 itens), §16 se o fluxo mudar; `MAPAS-E-CARTAS.md` §5.2/§6.1 com os ajustes da implementação; ADR-019 com o status final.

## Agentes de apoio (agente principal)

Antes da etapa 4, o agente principal ajusta em `.claude/` (fora do alcance do arquiteto; aqui só a especificação, como na Fase 2 etapa 9):

- `revisor-ux`: checklist do caderno (marca-texto, post-it, tags com forma + ícone + rótulo, Patrick Hand só redundante e ≥ 22 px, cenas sem salto de layout).
- `qa-tester`: TTS simulado, `artUrl` indefinido, reduced motion, offline do mapa.
- `desenvolvedor`: onde ficam `features/maps` vs `features/mindmap`, `art.ts` só em rota lazy, `notebook.css` só nas rotas de mapa.

## Testes exigidos (resumo)

| Área                | Teste                                                                                                            |
| ------------------- | ---------------------------------------------------------------------------------------------------------------- |
| Helpers extraídos   | `gradeText`, `displayPattern`, `searchWords` sem mudança de comportamento; testes antigos verdes sem edição      |
| Sessão em andamento | `context.mapId` sobrevive a reload; sessões antigas continuam válidas                                            |
| Domínio do mapa     | `lineView`, `hideableChunks`, `revealOutcomes`, `mapStudySummary`, `quiz`, `filterMaps`, `toFlashcard`           |
| Commit do mapa      | 5 + 0 XP no mesmo dia, `mapProgress`, `q` 4/1, corações intactos, id determinístico, `practice` → `map` = 0      |
| Telas               | lista, filtros na URL, vazio, não encontrado, erro com tentar de novo, cena ausente, sem TTS, painel, quiz       |
| Acessibilidade      | teclado em tudo, `aria-expanded`, `aria-pressed`, `aria-live`, foco do painel, `lang="en"`, reduced motion       |
| Bundle              | nada de mapa, cena, `art.ts`, fonte ou CSS do caderno no inicial; cada cena um `.svg`; zero `data:image/svg+xml` |
| E2E                 | `maps.spec.ts` mobile + desktop; offline do mapa; suíte atual verde                                              |

## Critérios de aceite

- `npm run lint`, `typecheck`, `test`, `e2e`, `validate:content` e `build` verdes; `check-prod-bundle` verde com as checagens novas.
- JS inicial ≤ 260 kB gzip (ADR-013) e **≤ 240 kB** ao fim da fase (hoje 235 kB): só a navegação, o ícone, as rotas e os textos de `pt-BR.ts` entram no inicial. O PR informa o número.
- A aba Mapas aparece na navegação, na 2ª posição, e fica ativa em todo `/mapas/*`.
- Os 6 mapas abrem, com todas as linhas e cenas; uma cena ausente não quebra o cartão nem gera `<img>` quebrado.
- Estudar um mapa com "Esconder o inglês" grava `mapProgress` e dá 5 XP uma vez por dia; repetir mostra 0 XP; corações não mudam; o selo "já estudado" aparece na lista.
- O Teste rápido corrige com o corretor existente e não grava nada; "Praticar este mapa" dá XP do Praticar e +1 coração e sobrevive a reload.
- Navegável só pelo teclado, com foco visível, `lang="en"` em todo trecho em inglês, feedback em `aria-live` e sem animação com reduced motion.
- Offline: um mapa já visitado abre com as cenas.
- Nenhuma mudança em tabela Dexie nem no formato do backup.
- `domain` continua sem importar React, Dexie ou `content`.
- `designer-de-mapas` e `revisor-ux` sem bloqueantes; revisores de código sem bloqueantes.

## Portões

| Etapas               | Revisão                                                                                                                                |
| -------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| 2, 3, 5, 6, 8, 9, 10 | `revisor-de-codigo` + `qa-tester` (paralelo) → correção → nova verificação                                                             |
| **7**                | `revisor-de-codigo` com **`model: opus`** (refatoração do caminho de commit, escreve `results`/`mapProgress`/`srs`) + `qa-tester`      |
| 4                    | `revisor-de-codigo` + `qa-tester`; **`designer-de-mapas`** (ícones, chips, fonte no showcase)                                          |
| 5, 6, 7, 8           | `designer-de-mapas` confere cada tela nova por capturas parciais antes do commit (claro, escuro, escala de cinza)                      |
| 11                   | `revisor-de-codigo` nos testes; capturas finais para o portão de fase                                                                  |
| **Fim da fase**      | `revisor-ux` com screenshots 390×844 e desktop (claro e escuro) + `designer-de-mapas` (mesmas capturas + escala de cinza), em paralelo |
| 1, 12                | o usuário vê o diff dos docs no commit                                                                                                 |

Nenhuma etapa avança com bloqueante. Commit ao fim de cada etapa aprovada. Ao delegar, o agente principal passa `model` explicitamente (`opus` só no revisor da etapa 7; `sonnet` nos demais).

## Fora desta fase

- Hub do Praticar, sessão de cartas, "Adicionar ao baralho de hoje", "Revisar com cartas" das coleções, `Quality` 3 (Difícil) e baralhos (Fase 4).
- Conteúdo novo: mapas de habilidade, temáticos, bancos (Fase 5).
- Conquistas novas, "Ver mapa da habilidade" na trilha e na dica, "mapas estudados" no perfil, capa e tela do "30 dias com o Tuca" (Fase 6).
- Impressão e apostilas (Fase 7).
- Vista radial, pan/zoom, `d3-hierarchy` e PNG: fora do escopo do recurso.

## Decisões do usuário (2026-11-04)

1. **Q1 — Estante de coleções:** opção **A**. A etapa 10 (tela de coleção só de leitura) entra nesta fase; "Revisar com cartas" fica para a Fase 4.
2. **Q2 — Mapas abertos ou bloqueados:** **todos abertos**, com o selo de nível e a unidade visíveis.
3. **Q3 — "Mapa visto":** **não registrar** nesta fase; `mapProgress` não muda.
4. **Q4 — ADR-019:** **aprovada** e movida para `docs/DECISOES.md`.

Sem outras pendências: nenhuma dependência nova além da Patrick Hand (aprovada), nenhuma tabela nova, backup inalterado.

## Fechamento da fase

### Etapas

| Etapa | Commit                                               | Status    |
| ----- | ---------------------------------------------------- | --------- |
| 1     | `docs: plan mind maps phase 3`                       | concluída |
| 2     | `refactor: extract pure helpers for map screens`     | concluída |
| 3     | `feat: add pure mind map view model`                 | concluída |
| 4     | `feat: add notebook icons, tag chips and hand font`  | concluída |
| 5     | `feat: add maps tab and routes`                      | concluída |
| 6     | `feat: add mind map viewer`                          | concluída |
| 7     | `feat: add hide-english study and map commit`        | concluída |
| 8     | `feat: add map quick test`                           | concluída |
| 9     | `feat: add practice this map`                        | concluída |
| 10    | `feat: add read-only collection screen`              | concluída |
| 11    | `test: add maps e2e and screenshots` (+ `fix: polish maps screens after phase review`) | concluída |
| 12    | `docs: update architecture for maps tab`             | concluída |

### Desvios do plano

- **Offline do mapa**: a cobertura ficou em `e2e/qa-mapas-etapa6.spec.ts`, e não em `e2e/offline.spec.ts`.
- **JS inicial**: 239,6 kB gzip no fim da fase, dentro do limite de 240 kB (critério de aceite) e do teto de 260 kB (ADR-013).
- **Barra de estatísticas**: virou `handle.statsBar` do `AppLayout` e aparece nas abas Trilha, Mapas, Praticar e Perfil (`ARQUITETURA.md` §13).
- **`isComplete(state, chunks)`**: recebe os trechos, não o total.
- **"Praticar este mapa"**: a montagem ficou em `stores/usePractice.ts` (`buildMapPracticeSession`, `mapPracticeLessonId`) e só retoma uma sessão salva do mesmo mapa.
- **"Ver detalhes"** fica escondido enquanto o trecho da linha está coberto; **`useNoVoiceNotice`** é comum ao mapa e à coleção; **`speak()`** resolve a chamada anterior quando é substituída (`MAPAS-E-CARTAS.md` §5.2 e §6.1).

### Pendências para depois

- **Bug conhecido**: uma URL com escape malformado (ex. `/mapas/colecoes/%E0%A4%A`) deixa a tela em branco. Está coberto por `test.fail` em `e2e/qa-mapas-etapa10.spec.ts`; quando for corrigido, o teste vira `test`.
- Atalho "Praticar este mapa" na barra do mapa (hoje só no painel de conclusão).
- O campo da lacuna do Teste rápido corta palavras longas.
- Espaçamento das linhas da regra no `mm-to-be` no celular.
- O leitor de tela lê a meta diária duas vezes, porque o `GoalRing` fica ao lado do texto.
- **Orçamento do JS inicial**: só restam 0,4 kB de folga sobre a meta de 240 kB. Planejar antes da Fase 4 (rever a meta ou tirar algo do inicial).
