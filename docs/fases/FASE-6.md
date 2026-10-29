# Fase 6 — Repetição espaçada, Praticar, perfil, ajustes, exportar/importar, lembretes, onboarding e nivelamento

**Objetivo:** cada lição concluída alimenta o SRS na mesma transação; o aluno pratica itens vencidos em `/praticar` (sem corações, +1 coração ao concluir, inclusive a partir da tela "Sem corações"); vê seu progresso em `/perfil`; controla som, vibração, meta, tema, lembrete, backup e redefinição em `/config`; e um usuário novo passa por `/boas-vindas` e, se quiser, pelo `/nivelamento`.

**Sem mudança no modelo persistido** (proposta padrão). Dexie continua na versão 1 e `EXPORT_SCHEMA_VERSION` continua 1. Mudam apenas **interfaces** (`CommitContext`, `AppliedCommit`, `Repository.updateProfile`). A única opção que mexeria no schema (conquista "persistente" fiel) está em "Decisões que precisam do usuário", com a alternativa sem schema já especificada e adotada por padrão.

## Decisões desta fase

- **SRS roda dentro da transação** (ADR-008): `apply(ctx)` recebe os cards dos itens da sessão relidos do banco e devolve os cards novos; o repositório grava. A store nunca grava cards por fora (`upsertSrsCards` fica só para testes/helpers).
- **Praticar é uma sessão própria** em `/praticar/sessao` (tela cheia, reaproveita `LessonPlayer` com `kind: 'practice'`), não uma lição do conteúdo. `lessonId = 'practice'`; `result.id = practice-<startedAt>`.
- **Itens de reserva no Praticar** (ADR-011): se houver menos de 4 itens elegíveis no SRS (ex.: aluno perdeu os 5 corações na primeira lição e ainda não tem cards), completa com os itens da lição atual da trilha. Garante que "Praticar e ganhar coração" sempre funcione.
- **Persistente** (ADR-010, proposta): derivado sem schema — "concluiu uma prática tendo 0 corações (após recarga) no início do commit".
- **Nivelamento usa exercícios escritos à mão** da unidade 1 (não gerados), coerente com ADR-001: é avaliação, precisa de exercícios revisados.
- **Onboarding para quem já usa o app**: perfis da Fase 5 têm `onboardingDone: false`. Regra derivada (sem migração): onboarding considerado feito se `onboardingDone || totalXp > 0 || lessonProgress.length > 0`; nesse caso não redireciona (e não grava nada só por abrir).
- **Contagens no commit sem novo índice**: IndexedDB não indexa booleanos, então `goalMet` não vira índice. O commit troca `Set` por contagens (`count()` sem materializar arrays) e nunca lê a tabela `results` (a única que cresce sem limite). Ver tarefa 9.

## Tarefas

### 1. SRS — `src/domain/srs/`

Arquivos: `src/domain/srs/sm2.ts`, `sm2.test.ts`, `src/domain/srs/selection.ts`, `selection.test.ts`.

```ts
// sm2.ts — tipo estrutural (igual a SrsCard de data/models, sem importar data/)
export type Card = {
  itemId: string;
  ease: number;
  intervalDays: number;
  reps: number;
  lapses: number;
  dueDay: DayKey;
  lastReviewDay: DayKey;
};
export type Quality = 1 | 2 | 4 | 5;
export const INITIAL_EASE = 2.5;
export const MIN_EASE = 1.3;
export const MAX_INTERVAL_DAYS = 180;
export const LEARNED_MIN_INTERVAL_DAYS = 3; // move de useProfile para cá

export function newCard(itemId: string, today: DayKey): Card; // ease 2.5, interval 0, reps 0, lapses 0, due = today
export function review(card: Card, q: number, today: DayKey): Card;
export function applyOutcomes(
  existing: readonly Card[],
  outcomes: readonly { itemId: string; q: number }[],
  today: DayKey,
): Card[]; // devolve SÓ os cards alterados/criados
export function seedTestedOut(
  existing: readonly Card[],
  itemIds: readonly string[],
  today: DayKey,
): Card[];
export function isLearned(c: Card): boolean; // reps ≥ 1 && intervalDays ≥ 3
```

Regras exatas (`review`, §7):

- `q < 3`: `reps = 0`, `lapses + 1`, `interval = 1`.
- `q ≥ 3`: `reps + 1`; `interval = reps === 1 ? 1 : reps === 2 ? 3 : Math.round(interval * ease)` (com o `ease` **anterior** à atualização).
- `ease = max(1.3, ease + 0.1 − (5−q)·(0.08 + (5−q)·0.02))` sempre (inclusive com `q < 3`). Arredondar `ease` para 2 casas para não acumular ruído de ponto flutuante no backup.
- `interval = min(interval, 180)`; `dueDay = addDays(today, interval)`; `lastReviewDay = today`.
- `q` fora de `{1,2,4,5}` (0–5 aceito pelo schema): tratar por faixa (`< 3` falha, `≥ 3` sucesso); não lança.
- **Mesmo dia, segunda vez**: se `card.lastReviewDay === today` e `q ≥ 3`, o card **não** avança (evita refazer a mesma lição 3× e chegar a 3 dias de intervalo na hora); devolve o card sem mudança. Se `q < 3`, aplica a falha normalmente (errar de novo hoje é informação real).
- **Relógio voltou** (`today < card.lastReviewDay`): não altera o card.
- `applyOutcomes`: agrega `itemId` repetido pelo **menor** `q`; item sem card → `review(newCard(...), q, today)`; ordem de saída estável (ordem do primeiro aparecimento).
- `seedTestedOut` (nivelamento aprovado): para cada item **sem card**, cria `{ ease: 2.5, intervalDays: 3, reps: 2, lapses: 0, dueDay: today + 3, lastReviewDay: today }`. Card existente não é tocado (nunca rebaixa nem promove o que já existe). `reps: 2` faz a próxima revisão bem-sucedida seguir `round(3 × ease)`.

