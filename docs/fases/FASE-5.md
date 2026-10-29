# Fase 5 — Trilha e gamificação

**Objetivo:** o aluno abre o app em `/`, vê a trilha das 4 unidades com o estado real de cada lição, entra na lição atual, e ao terminar vê XP, ofensiva (com congelamento), meta diária e conquistas novas, tudo gravado numa única transação. Lições bloqueadas não abrem nem por URL.

**Sem mudança no modelo persistido.** Tudo cabe no que já existe: `Profile.streak`, `Profile.lastGoalCelebratedDay`, tabelas `daily`, `achievements`, `lessonProgress`, `results`. Dexie continua na versão 1.

## Decisões desta fase

- **Showcase** sai de `/` e vai para `/dev/showcase`, registrado só quando `import.meta.env.DEV` (import dinâmico, fora do bundle de produção). Continua útil ao `revisor-ux` para tokens e estados do Tuca.
- **Dica (`/dica/:skillId`) entra nesta fase**: o `tip` já está no conteúdo e validado; a tela é só leitura.
- **Conquistas de "palavras aprendidas"** (50/100/250) já são declaradas; `wordsLearned` vem de `getSrsCards()` e fica 0 até a Fase 6 gravar cards. Nenhum código muda na Fase 6 para elas acenderem.
- **"Persistente"** (voltou após perder todos os corações) fica para a Fase 6, junto com "Praticar e ganhar coração" — ver "Decisões que precisam do usuário".
- **Recarga de corações continua 4 h**, constante única `HEART_REFILL_MS` em `src/domain/gamification/hearts.ts`; nada pode repetir o valor (UI calcula a partir dela).
- **Nivelamento (`kind: 'placement'`) não conta para ofensiva nem meta** (0 XP, não é estudo do dia).

## Tarefas

### 1. Progressão — `src/domain/progression/`

`domain` não importa `content`, então o domínio declara o formato mínimo que precisa (o `Course` de `src/content/course.ts` é compatível estruturalmente):

```ts
// src/domain/progression/pathState.ts
export type PathCourseInput = {
  units: readonly {
    id: string;
    skills: readonly { id: string; lessons: readonly { id: string }[] }[];
    reviewLesson: { id: string };
  }[];
};
export type NodeStatus = 'locked' | 'available' | 'current' | 'completed';
export type LessonNode = {
  lessonId: string;
  unitId: string;
  skillId: string | null; // null = revisão
  index: number; // -1 = revisão
  status: NodeStatus;
  testedOut: boolean; // concluída via nivelamento
};
export type SkillState = {
  skillId: string;
  crowned: boolean;
  unlocked: boolean;
  nodes: LessonNode[];
};
export type UnitState = {
  unitId: string;
  unlocked: boolean;
  completed: boolean; // revisão concluída ou testada
  skills: SkillState[];
  review: LessonNode;
};
export type PathState = {
  units: UnitState[];
  currentLessonId: string | null; // null = curso concluído
  byLesson: ReadonlyMap<string, LessonNode>;
};
export type Placement = { score: number; skippedUnit1: boolean };

export function computePathState(
  course: PathCourseInput,
  progress: readonly { lessonId: string }[],
  placement?: Placement,
): PathState;
export function canOpenLesson(state: PathState, lessonId: string): boolean;
```

Regras (§12, precisas):

- Lição "concluída" = existe `LessonProgress` com aquele `lessonId` **ou** está numa unidade testada (`placement.skippedUnit1` → unidade de `order` 1; `testedOut: true`).
- Unidade 1 sempre desbloqueada. Unidade N+1 desbloqueada ⇔ unidade N `completed`.
- Na unidade desbloqueada: habilidade 1 desbloqueada; habilidade k+1 ⇔ habilidade k coroada (todas as suas lições concluídas).
- Na habilidade desbloqueada: lição 1 disponível; lição i+1 ⇔ lição i concluída.
- Revisão disponível ⇔ todas as habilidades da unidade coroadas.
- `current` = primeira lição não concluída e não bloqueada, na ordem unidade → habilidade → lição → revisão. Só um nó `current`; os demais abertos e não concluídos são `available` (na prática nenhum com desbloqueio linear, mas o tipo aceita).
- Concluída nunca volta a ficar bloqueada, mesmo que dados importados estejam fora de ordem (concluída vence; progresso de lições desconhecidas é ignorado).
- `canOpenLesson` = status ≠ `locked`; lessonId inexistente → `false`.
- Função pura, testes em `pathState.test.ts`: curso vazio, primeira abertura, meio de habilidade, coroa abre próxima, revisão abre com 4 coroas, revisão abre próxima unidade, placement pula unidade 1, progresso fora de ordem, curso inteiro concluído (`currentLessonId: null`).

