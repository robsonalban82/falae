# Decisões de arquitetura

Formato: contexto → decisão → consequências. Status: proposta · aceita · substituída.

## ADR-001 — Exercícios escritos à mão nas lições; gerados na prática (proposta)

**Contexto:** 48 lições × ~12 exercícios. Gerar tudo automaticamente reduz trabalho, mas piora a qualidade pedagógica e dificulta a revisão linguística.
**Decisão:** lições da trilha têm exercícios explícitos no JSON (revisáveis um a um). A tela Praticar e a revisão espaçada geram exercícios a partir de `vocab`/`sentences`.
**Consequências:** JSON maior; o revisor-linguistico revisa exatamente o que o aluno vê; o gerador precisa de testes próprios.

## ADR-002 — SM-2 adaptado em vez de FSRS (proposta)

**Contexto:** FSRS é mais preciso, mas precisa de parâmetros treinados e é mais difícil de testar e explicar.
**Decisão:** SM-2 com notas derivadas do desempenho na sessão (§7 da arquitetura), isolado em `src/domain/srs/` atrás de uma função `review(card, q, today)`.
**Consequências:** simples e testável; trocar por FSRS depois não afeta o resto do app.

## ADR-003 — Sons sintetizados com Web Audio (proposta)

**Contexto:** sons precisam ser originais e livres de direitos, e funcionar offline.
**Decisão:** gerar sons curtos por osciladores em tempo real.
**Consequências:** zero arquivos de áudio; sem risco de direitos; timbre mais "sintético" (aceitável para feedback curto).

## ADR-004 — Padrões compactos para respostas aceitas (proposta)

**Contexto:** listar todas as variações de uma tradução explode o JSON e gera esquecimentos.
**Decisão:** sintaxe `(opcional)` e `[a|b]`, expandida na carga (limite 64 por padrão); contrações, acentos, maiúsculas, pontuação e números são tratados pelo normalizador.
**Consequências:** conteúdo mais enxuto e completo; o validador precisa checar a expansão.

## ADR-005 — Conteúdo com objetos estritos (aceita, Fase 2)

**Contexto:** o QA mostrou que uma chave digitada errada (`acceptedPT`) era descartada em silêncio, sumindo com respostas aceitas.
**Decisão:** todo o schema de conteúdo usa `z.strictObject`; chaves desconhecidas são erro de validação. Padrões que não geram nenhuma resposta também são erro.
**Consequências:** o autor descobre erros de digitação no `validate:content`; adicionar campo novo ao conteúdo exige atualizar o schema primeiro.

## ADR-006 — Repository valida toda escrita e põe dados corrompidos em quarentena (aceita, Fase 2)

**Contexto:** um bug de domínio poderia gravar dados que o próprio export depois rejeitaria; um registro inválido era trocado pelo padrão sem aviso.
**Decisão:** `DexieRepository` valida com Zod toda escrita e todo import; registros inválidos de `profile`/`settings` vão para a tabela `quarantine` (v1) antes do fallback. `recordLessonResult` recebe um `LessonOutcome` completo e grava tudo numa transação.
**Consequências:** backup sempre restaurável; leitura de profile/settings pode escrever (não chamar dentro de transação read-only).

## ADR-007 — Contrações com uma leitura só (aceita, Fase 3)

**Contexto:** a §5 previa duas leituras para `'s`/`'d` (is/has, would/had).
**Decisão:** no A1 só usamos `he's = he is` e `I'd = I would`; formas sem apóstrofo (`im`, `dont`, `cant`…) também são expandidas, exceto as que são palavras reais (`its`, `were`, `well`, `ill`, `wont`…).
**Consequências:** "He's got" ≠ "He has got" até um conteúdo A2 precisar; respostas digitadas no celular sem apóstrofo são aceitas.

## ADR-008 — Regras do fim de lição rodam dentro da transação (aceita, Fase 5)