`selection.ts`:

```ts
export const PRACTICE_SIZE = 12;
export const PRACTICE_MIN_ITEMS = 4;
export function dueCount(cards: readonly Card[], today: DayKey): number; // dueDay ≤ today
export function wordsLearned(cards: readonly Card[]): number;
export function selectForPractice(
  cards: readonly Card[],
  today: DayKey,
  fallbackItemIds: readonly string[],
  knownItemIds: ReadonlySet<string>, // itens que existem no conteúdo atual
): string[]; // até PRACTICE_SIZE ids, sem repetição
```

- Elegível = card cujo `itemId ∈ knownItemIds` (card de item removido do conteúdo é ignorado, não apagado).
- Vencidos (`dueDay ≤ today`) ordenados por: mais atrasado (`dueDay` asc) → mais `lapses` → menor `ease` → `itemId` (desempate estável).
- Se vencidos < 4: completa com os não vencidos de menor `ease` (desempate: `dueDay` asc, `itemId`) até 4… e segue até `PRACTICE_SIZE` só com vencidos (não força 12 itens: o gerador repete itens em tipos diferentes).
- Se ainda < 4: completa com `fallbackItemIds` (filtrados por `knownItemIds`, sem duplicar).
- Resultado vazio é possível (curso vazio); a tela trata.
- Testes: tabela de `review` (q 5/4/2/1 em reps 0, 1, 2, 5), piso de `ease` 1,3, teto 180, mesmo dia, relógio voltando, agregação por menor `q`, `seedTestedOut` sem sobrescrever, seleção (ordem, < 4 vencidos, sem cards + reserva, item desconhecido ignorado).

### 2. Gerador do Praticar — `src/domain/practice/generate.ts`

Arquivos: `src/domain/random.ts` (+ teste), `src/domain/practice/generate.ts`, `generate.test.ts`.

```ts
// random.ts
export function seededRandom(seed: number): () => number; // mulberry32, [0, 1)
export function shuffle<T>(items: readonly T[], rand: () => number): T[];

// generate.ts
export type PracticeItem = {
  id: string;
  kind: 'vocab' | 'sentence';
  en: string; // padrões (x)/[a|b] permitidos, como no conteúdo
  pt: string[]; // pt[0] = principal (sentence: [pt])
  acceptedPt?: string[];
  acceptedEn?: string[];
  emoji?: string;
};
export function generatePractice(input: {
  items: readonly PracticeItem[]; // selecionados, na ordem de prioridade
  distractorPool: readonly PracticeItem[]; // itens da(s) unidade(s) desbloqueada(s)
  caps: Capabilities; // de domain/lesson/fallbacks
  seed: number;
}): Exercise[]; // Exercise = tipo inferido do schema de conteúdo (import type, como engine.ts)
```

Regras:

- **Determinístico**: mesma entrada + mesmo `seed` → saída idêntica (teste com `toEqual`). Única fonte de aleatoriedade é `seededRandom(seed)`; nada de `Math.random`.
- **Tamanho**: exatamente 12 exercícios se `items.length ≥ 1`; `[]` se vazio.
- **Plano de tipos** (12 posições), montado e depois embaralhado com o seed, sem dois `match-pairs` e evitando o mesmo tipo 3× seguidas:
  - 1 `match-pairs` com 4 pares vocab (dos itens + pool) — se houver < 4 vocab distintos, vira `multiple-choice`;
  - 3 `multiple-choice` (prompt PT → opções EN, ou o contrário alternando; 4 opções; distratores do mesmo `kind` do pool, nunca iguais à resposta após `normalize`);
  - 3 `word-bank` (só `sentence`; resposta EN tokenizada + 2–4 distratores de outras frases do pool; sem frase disponível → `translate-typing`);
  - 3 `translate-typing` (PT→EN com `accepted = [en, ...acceptedEn]`, ou EN→PT com `[...pt, ...acceptedPt]`, alternando);
  - 2 `listen-type` (`textEn = en` sem padrões — só itens cujo `en` não contém `(`/`[`); **sem TTS** → vira `translate-typing` EN→PT do mesmo item (mesma regra de `applyFallbacks`).
  - **Nunca** gera `speak` nem `fill-blank` (fill-blank precisa de lacuna escolhida por autor).