### 2. Guarda de rota da lição

- `LessonScreen` (ou um loader leve) calcula `canOpenLesson`; se `false`, `navigate('/', { replace: true, state: { notice: 'lessonLocked' } })`. A trilha mostra um aviso (`role="status"`) com texto de `t.path.lessonLocked`. Lição inexistente → mesmo fluxo com `notice: 'lessonNotFound'`.
- Sessão em andamento no `sessionStorage` de uma lição que ficou bloqueada (ex.: depois de importar/redefinir) é descartada.
- Arquivos: `src/features/lesson/LessonScreen.tsx`, `src/stores/useProgress.ts` (novo: carrega `lessonProgress`, expõe `pathState` memoizado; recarrega após `commitLesson`).

### 3. Tela Trilha — `/`

Arquivos: `src/features/path/PathScreen.tsx`, `PathHeader.tsx`, `UnitSection.tsx`, `PathNode.tsx`, `GoalRing.tsx`, `StreakBadge.tsx`, `src/app/router.tsx`, `src/i18n/pt-BR.ts`, `src/ui/` (ícones novos).

- **Cabeçalho** (fixo no topo da área de conteúdo): ofensiva (valor de `displayStreak`, ícone de chama; ícone de cristal com nº de congelamentos), XP total, corações (`HeartsBadge` reaproveitado; com < 5, "próximo em 1h 23min" atualizando a cada 30 s por `useNow(intervalMs)` baseado em `clock`), anel da meta diária (`xpHoje / meta`, `role="img"` com `aria-label` "Meta diária: 12 de 20 XP").
- **Unidades**: faixa de título com a cor da unidade (token da unidade: `manga`, `anil`, `folha`, `acerola`), número e título; habilidades em sequência, cada uma com título + botão "Dica" (link para `/dica/:skillId`) e seus 3 nós; nó da revisão ao fim da unidade (ícone diferente).
- **Caminho sinuoso**: deslocamento horizontal por padrão fixo `[0, 1, 2, 1, 0, -1, -2, -1]` × ~36px (celular) / ~56px (desktop), via `translate-x`; sem SVG pesado.
- **Estados do nó** (cor nunca é o único sinal): bloqueado = cinza + cadeado; atual = cor da unidade, maior, anel pulsante (sem pulso com reduced motion) + balão "Começar"; concluído = cor da unidade + ✓; habilidade coroada = coroa sobre o último nó; testado = ✓ sem coroa de ouro (coroa prata).
- **Acessibilidade**: cada nó é `<a>`/`<Link>` quando aberto e `<button aria-disabled="true">` quando bloqueado (focável, ao ativar mostra aviso "Termine a lição anterior para abrir esta"). `aria-label` completo: "Lição 2 de 3, Meu nome é…, concluída" / "atual" / "bloqueada"; revisão: "Revisão da unidade 1, bloqueada — conquiste as 4 coroas". Cada unidade é `<section aria-labelledby>`; nós numa `<ol>`. Ordem do Tab segue a ordem visual.
- **Rolagem**: ao montar, `scrollIntoView({ block: 'center' })` no nó atual (`behavior: 'auto'` se reduced motion) e foco **não** é movido (só rolagem). Não rola de novo em re-render.
- **Barra de navegação**: já existe em `AppLayout`; Praticar/Perfil/Ajustes seguem `ComingSoon`. Rótulo "Ajustes" vem de `t.nav.settings` (alterar texto só no i18n se o usuário quiser "Ajustes" em vez de "Configurações").
- Estado de carregamento: esqueleto simples enquanto `profile`/`progress` carregam (sem piscar a trilha bloqueada).