**Contexto:** a store montava o profile novo fora da transação; duas abas (ou uma store desatualizada) sobrescreviam ofensiva, XP e corações, e conquistas tinham `unlockedAt` regravado.
**Decisão:** `LessonOutcome.apply(ctx)` é uma função pura executada pelo repositório dentro da transação, sobre profile, conquistas, daily, progresso e cards relidos do banco. Conquista já liberada nunca é regravada.
**Consequências:** commits concorrentes somam; a interface do `Repository` ganhou genérico `CommitResult<M>` (sem mudança de dados persistidos).

## ADR-009 — Relógio que volta não celebra meta (aceita, Fase 5)

**Contexto:** com o relógio/fuso voltando para um dia anterior, `lastGoalCelebratedDay` (um só dia) deixava celebrar de novo e marcar `goalMet` num dia "do passado".
**Decisão:** quando `today < streak.lastActiveDay` ou `today < lastGoalCelebratedDay`, a meta não é celebrada e o dia não ganha `goalMet` novo. O XP continua contando (total, daily e congelamento).
**Consequências:** nenhuma celebração/conquista `goal-7` é inflada por mexer no relógio; quem viaja para oeste perde no máximo uma celebração.

## ADR-010 — Conquista "persistente" derivada, sem campo novo (aceita, Fase 6)

**Contexto:** "voltou após perder todos os corações" exigiria lembrar que os corações zeraram, o que não existe no `Profile`.
**Decisão:** `persistent` acende quando uma **prática** é concluída com 0 corações (após recarga preguiçosa) no início do commit, calculado dentro do `apply` (ADR-008). Lição normal nunca termina com 0 corações, então isso corresponde ao fluxo "Praticar e ganhar coração".
**Consequências:** sem mudança de schema nem de backup; quem zera e só espera a recarga não ganha a conquista. Alternativa fiel (`Profile.heartsDepletedAt?`) recusada pelo usuário nesta fase.

## ADR-011 — Praticar com itens de reserva e commit sem varrer tabelas (aceita, Fase 6)

**Contexto:** o aluno pode zerar os corações na primeira lição sem ter nenhum card SRS, e o botão "Praticar e ganhar coração" ficaria sem conteúdo. Além disso, o commit montava Sets lendo `daily`, `srs` e `lessonProgress` inteiros.
**Decisão:** com menos de 4 itens elegíveis, o Praticar completa com os itens da lição atual da trilha. O `CommitContext` passa a receber contagens (`goalMetCount`, `wordsLearnedBefore`), ids de lições concluídas e só os cards dos itens da sessão; `results` nunca é lido no commit. Booleano não é indexável no IndexedDB, por isso não há índice novo.
**Consequências:** Praticar sempre funciona; commit com custo proporcional a tabelas limitadas; mudança só de interface (Dexie v1, backup v1).

## ADR-012 — Conteúdo carregado por unidade com manifesto leve (aceita, Fase 7)

**Contexto:** `loader.ts` importa todos os JSON de unidade com `eager: true`, e o bundle principal passa de ~930 kB, o que ameaça a meta de Lighthouse ≥ 90 no celular.
**Decisão:** glob lazy por unidade; `src/content/manifest.ts` (gerado/conferido pelo `validate:content`, com teste de coerência) traz só ids, títulos, ordem e contagens para a trilha. `loadUnit(id)` importa e valida com Zod sob demanda, com cache em memória. O service worker continua fazendo precache de todos os chunks.
**Consequências:** interface do `loader` fica assíncrona (stores e telas ganham estado de carregamento); formato dos JSON, Dexie v1 e backup v1 inalterados; offline completo mantido após a primeira visita. Aprovada pelo usuário (2026-10-29): manifesto **gerado** pelo `npm run validate:content` (`src/content/manifest.generated.ts` e `knownWords.generated.ts`) e conferido por `manifest.test.ts`.

## ADR-013 — Orçamento do JS inicial total (aceita, Fase 7)

