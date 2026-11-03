# Mapas e cartas — Fase 2: Base

**Objetivo:** deixar pronta a fundação de dados de mapas mentais e cartas, sem nenhuma tela nova. Isso inclui os formatos de conteúdo validados, o carregamento lazy, a persistência v2 com migração testada, o backup v2 que lê v1, o commit preparado para os novos `kind` e o conteúdo aprovado do protótipo portado para `src/content/`. No fim da fase, o app se comporta exatamente como hoje para o aluno, mas um banco v1 abre em v2 sem perder nada e os 6 mapas e 60 cartas validam.

Referências: `docs/MAPAS-E-CARTAS.md` (§2, §4, §8, §12), ADR-015, ADR-017.

**Muda o modelo persistido** (aprovado, decisão 4): Dexie v2 só com tabelas novas, `schemaVersion: 2` no backup. **Muda o formato do conteúdo** (decisão 3 + ADR-017): `level` obrigatório nas unidades e arquivos novos. A navegação e as telas **não mudam** nesta fase.

**Sem bloqueio:** o ADR-017 foi aprovado em 2026-11-03, então a etapa 2 está liberada. As etapas 5 a 7 (persistência) não dependem das etapas 2 a 4 e podem correr em paralelo.

## Etapas (um commit por etapa)

### 1. `docs: plan mind maps and cards phase 2` (arquiteto)

Este plano, §5.1/§12 de `MAPAS-E-CARTAS.md`, ADR-015/016 ajustados e ADR-017. Feito.

### 2. `feat: add cefr level and optional item fields`

Arquivos: `src/content/schema.ts`, `src/content/units/u0{1..4}-*.json`, `src/content/schema.test.ts`, `src/content/schema.edge.test.ts`, `src/content/pedagogy.ts` (+ teste).

- `cefrLevels`, `levelSchema`; `unitSchema.level` obrigatório; `"level": "A1"` nas 4 unidades (edição mecânica, sem mudar outra linha).
- `pronunciation?` (≤ 40) em vocab e frase; `example?` e `emoji?` em frase.
- `bankVocabSchema`/`bankSentenceSchema` = schemas de item + `level?`. Itens de unidade continuam sem `level` (o schema da unidade usa os schemas sem o campo).
- Vocab com `focus: 'falso-cognato'` exige `notes` (regra em `pedagogy.ts` ou no `superRefine`, o que já for o padrão do projeto).
- Testes: unidade sem `level` rejeitada com mensagem útil; `pronunciation` de 41 caracteres rejeitada; frase com `example` aceita; item de unidade com `level` rejeitado; falso cognato sem `notes` rejeitado; `realContent.test.ts` continua verde.

### 3. `feat: add bank, mind map, collection, deck and plan schemas`

Arquivos: `src/content/schema.ts` (ou `src/content/schemas/*.ts`, se o arquivo passar de ~500 linhas), `src/content/mindmapIssues.ts`, `src/content/collectionIssues.ts`, testes ao lado, fixtures em `src/test/fixtures/content/`.

- `bankSchema`, `mindMapSchema` (+ `mapLineSchema`, `mapNodeSchema`, `mapQuizSchema`), `collectionSchema`, `collectionEntrySchema`, `deckSchema`, `studyPlanSchema`, como no §2.4–2.6. Tipos por `z.infer`.
- `courseIssues` passa a receber `{ units, banks }`: ids únicos entre unidades e bancos, prefixo do id compatível com o banco.
- `mindMapIssues(map, ctx)` com as 8 regras do §2.5. `ctx` é estrutural e mínimo (ids de itens com `en` normalizado e nível, unidades em ordem, habilidades por unidade, nomes de cenas), então a função continua pura e testável sem carregar conteúdo.
- `collectionIssues`, `deckIssues`, `planIssues` com as regras do §2.6 (incluindo 20% de B1+ por coleção).
- `parseBold(text)` em `src/domain/mindmap/richText.ts` (puro), usado pela regra de `**` em pares e, na Fase 3, pela vista.
- Testes: um caso válido e **um caso inválido por regra**, com a mensagem conferida. Exemplos: 7 ramos; 26 cartões; cor repetida; `**` sem par; `art` inexistente; linha `en` igual a item ("use ref"); 3 `ref`; `skillId` de outra unidade; dois mapas com o mesmo `skillId`; `quiz` com duas lacunas ou padrão vazio; expressão `giria` sem `avoidWhen`; frase de coleção sem `situation`; 3 de 10 itens B1; plano com 29 dias ou dia repetido.