### 4. Tela Dica — `/dica/:skillId`

Arquivos: `src/features/tip/TipScreen.tsx`, `src/content/` (helper `findSkill(course, id)` em `course.ts`).

- Título da habilidade, corpo da dica, bloco de armadilha ❌/✅ (ícone + texto, não só cor), exemplos em inglês com `lang="en"` e `SpeakerButton` (se houver TTS).
- Botão "Voltar para a trilha". `skillId` inexistente → redireciona para `/` com `notice: 'tipNotFound'`.
- Dica de habilidade bloqueada **pode** ser lida (é material de estudo, não progresso).

### 5. Ofensiva — `src/domain/gamification/streak.ts`

```ts
export const MAX_FREEZES = 2;
export const XP_PER_FREEZE = 100;
export type Streak = Profile['streak']; // tipo estrutural repetido no domain, sem importar data/
export type StreakChange = {
  streak: Streak;
  event: 'first' | 'continued' | 'frozen' | 'reset' | 'sameDay' | 'clockBack';
  increased: boolean; // +1 hoje (para a animação)
  freezeUsed: boolean;
  freezesEarned: number;
};
export function applyActivity(streak: Streak, today: DayKey, xpGained: number): StreakChange;
export function displayStreak(
  streak: Streak,
  today: DayKey,
): { value: number; doneToday: boolean; atRisk: boolean; willUseFreeze: boolean };
```

`applyActivity` (chamada só para `kind ∈ {lesson, review, practice}`), com `gap = diffDays(today, lastActiveDay)`:

| Situação                              | Resultado                                                                            |
| ------------------------------------- | ------------------------------------------------------------------------------------ |
| sem `lastActiveDay`                   | `current = 1`, `event: 'first'`                                                      |
| `gap = 0` (mesmo dia)                 | nada muda na contagem, `event: 'sameDay'`                                            |
| `gap = 1` (ontem)                     | `current + 1`, `'continued'`                                                         |
| `gap = 2` (anteontem) e `freezes ≥ 1` | `freezes − 1`, `current + 1`, `'frozen'` (o dia perdido é coberto)                   |
| `gap = 2` e `freezes = 0`             | `current = 1`, `'reset'`                                                             |
| `gap ≥ 3` (2+ dias perdidos)          | `current = 1`, `'reset'` — congelamentos **não** são gastos                          |
| `gap < 0` (relógio/fuso voltou)       | contagem e `lastActiveDay` intactos, `'clockBack'`; XP ainda conta para congelamento |

- Sempre: `lastActiveDay = today` (exceto `clockBack`); `longest = max(longest, current)`.
- Congelamento é consumido **antes** do ganho de XP da mesma lição.
- Ganho: `xpTowardFreeze += xpGained`; enquanto `≥ 100` e `freezes < 2`: `freezes++`, `xpTowardFreeze −= 100`. Com `freezes = 2`, `xpTowardFreeze = 0` (não acumula "crédito escondido"; ao gastar um, recomeça do zero). `xpGained = 0` não muda nada.
- Fuso: só o `dayKey` local importa. Viajar para leste e "ganhar" um dia conta como dia novo; para oeste e voltar para a data anterior cai em `clockBack`. Horário de verão não afeta (`diffDays` compara datas, não horas).
- Consumo é **preguiçoso**: abrir o app não grava nada. A trilha usa `displayStreak`:
  - `gap ≤ 0` → `value = current`, `doneToday = gap === 0`;
  - `gap = 1` → `value = current`, `atRisk = true`;
  - `gap = 2` e `freezes ≥ 1` → `value = current`, `atRisk = true`, `willUseFreeze = true` (texto: "Um congelamento vai proteger sua ofensiva");
  - senão → `value = 0`.
- Testes em `streak.test.ts` cobrindo cada linha da tabela, `longest`, ganho com sobra (ex.: 95 + 30 → 1 congelamento, 25 sobrando), ganho de 2 de uma vez (210 XP), teto 2, virada de mês/ano, 29/02, e `displayStreak`.