- **Distribuição dos itens**: itens percorridos em rodízio na ordem recebida, cada item no máximo 3 vezes e nunca no mesmo tipo duas vezes; poucos itens (ex.: 4) repetem em tipos diferentes.
- **Distratores**: só do `distractorPool` (nunca de unidade bloqueada); pool pequeno → menos opções, mínimo 2 (se não der 2, troca o exercício por `translate-typing`).
- **Ids**: `practice-<seed>-<posição>`; `itemIds: [item.id]` (pares: todos os ids), para o motor gerar `itemOutcomes`.
- **Validade**: todo exercício gerado passa em `exerciseSchema` (teste roda o schema em 200 seeds com o conteúdo real) e é corrigível: as respostas aceitas do item (`pt`/`acceptedPt`/`en`/`acceptedEn`, com padrões) são aceitas por `gradeExercise` (teste por amostragem).
- A store monta `PracticeItem` a partir do índice do `loader` (expansão de padrões continua sendo do `loader`/`grading`, não do gerador).

### 3. Tela Praticar — `/praticar` e `/praticar/sessao`

Arquivos: `src/features/practice/PracticeScreen.tsx`, `PracticeSession.tsx`, `src/stores/usePractice.ts` (novo), `src/features/lesson/sessionStore.ts`, `src/features/lesson/OutOfHearts.tsx`, `src/features/lesson/LessonComplete.tsx`, `src/app/routes.ts` (`practiceSession: '/praticar/sessao'`), `src/app/router.tsx`, `src/i18n/pt-BR.ts`.

- `/praticar`: Tuca `encouraging`; "Você tem **N** itens para revisar hoje" (`dueCount`) ou "Nada vencido — pratique para reforçar" quando 0; botão "Começar a praticar". Sem nenhum item possível (curso vazio) → botão desabilitado com explicação. Não mostra corações (Praticar não gasta).
- Iniciar: `seed = clock.now()`; seleciona (`selectForPractice` com reserva = itens da `currentLessonId` da trilha; curso concluído → itens da última revisão); gera; aplica `applyFallbacks` (gerador já não gera `speak`, mas o filtro é idempotente); `startLesson({ kind: 'practice', lessonId: 'practice', ... })`. A sessão (incluindo os exercícios gerados) vai para o `sessionStorage` com a mesma chave/formato das lições → recarregar mantém **os mesmos** exercícios.
- `PracticeSession` reaproveita `LessonPlayer`; `usesHearts` já é `false` para `practice` no motor. Fechar pede confirmação; abandonar não dá coração nem XP.
- **Commit** (`commitLesson` com `kind: 'practice'`): XP 8 (+5 perfeita, +combo) já em `sessionXp`; conta ofensiva e meta; não grava `lessonProgress`; SRS atualizado; dentro do `apply`: `refillHearts` → **depois** `gainHeart` (+1, teto 5; com 5 cheios não muda `heartsUpdatedAt`). `CommitSummary` ganha `heartGained: boolean` (false se já tinha 5).
- Tela de fim mostra "+1 coração" (ícone + texto, `aria-live` no resumo) quando `heartGained`. "Continuar" → `/praticar` se veio de `/praticar`; `/` se veio de "Sem corações".
- **OutOfHearts**: botão "Praticar e ganhar coração" navega para `/praticar/sessao?from=outOfHearts` (inicia direto, sem passar pela tela intermediária). A sessão da lição sem corações é **descartada** do `sessionStorage` ao sair (ao voltar, a lição recomeça com os corações atuais). "Esperar" continua igual.
- Rota `/praticar/sessao` aberta sem sessão salva e sem `from` → cria uma nova (mesmo fluxo do botão).
- Casos de borda: duas abas praticando → dois `result.id` diferentes, os dois somam (ADR-008); clock simulado avança dias no meio → `today` é lido no commit (o dia do resultado é o do fim, como nas lições).

### 4. Fim da lição + SRS (orquestração)

Arquivos: `src/data/repository.ts`, `src/data/dexieRepository.ts`, `src/stores/useProfile.ts`, `src/domain/gamification/achievements.ts`, testes.

Mudança de **interface** (não de dados):

```ts
export type CommitContext = {
  profile: Profile;
  unlockedIds: ReadonlySet<string>;
  dailyBefore: DailyStats | undefined;
  completedLessonIds: ReadonlySet<string>; // só ids (era LessonProgress[])
  goalMetCount: number; // era goalMetDays: Set — dias com goalMet, sem contar result.day
  goalMetToday: boolean; // dailyBefore?.goalMet ?? false
  /** Cards dos itemIds de result.itemOutcomes (bulkGet), já existentes. */
  srsCards: SrsCard[];
  /** isLearned em toda a tabela srs ANTES do commit (count via cursor, sem toArray). */
  wordsLearnedBefore: number;
};
export type AppliedCommit<M> = {
  profile: Profile;
  newAchievements: UnlockedAchievement[];
  srsCards: SrsCard[]; // NOVO: cards a gravar (substitui LessonOutcome.srsCards quando apply existe)
  meta: M;
};
```