### 4. `feat: extend manifest and loaders for banks and maps`

Arquivos: `src/content/buildManifest.ts`, `manifest.generated.ts`, `knownWords.generated.ts`, `loader.ts` (+ testes), `manifest.test.ts`, `scripts/validate-content.ts`, `src/features/mindmap/art.ts`, `scripts/check-prod-bundle.ts`, `src/stores/usePractice.ts` (só `manifestItemIds`).

- Manifesto com `banks`, `maps`, `collections`, `decks`, `plans` (§2.7). `validate:content` valida todas as pastas, roda os `*Issues` e regenera o manifesto. Pastas vazias são válidas.
- `createJsonLoader(glob, schema, issues)`; `loadMap`, `loadBank`, `loadCollections`, `loadPlan`, `loadItems(itemIds)` com cache e `ContentLoadError`. `loadItemIndex` fica como fachada de `loadItems` até a Fase 4, se ainda tiver chamadores.
- `manifestItemIds()` inclui os bancos. Cartas do aluno entram na Fase 4.
- `knownWords` inclui textos dos bancos.
- `art.ts`: mapa nome → URL das cenas (§12.3), sem nenhum importador no caminho inicial.
- `check-prod-bundle`: falha se algum JSON de `banks/`, `mindmaps/`, `plans/` ou `collections.json`, alguma cena ou `data:image/svg+xml` estiver no JS inicial.
- Testes: `manifest.test.ts` diverge → vermelho; `loadItems(['fr-001','u1-hi'])` importa só `banks/frases.json` e a unidade 1 (glob mockado conta importações); mapa inválido rejeita com `ContentLoadError`; teste das regras de SVG do `ESTILO.md` (§12.3) sobre `src/content/art/` (passa vazio nesta etapa).

### 5. `feat: add dexie v2 tables with migration test`

Arquivos: `src/data/db.ts`, `src/data/models.ts`, `src/data/db.migration.test.ts` (novo), `src/data/events.ts`, `src/app/` (aviso de atualização), `src/i18n/pt-BR.ts`, `e2e/migration.spec.ts` (novo).

- `version(2).stores({ userCards: 'id, updatedAt', mapProgress: 'mapId', planProgress: 'planId' })`, sem `upgrade()`. Comentário no `db.ts` explicando por que não há `upgrade()`.
- `userCardSchema` (com `NO_PATTERN_CHARS`), `mapProgressSchema`, `planProgressSchema`. `LessonResult.kind` + `'cards' | 'map'`; `context?`; `DailyStats.cards?`.
- `db.on('versionchange')` fecha a conexão e emite um evento; `blocked` idem. Um aviso (`role="alert"`, texto em `pt-BR.ts`) pede para recarregar. Nada de erro solto na tela.
- **`db.migration.test.ts`** (obrigatório):
  1. abre um banco com a definição **v1 congelada no próprio teste** (cópia literal do `stores()` de hoje, não importada do código);
  2. grava ao menos uma linha de cada tabela v1: perfil, configurações, `lessonProgress`, `results` (cada `kind` v1), `srs`, `daily` (com e sem `goalMet`), `achievements` e `quarantine`;
  3. fecha, abre com `FalaeDb` (v2) e confere **linha por linha** (`toEqual`) que nada mudou; `userCards`, `mapProgress` e `planProgress` existem e estão vazias; `db.verno === 2`;
  4. lê tudo pelo `DexieRepository` (perfil e configurações válidos, sem nada novo em `quarantine`);
  5. faz `exportAll` → `importAll` em v2 e compara o conteúdo.
- Teste de `versionchange`: com `fake-indexeddb`, uma conexão v1 aberta recebe o evento quando a v2 abre; o handler fecha a conexão e emite o aviso.
- `e2e/migration.spec.ts` (Chromium): antes do app carregar, `page.addInitScript`/`indexedDB.open('falae', 10)` cria o banco no formato físico v1 com progresso (o Dexie multiplica a versão por 10), carrega o app e confere trilha, XP e ofensiva iguais; um gancho novo `window.__falae.exportForTest()` (em `src/dev/testHooks.ts`, só no build de teste) mostra as tabelas novas vazias.