### 6. Meta diária

- `src/domain/gamification/dailyGoal.ts`: `goalProgress(xpToday, goal) → { xp, goal, ratio (0–1), met }` e `shouldCelebrateGoal(xpBefore, xpAfter, goal, lastGoalCelebratedDay, today) → boolean` = `xpAfter ≥ goal && lastGoalCelebratedDay !== today` (não exige `xpBefore < goal`: se trocou a meta para menor e já passou, celebra uma vez).
- Celebrar → `profile.lastGoalCelebratedDay = today` no mesmo `profile` do `LessonOutcome`.
- XP de hoje vem de `repository.getDailyStats(today, today)`; a trilha lê no carregamento e após cada lição (store `useProgress`).
- `daily.goalMet` continua calculado pelo repositório (já existe); `clockBack` grava no `day` do relógio atual normalmente.

### 7. Conquistas — `src/domain/gamification/achievements.ts`

```ts
export type AchievementStats = {
  totalXp: number;
  streakLongest: number;
  lessonsCompleted: number; // lições distintas concluídas (lessonProgress)
  unitsCompleted: number; // revisões concluídas
  goalDaysMet: number; // dias com daily.goalMet
  wordsLearned: number; // cards com reps ≥ 1 e intervalDays ≥ 3 (0 até a Fase 6)
  last: { perfect: boolean; localHour: number; kind: SessionKind };
};
export type AchievementDef = {
  id: string; // estável, nunca renomear (é chave persistida)
  icon: string; // emoji
  check: (s: AchievementStats) => boolean;
};
export const achievements: readonly AchievementDef[];
export function newlyUnlocked(stats: AchievementStats, already: ReadonlySet<string>): string[];
```

- Título/descrição em `t.achievements[id]` (i18n), não no domain.
- Lista e ids: `first-lesson` (lessonsCompleted ≥ 1), `perfect-lesson` (last.perfect && kind ≠ placement), `streak-3`/`streak-7`/`streak-30` (streakLongest), `words-50`/`words-100`/`words-250`, `first-unit` (unitsCompleted ≥ 1), `goal-7` (goalDaysMet ≥ 7), `xp-500`/`xp-1000`, `early-bird` (last.localHour < 8). `persistent` fica para a Fase 6.
- Usar `streakLongest` e totais faz conquistas acenderem também depois de importar um backup.
- `localHour` é calculado fora do domain a partir de `clock.now()` (`new Date(ms).getHours()` dentro de `src/services/clock.ts`, ex.: `clock.localHour()`).
- Testes: cada conquista no limite (499/500 XP etc.), já desbloqueada não repete, várias de uma vez.

### 8. Fim da lição — orquestração atômica

`useProfile.commitLesson` passa a montar o `LessonOutcome` completo (estado novo = funções puras; a store só junta e chama o repositório):

1. Lê `dailyBefore = getDailyStats(today, today)`, `lessonProgress`, `achievements`, `srsCards` (para `wordsLearned`), `getDailyStats(dayKey(createdAt), today)` para `goalDaysMet`.
2. `refillHearts` → `applyActivity` (se não for placement) → `totalXp += xp` → `shouldCelebrateGoal`.
3. Monta `AchievementStats` **já incluindo** a lição atual (progresso, XP, dia do daily com o XP somado) → `newlyUnlocked`.
4. Uma chamada `recordLessonResult({ result, profile, srsCards: [], newAchievements, dailyGoalXp })`.
5. Retorna `CommitSummary = { result, streak: StreakChange | null, goal: { progress, celebrate }, newAchievements: string[] }` para a tela de fim.

- Idempotência: se o `result.id` já existe o repositório não grava nada — mas o profile também não pode ser aplicado duas vezes. **Ajuste no repositório**: o `profile.put` e `achievements.bulkPut` ficam dentro do mesmo `if` que já protege o resultado (verificar `dexieRepository.ts`: hoje o `return` antecipado já cobre tudo — manter e testar). A store, nesse caso, recarrega o profile do banco em vez de usar o calculado (`recordLessonResult` passa a retornar `Promise<{ applied: boolean }>`; mudança de interface, não de dados).
- Teste de integração com `fake-indexeddb`: ofensiva, daily, conquistas e profile gravados juntos; falha no meio (Zod rejeita) não grava nada; repetir o mesmo commit não duplica.