- No `apply`: `srsCards = applyOutcomes(ctx.srsCards, result.itemOutcomes, today)` para `lesson`/`review`/`practice`; para `placement`, ver tarefa 7.
- `wordsLearned` depois = `wordsLearnedBefore − (aprendidos entre ctx.srsCards) + (aprendidos entre os cards novos)` — função pura `learnedAfter(before, oldCards, newCards)` em `srs/selection.ts`, testada.
- `goalDaysMet` = `goalMetCount + (goalMetToday || (!clockBack && xpAfter ≥ meta) ? 1 : 0)`.
- O repositório valida os `srsCards` devolvidos com Zod dentro da transação (rejeita = rollback de tudo).
- `LEARNED_MIN_INTERVAL_DAYS` sai de `useProfile` e passa a vir de `srs/sm2.ts`.
- Teste de integração (`fake-indexeddb`): lição com 3 itens cria 3 cards junto com resultado/profile/daily; repetir o commit não altera cards; erro de Zod num card não grava resultado nem profile; prática atualiza cards e dá +1 coração; conquista `words-50` acende quando o 50º card vira aprendido nessa transação.

### 5. Perfil — `/perfil`

Arquivos: `src/features/profile/ProfileScreen.tsx`, `StatsGrid.tsx`, `WeekChart.tsx`, `AchievementList.tsx`, `src/domain/stats/week.ts` (+ teste), `src/stores/useStats.ts` (novo), `src/i18n/pt-BR.ts`.

- Números: XP total (`profile.totalXp`), palavras aprendidas (`wordsLearned(getSrsCards())`), ofensiva atual (`displayStreak(...).value`, não `streak.current` cru), recorde (`streak.longest`), congelamentos (`freezes` de 2, com ícone de cristal).
- `week.ts`: `lastSevenDays(rows: DailyStats[], today, goal) → { day, xp, goalMet, weekdayIndex }[]` — sempre 7 entradas, de `today − 6` a `today`, dias sem linha = 0 XP; linhas fora do intervalo ignoradas. Dados via `getDailyStats(addDays(today,-6), today)` (usa índice, nunca lê tudo).
- `WeekChart` (SVG próprio, sem lib): 7 barras, altura proporcional a `max(maior xp da semana, meta)`, linha tracejada da meta; barra de hoje destacada; dia com meta batida tem ✓ acima (não só cor). Rótulos de dia da semana abreviados de `t.weekdays` (i18n, ordem calculada a partir do `dayKey`, não do `Date` do sistema dentro do componente — usar helper em `domain/time.ts` `weekday(dayKey)`).
  - Acessibilidade: `<figure>` com `<figcaption>`; o SVG é `aria-hidden` e há uma `<table class="sr-only">` com dia, XP e "meta batida" — leitor de tela lê a tabela, não 7 retângulos. Contraste das barras ≥ 3:1 com o fundo nos dois temas.
  - Semana toda zerada: barras mínimas de 2px + texto "Sem XP nesta semana ainda".
- Conquistas: grade com **todas** as de `achievements` (ordem da lista): obtidas = ícone colorido + título + data (`unlockedAt` formatado `dd/mm/aaaa`); bloqueadas = ícone esmaecido + cadeado + descrição do que falta (sem revelar números internos além do texto i18n). Cada item `<li>` com `aria-label` "Primeira lição, obtida em 12/10/2026" / "Sete dias seguidos, bloqueada". Conquista no banco com id desconhecido (backup de versão futura) é ignorada na grade.
- Carregamento: esqueleto; recarrega em `onLessonCommitted` e `onDataReplaced`.

### 6. Ajustes — `/config`

Arquivos: `src/features/settings/SettingsScreen.tsx`, `ReminderSection.tsx`, `BackupSection.tsx`, `ResetSection.tsx`, `ConfirmDialog.tsx` (em `src/ui/` se ainda não houver um genérico), `src/services/notifications.ts` (+ teste com `Notification` falso), `src/services/backup.ts` (download/leitura de arquivo), `src/data/exportImport.ts`, `src/stores/useSettings.ts`, `src/i18n/pt-BR.ts`.

Título e rótulo da navegação: "Ajustes" (`t.nav.settings`, já é esse texto).