### 6. `feat: export schema v2 reading v1 backups`

Arquivos: `src/data/models.ts`, `src/data/exportImport.ts` (+ testes), `src/features/settings/BackupSection.tsx` (resumo), `src/i18n/pt-BR.ts`, `src/test/fixtures/backup-v1.json` (novo).

- `EXPORT_SCHEMA_VERSION = 2`; `parseExportFile` aceita `1 | 2`; `upgradeExportV1` (puro) promove v1 com as tabelas novas vazias; acima de 2 continua `newerVersion`.
- `ImportSummary` com `userCards` e `mapsStudied`; aviso "Este arquivo não tem suas cartas; elas serão apagadas" quando o banco atual tem cartas do aluno e o arquivo não tem.
- `backup-v1.json`: **exportado pelo app atual** (`main` antes desta fase), com progresso real de algumas lições, e nunca editado à mão. Fica congelado no repositório como contrato.
- Testes: o v1 real importa e preserva tudo (comparação tabela a tabela); o v2 faz ida e volta idêntica; v2 com `userCards` inválida, `kind` desconhecido ou `mapProgress` sem `mapId` é rejeitado **sem tocar no banco** (estado antes = depois); arquivo `schemaVersion: 3` dá `newerVersion`; o aviso de cartas aparece só no caso certo.

### 7. `feat: extend repository and commit for cards and maps`

Arquivos: `src/data/repository.ts`, `src/data/dexieRepository.ts` (+ teste novo `dexieRepository.mapsCards.test.ts`), `src/stores/useProfile.ts` (`apply`), `src/domain/gamification/xp.ts`, `src/domain/gamification/achievements.ts` (+ testes).

- `listUserCards`, `saveUserCard` (valida, limite 500), `deleteUserCard` (carta + `SrsCard` na mesma transação), `getMapProgress`, `getPlanProgress`, `savePlanProgress`.
- Commit: a transação inclui `mapProgress`; upsert quando `context.mapId` e `kind ∈ {map, practice}`; `daily.cards` soma as cartas distintas em `kind === 'cards'`; `lessonProgress` continua só em `lesson`/`review`.
- `CommitContext.mapProgress?` e `AppliedCommit.xp?`. O repositório grava `result.xp` e o `daily` com o XP final.
- XP (puro, `xp.ts`): `cards` = fórmula do Praticar com mínimo de 5 cartas; `map` = 5 no primeiro estudo do mapa no dia e 0 depois (decisão 6). Nenhuma tela grava esses `kind` ainda, mas a regra já fica testada.
- **Auditoria de `kind`**: todo `kind ===`/`!==` do código revisto e listado no PR. Hoje: `xp.ts`, `achievements.ts` (`perfect-lesson` não acende com `cards`/`map`), `useProfile.ts` (corações só em `practice`), `engine.ts` (`usesHearts`), `dexieRepository.ts`. Onde der, usar `switch` exaustivo com `never`.
- Testes: os 6 métodos; limite 500; `deleteUserCard` não deixa `SrsCard` órfão; commit `map` duas vezes no mesmo dia = 5 + 0 XP, com `timesStudied` 2; `map` em outro dia = 5 de novo; `cards` soma `daily.cards`; `practice` com `mapId` faz upsert e dá +1 coração; `cards`/`map` contam para ofensiva e meta e não mexem em corações; `perfect-lesson` não acende; dois commits concorrentes de `map` (duas abas) somam certo (ADR-008).

### 8. `feat: add notebook design tokens`

Arquivos: `src/styles/tokens.css`, `src/styles/tokens.test.ts`, tema do Tailwind.

- Tokens do §8 com os valores do `styles.css` do protótipo (claro e escuro): papel, pautas, marca-texto, post-it kraft, ✗/✓ e as 5 variantes por cor de ramo, incluindo **Jabuticaba**.
- `tokens.test.ts` confere os pares de texto (≥ 4,5:1) e de traço (≥ 3:1) de `GRAMATICA-VISUAL.md` §2 e §8, nos dois temas. Pautas e pontos ficam fora (textura).
- Sem uso em tela ainda. A fonte Patrick Hand entra na Fase 3, junto com a primeira tela que a usa (evita dependência sem uso).