### 9. Tela de fim — `LessonComplete.tsx`

- Mostra: XP (contador que sobe, sem animação com reduced motion), precisão %, tempo (mm:ss), ofensiva com "+1" animado quando `increased` (texto "Ofensiva: 5 dias" sempre; "Congelamento usado" quando `freezeUsed`; "Você ganhou um congelamento" quando `freezesEarned > 0`), anel da meta, celebração da meta (faixa + Tuca `celebrating`) quando `celebrate`, lista de conquistas novas (ícone + título).
- Tuca `celebrating` sempre; confete só sem reduced motion.
- Região `aria-live="polite"` com resumo textual único (não ler cada número animado).
- Ordem das celebrações: resumo → ofensiva → meta → conquistas, num só painel (não uma sequência de modais). Botão "Continuar" volta para `/` e a trilha rola para o novo nó atual.
- Sons via `services/sound`: `correct`, `wrong` (no feedback), `complete` (fim), `combo` (a cada 5 acertos seguidos, no feedback). Tocam só se `settings.sound`; vibração só se `settings.haptics`. Nenhum som automático na trilha.

### 10. Pendências da Fase 3

Arquivos: `src/features/lesson/exercises/ChoiceList.tsx`, `MultipleChoice.tsx`, `FillBlank.tsx`, `WordBank.tsx`, `FeedbackPanel.tsx`, `HeartsBadge.tsx`, `OutOfHearts.tsx`.

- Após verificar: opção escolhida errada com ✗ + borda de erro, correta com ✓ + borda de acerto; opções ficam desabilitadas e anunciadas ("sua resposta, errada" / "resposta certa").
- "Quase": ícone próprio (não ✓ nem ✗) e a letra divergente destacada na resposta certa (`<mark>` + texto "letra diferente" para leitor de tela). Diferença calculada por função pura `diffChars(a, b)` em `src/domain/grading/`.
- Banco de palavras: lugar da peça usada com contorno tracejado (`border-dashed`), mesma largura, não focável.
- Tuca pequeno (`size="sm"`) no feedback: `happy` no acerto, `thinking` no quase, `sad` no erro; decorativo (`aria-hidden`).
- Perder coração: coração do topo encolhe/treme 300 ms (fade com reduced motion) + `aria-live` "Você perdeu um coração. Restam 3".
- Contador de corações com número visível ao lado do ícone; tempo até o próximo coração ao vivo (`useNow`) no `HeartsBadge` e em `OutOfHearts`.
- "Praticar e ganhar coração" e itens de TTS (`voiceschanged`, quase em números por extenso) continuam para a Fase 6. Code-splitting: rotas `/licao`, `/dica` e `/dev/showcase` com `lazy()` nesta fase.

### 11. E2E e screenshots

- `window.__falae` ganha `today(): string` (para asserções) — o resto (`setNow`, `advanceDays`, `advanceHours`, `reset`) já existe. O clock simulado precisa sobreviver a `page.reload()`: em build E2E, `setNow`/offset também gravados em `sessionStorage` e lidos no boot (`exposeClockForTesting`).
- Helper Playwright `e2e/helpers/seed.ts` para injetar um profile/progresso via `window.__falae.importForTest(file)` (só em build E2E; usa `repository.importAll` com arquivo validado) — evita jogar 12 lições para testar a revisão.
- Cenários novos (mobile 390×844 + desktop):
  1. Usuário novo: trilha mostra u1-sk1-l1 como atual, demais bloqueadas; `/licao/u1-sk1-l2` redireciona com aviso.
  2. Concluir lição → tela de fim com XP, "Ofensiva: 1 dia" e +1 → trilha com l1 concluída e l2 atual.
  3. `advanceDays(1)` + lição → ofensiva 2. `advanceDays(2)` com congelamento semeado → ofensiva 3 e "Congelamento usado". `advanceDays(3)` → ofensiva 1.
  4. Meta 10 XP: primeira lição celebra; segunda no mesmo dia não.
  5. Conquista "Primeira lição" aparece uma vez só.
  6. Navegação só por teclado: Tab até o nó atual, Enter abre a lição.
  7. Dica abre pela trilha e volta.
