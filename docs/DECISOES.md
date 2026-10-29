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