### 9. `chore: add map and card agents and skills` (agente principal)

Arquivos em `.claude/` e `CLAUDE.md` (fora do alcance do arquiteto; aqui só a especificação). Enxuto:

- **Criar** `designer-de-mapas` (`sonnet`): dono do `ESTILO.md`, das cenas e da aprovação visual de mapas, cartas e PDFs. **Criar** `pedagogo` (`sonnet`): progressão, sobreposição entre mapas, convenção de pronúncia, `kind` dos mapas e B1 ≤ 20%.
- **Criar** as skills `criar-mapa-mental` (formato do §2.5, limites, `ref`, cenas com o `ESTILO.md`), `revisar-mapa-mental` (checklist do revisor e do pedagogo) e `criar-baralho` (bancos e coleções, convenção de pronúncia do `conteudo/LEIA-ME.md` do protótipo).
- **Atualizar** `autor-de-conteudo` e `revisor-linguistico` para conhecerem bancos, mapas e coleções, e `criar-licao` para o `level` da unidade.
- Ficam para quando forem usadas: `exportar-para-impressao` (Fase 7) e os ajustes em `revisor-ux`, `qa-tester`, `desenvolvedor` e `novo-tipo-de-exercicio` (Fases 3 e 4).
- `CLAUDE.md`: novos agentes, ciclo de conteúdo `autor-de-conteudo` → `revisor-linguistico` + `pedagogo` e a regra "conteúdo novo de mapas e cartas só em `src/content/`; `prototipo/` congelado".

### 10. `content: port approved prototype maps and cards`

Arquivos: `scripts/port-prototype.ts` (descartável), `src/content/banks/{frases,phrasal,expressoes,falsos-cognatos,extra-a1,extra-a2}.json`, `src/content/mindmaps/mm-*.json` (6), `src/content/collections.json`, `src/content/decks.json` (`[]`), `src/content/art/*.svg` (65), `manifest.generated.ts`, `knownWords.generated.ts`.

- O script aplica o mapeamento do §12 e gera um **relatório** (no terminal, fora do repositório) com:
  - linhas trocadas por `ref` em que o `pt` do protótipo difere do item;
  - linhas de vocabulário sem item;
  - mapas com menos de 4 `ref`;
  - `falseFriend` sem texto;
  - `difficulty` atribuída por nível.
- O `autor-de-conteudo` resolve o relatório: cria os itens que faltam (`extra-a1`/`extra-a2`, com `example`, `difficulty` e `pt`), decide `hint` e confere o `kind` dos mapas com o pedagogo.
- As 65 cenas são copiadas sem alteração de desenho. O teste de regras SVG da etapa 4 passa a cobrir as cenas reais.
- `npm run validate:content` verde, sem avisos não justificados.
- **Portão de conteúdo**: `revisor-linguistico` + `pedagogo` em paralelo, revisando **só o que mudou em relação ao protótipo aprovado** (itens novos, `hint`, divisão de `topic`/`situation`, textos trocados pelo do item, `difficulty`, `kind`) → correção → reconfirmação. O `designer-de-mapas` confere que as 65 cenas chegaram íntegras (folha de contato gerada a partir de `src/content/art/`).
- Commit seguinte (`chore: remove prototype port script`) apaga o script.

## Testes exigidos (resumo)

| Área               | Teste                                                                                                         |
| ------------------ | ------------------------------------------------------------------------------------------------------------- |
| Schemas            | válido + 1 inválido por regra (§2.2–2.6), mensagens conferidas                                                |
| Manifesto/loader   | coerência; carregamento só do que é pedido; erro tipado; nada novo no JS inicial (`check-prod-bundle`)        |
| Cenas              | regras do `ESTILO.md` em todo `src/content/art/*.svg`; `art` inexistente reprovado no `validate:content`      |
| **Migração Dexie** | `db.migration.test.ts` v1 congelada → v2, linha por linha, tabelas novas vazias, export/import em v2          |
| Abas antigas       | `versionchange`/`blocked` fecham a conexão e mostram o aviso                                                  |
| **Backup v1**      | `backup-v1.json` real importa e preserva tudo; v2 ida e volta; v2 inválido não toca no banco; v3 recusado     |
| Repositório/commit | métodos novos, limite 500, sem `SrsCard` órfão, `mapProgress`, `daily.cards`, XP do mapa 1×/dia, concorrência |
| E2E                | `migration.spec.ts` (banco v1 físico → app v2 sem perda); toda a suíte E2E atual continua verde               |
| Conteúdo real      | `realContent.test.ts` cobre bancos, mapas e coleções portados                                                 |

