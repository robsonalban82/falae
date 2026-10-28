# Fase 3 — Motor de lição

**Objetivo:** jogar uma lição inteira com os 7 tipos de exercício, corretor robusto, feedback imediato, repetição de erros, corações e tela de fim.

## Tarefas

1. `src/domain/grading/normalize.ts` — normalização PT/EN (§5): acentos, maiúsculas, pontuação, contrações, números 0–100 por extenso ↔ dígitos, hífens, horas `5:30`.
2. `src/domain/grading/grade.ts` — `gradeExercise(exercise, response, ctx)` para os 7 tipos, "quase certo" (1 erro de digitação em palavra ≥ 5 letras que não seja outra palavra conhecida), fala por LCS ≥ 80%. Cache das respostas aceitas expandidas por exercício.
3. `src/domain/lesson/engine.ts` — redutor puro: fila, reinserção única de errados, combo, corações, pular (`speak`), status `answering | feedback | finished | outOfHearts`, `summarize()` (XP, precisão, perfeita, duração, `itemOutcomes` com nota q do SRS).
4. `src/domain/gamification/hearts.ts` (recarga 1/4 h preguiçosa, perder coração) e `xp.ts` (§8).
5. `src/domain/lesson/fallbacks.ts` — sem TTS: `listen-type` → `translate-typing` equivalente; `speak` pulado se não suportado ou desativado por 1 h.
6. Serviços: `speech.ts` (TTS en-US normal/lenta; STT com alternativas), `sound.ts` (Web Audio), `haptics.ts`.
7. Componentes em `src/features/lesson/exercises/` + `exerciseRegistry.ts`; `LessonPlayer`, `FeedbackSheet`, `OutOfHearts`, `LessonComplete`; rota `/licao/:lessonId`; `useProfile` store.
8. Sessão salva em `sessionStorage` (recarregar não perde a lição).
9. Unidade **demo** só para dev/E2E (`src/dev/demoUnit.ts`, ativada com `VITE_DEMO=1`), para testar o motor antes do conteúdo real (Fase 4).

Fora desta fase: ofensiva (Fase 5), cards SRS (Fase 6) — o resultado já grava `itemOutcomes` para isso.

## Critérios de aceite

- Corretor com testes extensos (acentos, maiúsculas, pontuação, contrações _I'm/I am_, números, alternativas, quase certo, falsos positivos).
- Lição demo jogável do início ao fim no celular, por mouse/toque **e** só teclado.
- Errado volta no fim (uma vez); corações caem e persistem; 0 corações → tela "Sem corações".
- Feedback com `aria-live`, resposta correta e explicação.
- Fim de lição grava `LessonResult` + XP no perfil, atômico.
- lint, typecheck, test, e2e verdes; revisores sem bloqueantes/importantes.

## Pendências levadas para a Fase 5 (sugestões dos revisores)

- Destacar na lista a opção escolhida (✗) e a correta (✓) após verificar (múltipla escolha/lacuna).
- "Quase": ícone próprio e destaque da letra errada na resposta certa.
- Banco de palavras: contorno tracejado no lugar das peças usadas.
- Tuca pequeno no cartão de feedback; animação ao perder coração; números do contador.
- Revisar a recarga de corações (4 h por coração pode punir demais) — decisão do usuário.
- Tempo até o próximo coração atualizando ao vivo; botão "Praticar e ganhar coração" (Fase 6).
- TTS: checar voz inglesa (`voiceschanged`); "quase" em números por extenso; code-splitting da rota de lição.