- **Som / Vibração**: switches (`role="switch"`, `aria-checked`); ligar o som toca `correct` uma vez como amostra; vibração some (não só desabilita) se `navigator.vibrate` não existir, com texto "Seu aparelho não vibra pelo navegador".
- **Meta diária**: grupo de rádio 10/20/30/50 (`dailyGoalOptions`). Trocar não recalcula `goalMet` de dias passados (regra da Fase 5).
- **Tema**: rádio Sistema/Claro/Escuro; aplica na hora (classe `dark` no `<html>`), já existente no `useSettings` — só a UI é nova.
- **Lembrete** (`services/notifications.ts`):
  - `isSupported()` = `'Notification' in window && 'serviceWorker' in navigator`. Sem suporte → seção mostra só o aviso "Seu navegador não permite lembretes".
  - Ativar o switch é a **única** ação que chama `Notification.requestPermission()` (nunca no carregamento, nunca no onboarding). `granted` → `reminder.enabled = true`; `denied`/`default` → switch volta a desligado e texto "Permissão negada. Você pode liberar nas configurações do navegador".
  - Permissão já `denied` → switch desabilitado com a explicação acima.
  - Horário: `<input type="time">` com rótulo; salva `HH:MM` (schema já valida).
  - Agendamento (melhor esforço): com o app aberto, `setTimeout` até o próximo horário (recalculado ao mudar o horário, ao voltar do segundo plano e na virada do dia); ao abrir o app depois do horário, se **não houve estudo hoje** (`daily` de hoje com `lessons = 0`) e ainda não notificou hoje, mostra a notificação via `registration.showNotification` (texto de `t.reminder`, ícone do app, `tag: 'falae-daily'` para não empilhar). "Já notificou hoje" fica em `localStorage` (`falae.reminder.lastShownDay`) — estado efêmero de dispositivo, não vai para o backup, não é modelo persistido.
  - Tudo baseado em `clock` (testável com clock simulado).
  - **Limitações (texto na tela, em `t.settings.reminderLimits`, e no README pelo desenvolvedor)**: sem Notification Triggers, o lembrete só aparece se o app (ou o service worker) estiver ativo; no iPhone, só funciona com o app instalado na tela inicial (iOS 16.4+); o sistema pode atrasar ou suprimir.
- **Exportar**: botão gera `falae-progresso-AAAA-MM-DD.json` (`dayKey(clock.now())`) com `repository.exportAll()`, `JSON.stringify(_, null, 2)`, download por `Blob` + `<a download>`; texto de sucesso em `aria-live`.
- **Importar**:
  1. `<input type="file" accept="application/json,.json">` (botão rotulado). Arquivo > 5 MB → erro sem ler.
  2. `parseExportFile(text) → { ok: true; file; summary } | { ok: false; reason: 'json' | 'notFalae' | 'newerVersion' | 'invalid'; issues?: string[] }` em `src/data/exportImport.ts` (puro, testado). `newerVersion` quando `app === 'falae'` e `schemaVersion > 1`.
  3. Resumo: XP total, ofensiva atual e recorde, lições concluídas, conquistas, data do backup (`exportedAt`). Comparação com o atual ("Seu progresso atual: 120 XP") para deixar claro que substitui.
  4. Diálogo de confirmação ("Substituir meu progresso"; foco inicial em **Cancelar**). Confirmar → `importAll` → `emitDataReplaced` (já existe) → stores recarregam → aviso "Progresso restaurado".
  5. Qualquer falha (parse, Zod, transação) → mensagem clara com até 3 issues; **nada** é alterado (teste: banco idêntico antes/depois).
  - Sessão de lição/prática em andamento no `sessionStorage` é descartada após importar.
- **Redefinir progresso** (confirmação dupla):
  1. Botão "Apagar todo o progresso" (estilo de perigo) → diálogo 1: explica o que se perde e oferece "Exportar antes" (atalho para o export).
  2. "Continuar" → diálogo 2: campo onde o aluno digita **APAGAR** (comparação sem acento/maiúsculas via `normalize`); botão final só habilita com o texto certo.
  3. `resetAll()` → **deve emitir `emitDataReplaced`** (hoje não emite — corrigir) → limpa `sessionStorage` da sessão e `falae.reminder.lastShownDay` → navega para `/boas-vindas`.
  - Redefinir apaga também `settings` (volta aos padrões) e a quarentena (ação explícita do usuário).
- Todos os diálogos: `role="dialog"` + `aria-modal`, foco preso, Esc = cancelar, foco volta ao botão de origem.

### 7. Boas-vindas e nivelamento

Arquivos: `src/features/onboarding/WelcomeScreen.tsx`, `src/features/placement/PlacementScreen.tsx`, `PlacementResult.tsx`, `src/domain/progression/placement.ts` (+ teste), `src/domain/lesson/engine.ts` (modo sem feedback), `src/app/OnboardingGate.tsx` (ou guarda no `AppLayout`), `src/data/repository.ts` + `dexieRepository.ts` (`updateProfile`), `src/stores/useProfile.ts`, `src/i18n/pt-BR.ts`.

**Repositório**: `updateProfile(mutate: (p: Profile) => Profile): Promise<Profile>` — lê (com quarentena), aplica, valida e grava numa transação. Usado por onboarding (e disponível para `spendHeart`, que hoje grava um profile possivelmente desatualizado; trocar é opcional nesta fase).

**Guarda de primeiro acesso**: rotas dentro do `AppLayout` (e `/licao`, `/praticar/sessao`) redirecionam para `/boas-vindas` (`replace`) quando, com profile e progresso carregados, `!onboardingDone && totalXp === 0 && lessonProgress.length === 0`. `/boas-vindas`, `/nivelamento` e `/dev/*` não são guardadas. Enquanto carrega, esqueleto (sem piscar a trilha).

**`/boas-vindas`** (tela cheia, 3 passos, um por vez, com "Voltar"):