**Contexto:** com os vendors em chunks próprios (react, router, motion, dexie, zod), o chunk de entrada caiu para ~48 kB minificado, então o limite de 250 kB da entrada sozinho deixou de proteger o carregamento inicial.
**Decisão:** `scripts/check-prod-bundle.ts` também soma o JS inicial (entrada + `modulepreload` do `index.html`, qualquer `base`) e falha acima de **260 kB gzip**. Medido na Fase 7: 718 kB minificado / 226 kB gzip; Lighthouse mobile 100 em `/` e `/boas-vindas`. Mantidos: entrada ≤ 250 kB minificado, nenhum chunk > 300 kB, nenhum JSON de unidade no JS inicial.
**Consequências:** ~34 kB gzip de folga; nova dependência pesada no caminho inicial exige lazy loading ou rever este ADR. `npm run build:pages-check` confere o mesmo com `VITE_BASE=/falae/`.

## ADR-014 — Tuca em imagens por humor (aceita, pós-v1)

**Contexto:** o usuário redesenhou o Tuca fora do app (ilustração com contorno, preto e amarelo); o SVG animado em código não reproduz o estilo.
**Decisão:** um WebP 512×512 com fundo transparente por humor (`src/ui/Mascot/img/`, ~30–45 kB cada, carregado só onde o Tuca aparece); a animação passa a ser só do corpo inteiro (pulinho, balanço) e respeita `useReducedMotion()`. Tema escuro: halo claro via token `--tuca-glow`. Ícones do PWA e favicon gerados da mesma arte. Fontes 1024 px e scripts de recorte (`sharp`, rodado fora do projeto) em `docs/mascote/`; `scripts/make-icons.ts` removido.
**Consequências:** sem novas dependências no app; trocar a arte = substituir os WebP e rodar `docs/mascote/icons.mjs`. Fundo dos recortes removido por preenchimento a partir das bordas + sementes manuais para vãos fechados (ver `cut.mjs`).

## ADR-015 — Mapas mentais e cartas sobre um SRS único (aprovado em 2026-11-03)

**Contexto:** o recurso de mapas mentais e cartas (`docs/MAPAS-E-CARTAS.md`) poderia criar um segundo histórico de revisão e duplicar vocabulário em mapas e baralhos, além de exigir dados novos no IndexedDB e no backup.
**Decisão:** itens estudáveis existem só nas unidades ou em bancos (`src/content/banks/`). Mapas, coleções, baralhos e plano apenas referenciam `itemId`. Carta = item = um `SrsCard` (cartas do aluno com `uc-`). As notas Errei/Difícil/Bom/Fácil viram `q` 1/3/4/5 no mesmo SM-2. "Meus erros" é derivado (`lapses ≥ 1 && reps < 2`). Dexie v2 só acrescenta tabelas (`userCards`, `mapProgress`, `planProgress`). `LessonResult` ganha os `kind` `cards`/`map` e `context?`, e `DailyStats` ganha `cards?`. O backup passa a `schemaVersion: 2` e lê v1. As sessões entram pelo `recordLessonResult` existente, e `AppliedCommit` ganha `xp?`.
**Consequências:** um só algoritmo e um só caminho de escrita. Exige teste de migração v1→v2, aviso de `versionchange` para abas antigas e aviso no import de arquivo v1 que apagaria cartas do aluno. Exige aprovação do usuário (modelo persistido e formato de conteúdo).

## ADR-016 — PDF pela impressão do navegador, sem biblioteca (aprovado em 2026-11-03)

**Contexto:** mapas, cartas (frente e verso) e apostilas precisam de PDF A4 offline. jsPDF/pdf-lib somam ~70–150 kB gzip, não desenham emojis e exigem fontes TTF embutidas.
**Decisão:** rotas `/imprimir/*` com páginas paginadas pelo app (mm fixos, `break-after: page`, números e sumário calculados em `domain/print/`), `@page` com margem zero e `window.print()`. PNG por SVG → canvas com fontes embutidas. Aceite no CI por `page.pdf()` do Playwright.
**Consequências:** 0 kB de dependência e texto vetorial. Depende de o usuário imprimir a 100%. A impressão no PWA do iOS precisa de teste em aparelho; se falhar, jsPDF lazy na rota de impressão (nova aprovação).