## Critérios de aceite

- `npm run lint`, `typecheck`, `test`, `e2e`, `validate:content` e `build` verdes.
- Um banco v1 com progresso abre em v2 sem perder nenhuma linha (teste de unidade e E2E), e um backup v1 real importa sem perdas.
- `EXPORT_SCHEMA_VERSION` = 2; um arquivo v2 inválido não altera nada.
- Aba antiga recebe o aviso de atualização em vez de erro.
- Os 6 mapas e os 60 itens do protótipo validam no formato do app, cada mapa com ≥ 4 `ref`; as 65 cenas estão em `src/content/art/` e passam nas regras do `ESTILO.md`.
- JS inicial dentro do ADR-013 (≤ 260 kB gzip), sem JSON novo nem cena no caminho inicial.
- Nenhuma mudança visível para o aluno, exceto o aviso de atualização em abas antigas e o resumo de import.
- `domain` continua sem importar React, Dexie ou `content`.
- Revisores sem bloqueantes.

## Portões

| Etapas      | Revisão                                                                                                                                                                          |
| ----------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2–4, 8      | `revisor-de-codigo` + `qa-tester` (paralelo)                                                                                                                                     |
| **5, 6, 7** | `revisor-de-codigo` com **`model: opus`** (dados persistidos: migração, backup, commit) + `qa-tester` (paralelo). O revisor roda o teste de migração e o de backup v1 localmente |
| 5           | também `revisor-ux`: captura do aviso de atualização (390×844 e desktop, claro e escuro)                                                                                         |
| 9           | o usuário vê o diff de `CLAUDE.md`/`.claude/` no commit                                                                                                                          |
| 10          | `revisor-linguistico` + `pedagogo` → correção → reconfirmação; `designer-de-mapas` (cenas); `revisor-de-codigo` só no script do port                                             |

Nenhuma etapa avança com bloqueante. Commit ao fim de cada etapa aprovada.

## Fora desta fase

- Qualquer tela nova: aba Mapas, visualizador, hub do Praticar, sessão de cartas, editor de carta (Fases 3 e 4).
- `@fontsource/patrick-hand` e ícones desenhados (Fase 3).
- `Quality` 1–5, `flashcard`, `select`, `session`, `decks`, `isMistake` (Fase 4).
- Contadores do `CommitContext` para conquistas e as 5 conquistas novas (Fase 6).
- Conteúdo novo além do port: mapas de habilidade, frases, phrasal, expressões, falsos cognatos 2 e 3, "30 dias com o Tuca" (Fase 5). A auditoria de `acceptedEn`/`acceptedPt` dos itens portados também é da Fase 5 (Lote A).
- Impressão (Fase 7).
- Vista radial, pan/zoom, `d3-hierarchy` e exportação PNG: **fora do escopo** do recurso (decisão 9 revista em 2026-11-03).
- Ilustrações das cartas (trabalho futuro).

## Pendências para a Fase 3

Registradas na etapa 4 (não há `FASE-3.md` ainda; mover para lá quando o plano for escrito):

- A tela que mostra cenas trata `artUrl(nome)` igual a `undefined` (cena ausente ou renomeada): não renderiza o `<img>` e não quebra o cartão. O `validate:content` já reprova `art` inexistente, mas a tela não deve depender disso.
- O primeiro importador de `src/features/mindmap/art.ts` tem de ser uma rota lazy; o `check-prod-bundle` falha se o mapa de cenas ou uma cena chegar ao JS inicial.
- Na etapa 10 (port das 65 cenas), conferir no `dist/assets/` que cada cena virou um arquivo `.svg` próprio (efeito do `?no-inline`) e que nenhuma foi embutida como `data:image/svg+xml`.