1. Tuca `happy` se apresenta (texto curto i18n) → "Começar".
2. Meta diária (rádio 10/20/30/50, padrão 20, com descrição "Casual / Regular / Sério / Intenso" — textos novos no i18n) → "Continuar". Salva `settings.dailyGoalXp`.
3. "Sou iniciante" → `updateProfile({ onboardingDone: true })` → `/`. "Já sei um pouco — fazer teste de nível" → `/nivelamento`.

- Foco vai para o título de cada passo; passo anunciado ("Passo 2 de 3"). Nada de pedir notificação aqui.
- Usuário com onboarding já feito que abre `/boas-vindas` → redireciona para `/`.

**`/nivelamento`**:

```ts
// placement.ts
export const PLACEMENT_SIZE = 15;
export const PLACEMENT_PASS = 0.8;
export function pickPlacementExercises(
  unit: {
    skills: readonly { lessons: readonly { exercises: readonly Exercise[] }[] }[];
    reviewLesson: { exercises: readonly Exercise[] };
  },
  caps: Capabilities,
  seed: number,
): Exercise[];
export function placementScore(outcome: { correct: number; answered: number }): number; // correct/answered; answered 0 → 0
export function placementPassed(score: number): boolean; // score ≥ 0.8
```

- Seleção: depois de `applyFallbacks`, exclui `speak` e `listen-type` (avaliação sem depender de áudio); 1 exercício de cada uma das 12 lições + 3 da revisão, escolhidos com o seed e preferindo tipos diferentes entre vizinhos; ordem final = ordem das habilidades (fácil → difícil). Se faltar exercício elegível numa lição, pega outro da mesma habilidade; total < 15 só se a unidade não tiver o suficiente (teste com fixture).
- Motor: `kind: 'placement'` passa a ter `feedback: false` — `answer` registra o veredito e vai direto ao próximo (sem status `feedback`, sem reinserir erros, sem combo, sem corações). "Quase" conta como acerto. `skip` (não deveria ocorrer sem `speak`) sai do denominador.
- UI: barra de progresso "7 de 15"; botão "Confirmar" (não "Verificar"); nenhum som/vibração de certo/errado, nenhuma cor de acerto; botão "Sair do teste" com confirmação → `updateProfile({ onboardingDone: true })`, nada mais gravado → `/`.
- Fim: commit via `commitLesson` com `kind: 'placement'`, `lessonId: 'placement'`, XP 0. No `apply`:
  - `profile.placement = { score, skippedUnit1: passed }`, `onboardingDone = true`;
  - sem ofensiva, sem meta, sem celebração, `lastGoalCelebratedDay` intacto (já é assim para placement);
  - aprovado → `srsCards = seedTestedOut(ctx.srsCards, unit1ItemIds, today)` (todos os `vocab` + `sentences` da unidade 1; o repositório passa a carregar os cards de `outcome.extraItemIds ?? []` além dos `itemOutcomes` — campo opcional novo em `LessonOutcome`, só interface); reprovado → nenhum card (o aluno aprende nas lições);
  - **repositório não grava `daily`** para `placement` (hoje soma `lessons + 1`; corrigir para não aparecer no gráfico nem contar como estudo do dia — teste).
- Resultado (`PlacementResult`): "Você acertou 13 de 15". Aprovado: Tuca `celebrating`, "A unidade 1 foi marcada como testada; a unidade 2 está aberta". Reprovado: Tuca `encouraging`, "Vamos começar do início — você vai avançar rápido". Botão "Ir para a trilha". Só aqui aparecem acertos/erros (lista opcional com a resposta certa de cada erro; `lang="en"`).
- Refazer: `/nivelamento` com `profile.placement` já definido → redireciona para `/` (refazer fica fora do escopo).
- Trilha: unidade testada já é tratada por `computePathState` (Fase 5); nós com ✓ e coroa prata.

### 8. Conquista "persistente"

Arquivos: `src/domain/gamification/achievements.ts` (+ testes), `src/stores/useProfile.ts`, `src/i18n/pt-BR.ts`.

- **Padrão (sem schema)**: `AchievementStats.last` ganha `heartsBefore: number` = `refillHearts(ctx.profile, now).hearts` **antes** de aplicar ganho/perda do commit (calculado dentro do `apply`, sobre o profile relido). `persistent` ⇔ `last.kind === 'practice' && last.heartsBefore === 0`.
- Por que funciona: lição normal não termina com 0 corações (o motor vai para `outOfHearts`), então "0 corações ao concluir algo" só acontece numa prática feita depois de zerar — exatamente o fluxo "Praticar e ganhar coração". Ficar sem corações e esperar a recarga **não** conta (é o limite conhecido).
- Id estável `persistent`; título/descrição em `t.achievements.persistent`.
- Testes: prática com 0 → acende; prática com 1 → não; lição → não; 0 corações mas recarga de 4 h já passou (`heartsBefore = 1`) → não; já obtida → não repete.

### 9. Pendências

Arquivos: `src/data/dexieRepository.ts`, `src/styles/tokens.css`, `src/features/lesson/HeartsBadge.tsx`, `src/features/lesson/exercises/WordBank.tsx`, testes.