- `npm run screenshots`: trilha (início, meio com coroas, unidade 2 aberta), dica, fim de lição (com ofensiva, meta e conquista), feedback com ✓/✗ e "quase", banco de palavras com peça usada — 390×844 e 1280×800, claro e escuro.

### 12. Docs

- `docs/ARQUITETURA.md` §8, §11, §12, §13 atualizadas com as regras acima (já feito junto com este plano).

## Ordem de implementação (um commit por etapa)

1. `feat: add path state and unlock rules` — tarefa 1 + testes.
2. `feat: add streak rules with freezes` — tarefa 5 (`streak.ts`) + testes.
3. `feat: add daily goal and achievements rules` — tarefas 6 e 7 (domain) + testes.
4. `feat: apply streak, goal and achievements on lesson commit` — tarefa 8 + teste de integração do repositório.
5. `feat: add progress store and lesson route guard` — tarefa 2.
6. `feat: add path screen` — tarefa 3 (sem animações), showcase para `/dev/showcase`, lazy routes.
7. `feat: add skill tip screen` — tarefa 4.
8. `feat: show streak, goal and achievements on lesson complete` — tarefa 9 + sons.
9. `feat: polish lesson feedback` — tarefa 10.
10. `test: add path and streak e2e and screenshots` — tarefa 11.

Portões: etapas 1–4 → `revisor-de-codigo` + `qa-tester`; 6–9 também `revisor-ux` com screenshots ao fim; nenhuma etapa avança com bloqueante.

## Critérios de aceite

- `computePathState`, `applyActivity`, `displayStreak`, `goalProgress`, `shouldCelebrateGoal`, `newlyUnlocked` puros, sem React/Dexie/content, com testes de todos os casos listados.
- Lição bloqueada por URL → volta à trilha com aviso; nenhuma escrita acontece.
- Trilha abre rolada até o nó atual; leitor de tela anuncia nome e estado de cada nó; tudo alcançável por Tab; alvos ≥ 44 px; contraste AA nos dois temas.
- Fim de lição grava resultado, progresso, daily, profile (XP, corações, ofensiva, `lastGoalCelebratedDay`) e conquistas numa transação; repetir o commit não duplica nada.
- Ofensiva: E2E com clock simulado comprova +1 no dia seguinte, congelamento com 1 dia perdido e zerar com 2+.
- Meta celebra 1×/dia; conquista aparece 1× só.
- Animações respeitam `prefers-reduced-motion`; sons respeitam `settings.sound`.
- Nenhum texto de UI fora de `src/i18n/pt-BR.ts`; nenhuma cor hex em componente.
- Dexie continua na versão 1; `EXPORT_SCHEMA_VERSION` continua 1.
- lint, typecheck, test, e2e verdes; revisores sem bloqueantes.

## Fora desta fase

Onboarding e nivelamento (Fase 6; o tipo `Placement` já é aceito), Praticar/SRS e "ganhar coração", conquista "persistente", telas Perfil e Ajustes, lembretes, exportar/importar pela UI (o import só existe como helper E2E).

## Decisões que precisam do usuário

1. **Recarga de corações**: manter 4 h por coração ou reduzir (ex.: 30 min–1 h)? Hoje é a constante `HEART_REFILL_MS`.
2. **Conquista "persistente"**: para detectar "voltou após perder todos os corações" sem mudar o schema, a proposta é derivar na Fase 6 (corações chegaram a 0 = `profile.hearts === 0` no início da lição concluída). Alternativa mais fiel exige um campo novo no `Profile` (mudança de schema + migração). Aceita a derivação?
3. **Rótulo da navegação**: "Ajustes" (como no pedido) ou "Configurações" (como na §13)? Só muda o i18n.
4. **Nivelamento e ofensiva**: confirmar que o teste de nível não conta como dia de ofensiva (proposta deste plano).