1. **Perfil corrompido no commit**: hoje `recordLessonResult` usa `defaultProfile` em silêncio e **sobrescreve** o registro inválido (perda de dados). Correção: incluir `db.quarantine` na transação; se `profileSchema.safeParse` falhar, `quarantine.add({ table: 'profile', raw, at, issues })` **na mesma transação**, depois segue com o padrão. Se a transação falhar, a quarentena também não é gravada (e o registro original continua lá). Teste: profile inválido + commit → quarentena tem o original, profile novo é o padrão + a lição; commit com Zod rejeitando → nem quarentena nem profile mudam.
2. **Contraste do contador de corações no tema escuro**: número com token de texto (`text-ink` ou variante `acerola` clara definida em `tokens.css` para o tema escuro) com contraste ≥ 4.5:1 sobre `bg-surface` escuro; ícone ≥ 3:1. Registrar os valores medidos no PR; `revisor-ux` confere nos screenshots escuros.
3. **Leitura do histórico a cada lição**: o commit deixa de fazer `daily.filter(...).toArray()`, `srs.toArray()` e `lessonProgress.toArray()` completos para montar Sets:
   - `goalMetCount` = `db.daily.filter(d => d.goalMet && d.day !== result.day).count()` (cursor, sem array; a tabela tem ≤ 1 linha por dia; booleano não é indexável no IndexedDB, por isso não há índice);
   - `wordsLearnedBefore` = `db.srs.filter(isLearned).count()` (tabela limitada ao nº de itens do curso);
   - `srsCards` = `db.srs.bulkGet(itemIds)` (só os da sessão);
   - `completedLessonIds` = `db.lessonProgress.toCollection().primaryKeys()` (só chaves; ≤ nº de lições);
   - **`results` nunca é lido no commit** além do `get(id)` de idempotência. Teste: espionar a tabela `results` e verificar que só `get` é chamado.
4. **Banco de palavras sem pulo brusco**: a área de resposta reserva altura mínima de **2 linhas** de peças no celular (1 no desktop), `flex-wrap` com `gap` fixo; ao quebrar para a 3ª linha, cresce com transição de altura (Framer `layout`, desligada com reduced motion — vira mudança instantânea sem saltar o resto da tela porque o botão Verificar fica fixo no rodapé). A área do banco de baixo **não** muda de altura ao usar peças (lugar tracejado já existe). Teste de componente: altura do contêiner não muda entre 0 e N peças que cabem em 2 linhas (mock de `getBoundingClientRect`) + screenshot 390×844 com frase longa.

### 10. E2E e screenshots

- `window.__falae` (build E2E): `seedSrs(cards)` via `importForTest` já existente (montar arquivo com `srs`), e `notificationPermission(state)` para simular permissão (stub de `Notification`).
- Cenários (mobile 390×844 + desktop):
  1. Usuário novo abre `/` → vai para `/boas-vindas`; escolhe 10 XP → "Sou iniciante" → trilha; recarregar não volta ao onboarding.
  2. Onboarding → nivelamento acertando tudo → resultado aprovado → trilha com unidade 1 testada e u2 atual; `/perfil` mostra palavras aprendidas > 0; ofensiva continua 0; gráfico sem XP.
  3. Nivelamento errando tudo → reprovado → trilha no início, nenhum card.
  4. Lição concluída → `advanceDays(1)` → `/praticar` mostra N vencidos → praticar → +8 XP, sem corações na tela.
  5. Perder 5 corações → "Praticar e ganhar coração" → concluir → "+1 coração" → conquista "Persistente" → trilha com 1 coração.
  6. Perder corações na **primeira** lição (sem cards) → praticar funciona com itens de reserva.
  7. Exportar → redefinir (dupla confirmação) → `/boas-vindas` → importar o arquivo → progresso igual ao exportado. Arquivo inválido → mensagem, nada muda.
  8. Lembrete: permissão negada → switch desligado e aviso; concedida → switch ligado e horário salvo.
  9. Perfil e Ajustes navegáveis só por teclado; diálogos prendem e devolvem o foco.
- `npm run screenshots`: boas-vindas (3 passos), nivelamento (pergunta e resultados aprovado/reprovado), praticar (com vencidos e vazio), fim de prática com "+1 coração", perfil (semana cheia e vazia, conquistas obtidas/bloqueadas), ajustes (lembrete sem suporte/negado/ligado), diálogos de importar e redefinir, cabeçalho com corações no escuro, banco de palavras com frase longa — 390×844 e 1280×800, claro e escuro.

### 11. Docs

- `docs/ARQUITETURA.md` §7, §11, §12 e §13 atualizadas com as regras acima (feito junto com este plano). ADR-010 e ADR-011 em `docs/DECISOES.md`.

## Ordem de implementação (um commit por etapa)

1. `feat: add sm-2 review and practice selection` — tarefa 1 + testes.
2. `feat: add seeded random and practice generator` — tarefa 2 + testes.
3. `fix: quarantine corrupted profile on lesson commit` — pendência 9.1 + teste.
4. `refactor: read counts instead of full tables on commit` — pendência 9.3 + mudança de `CommitContext`.
5. `feat: update srs cards on lesson commit` — tarefa 4 + teste de integração.
6. `feat: add persistent achievement` — tarefa 8.
7. `feat: add practice screen and heart reward` — tarefa 3 (inclui OutOfHearts).
8. `feat: add profile screen with weekly chart` — tarefa 5.
9. `feat: add settings screen` — tarefa 6 sem backup/lembrete/reset (som, vibração, meta, tema).
10. `feat: add export, import and reset` — tarefa 6 (backup + reset + `emitDataReplaced` no reset).
11. `feat: add daily reminder` — tarefa 6 (lembrete) + `services/notifications`.
12. `feat: add placement exercise picker and no-feedback mode` — tarefa 7 (domain + motor + `daily` não gravado para placement).
13. `feat: add welcome and placement screens` — tarefa 7 (UI + guarda + `updateProfile`).
14. `fix: hearts contrast and word bank answer area` — pendências 9.2 e 9.4.
15. `test: add practice, onboarding and settings e2e and screenshots` — tarefa 10.

Portões: etapas 1–6 e 12 → `revisor-de-codigo` + `qa-tester`; 7–11, 13 e 14 também `revisor-ux` com screenshots ao fim; nenhuma etapa avança com bloqueante.

## Critérios de aceite

- `review`, `applyOutcomes`, `seedTestedOut`, `selectForPractice`, `learnedAfter`, `generatePractice`, `pickPlacementExercises`, `placementScore`, `lastSevenDays`, `parseExportFile` são puros, sem React/Dexie, com testes de todos os casos listados; `generatePractice` é determinístico e todo exercício gerado passa no `exerciseSchema`.
- Concluir lição/revisão/prática grava cards junto com resultado, daily, profile e conquistas numa transação; repetir o commit não altera nada; falha de validação não grava nada.
- Praticar não mostra nem gasta corações; concluir dá +1 (teto 5); funciona sem nenhum card; abandonar não dá nada; recarregar mantém os mesmos exercícios.
- Sem TTS, nenhum `listen-type` aparece no Praticar; `speak` nunca aparece.
- Nivelamento: 15 exercícios (fixture suficiente), nenhum feedback até o fim, ≥ 80% marca unidade 1 testada e cria cards com intervalo 3 só para itens sem card; não muda ofensiva, meta, `daily` nem XP.
- Primeiro acesso redireciona para `/boas-vindas`; usuário da Fase 5 com progresso não é redirecionado.
- Perfil mostra os 5 números, gráfico de 7 dias acessível (tabela para leitor de tela) e todas as conquistas com estado.
- Permissão de notificação só é pedida ao ligar o lembrete; limitações aparecem na tela.
- Importar arquivo inválido/de versão mais nova não altera o banco (teste compara antes/depois); importar válido mostra resumo e pede confirmação; redefinir exige duas confirmações e emite recarga das stores.
- Perfil corrompido vai para a quarentena antes de o commit usar o padrão.
- O commit não lê a tabela `results` inteira nem materializa `daily`/`srs` inteiros.
- Contador de corações com contraste AA no escuro; banco de palavras não salta ao quebrar linha.
- Nenhum texto de UI fora de `src/i18n/pt-BR.ts`; nenhuma cor hex em componente; reduced motion respeitado.
- Dexie continua na versão 1; `EXPORT_SCHEMA_VERSION` continua 1 (se a decisão 1 abaixo não for aprovada).
- lint, typecheck, test, e2e verdes; revisores sem bloqueantes.

## Fora desta fase

Refazer o nivelamento pelos Ajustes; nivelamento para outras unidades; FSRS; sincronização na nuvem; notificações push com servidor; itens de TTS adiados (`voiceschanged`, "quase" em números por extenso) — passam para a Fase 7 junto com o polimento de voz; jornada E2E completa e Lighthouse (Fase 7).

## Decisões que precisam do usuário

1. **Conquista "persistente"**: o padrão desta fase é a derivação sem schema (prática concluída com 0 corações; ADR-010). A versão mais fiel ("voltou a estudar depois de zerar, inclusive esperando a recarga") exige campo novo opcional no `Profile` (ex.: `heartsDepletedAt?: string`), sem nova versão do Dexie (campo não indexado), mas com atualização do `profileSchema` e do formato do backup (backup novo não abriria em versão antiga do app). Aceita a derivação?
2. **Nivelamento acende "palavras aprendidas"**: itens semeados com intervalo 3 contam como aprendidos (`reps ≥ 1`, `intervalDays ≥ 3`), então passar no teste pode liberar `words-50` na hora. Manter (o aluno provou que sabe) ou não contar itens semeados (exigiria marcar o card — mudança de schema)?
3. **Praticar com itens de reserva**: sem cards suficientes, usar itens da lição atual (que o aluno talvez ainda não tenha visto). Ok, ou preferir bloquear o Praticar até concluir a primeira lição (e aí a tela Sem corações na 1ª lição só ofereceria "Esperar")?
4. **Redefinir progresso**: confirmação dupla com digitar "APAGAR" no 2º passo — ok, ou basta um segundo botão de confirmação? E redefinir deve também voltar os Ajustes ao padrão (proposta: sim)?
5. **Lembrete no iPhone**: só funciona com o app instalado na tela inicial; aceita lançar com essa limitação documentada?
