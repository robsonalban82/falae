# Arquitetura — Falaê

> Status: **proposta (Fase 1)** — aguardando aprovação do usuário.
> Dono: agente `arquiteto`. Qualquer mudança em modelo de dados persistido ou stack exige aprovação do usuário.

## 1. Identidade (original)

|                |                                                                                                                                                                                                                                                                                                                                                                         |
| -------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Nome**       | **Falaê** — de "fala aí", convite brasileiro para conversar.                                                                                                                                                                                                                                                                                                            |
| **Mascote**    | **Tuca**, um tucano-de-bico-verde estilizado em SVG próprio, formas geométricas arredondadas. Estados: `feliz`, `comemorando`, `triste`, `incentivando`, `pensando`. Animado com Framer Motion (piscar, inclinar a cabeça, pulinho).                                                                                                                                    |
| **Paleta**     | Base "noite tropical" + bico de tucano: primária **Manga** `#FF8A1F`, secundária **Anil** `#3B3FB6`, fundo claro **Areia** `#FFF8EF`, fundo escuro **Noite** `#14152B`. Acerto **Folha** `#16A34A`/`#0F7A37`, erro **Acerola** `#E5484D`/`#B42318`, destaque **Maracujá** `#F5C518` (XP/ofensiva). Valores finais e variantes com contraste AA são definidos na Fase 2. |
| **Tipografia** | Títulos: **Fredoka** (arredondada, amigável). Texto: **Atkinson Hyperlegible** (alta legibilidade, ótima para aprendizes). Ambas auto-hospedadas via `@fontsource` (funcionam offline).                                                                                                                                                                                 |
| **Sons**       | Gerados em tempo real com Web Audio API (osciladores curtos) — sem arquivos de terceiros, sem questão de direitos.                                                                                                                                                                                                                                                      |

Nada de verde-coruja, nomes, sons ou textos do Duolingo. O `revisor-ux` checa isso em toda fase visual.

## 2. Stack e justificativas

| Camada       | Escolha                                                                                         | Observação                                             |
| ------------ | ----------------------------------------------------------------------------------------------- | ------------------------------------------------------ |
| Build        | Vite + React 19 + TypeScript `strict`                                                           | conforme pedido                                        |
| PWA          | `vite-plugin-pwa` (Workbox, `generateSW`, precache de todo o app + conteúdo)                    | offline após 1º acesso, instalável                     |
| Rotas        | `react-router` (modo biblioteca, `createBrowserRouter`)                                         | `navigateFallback` no SW para rotas offline            |
| Estado       | Zustand (stores finas, sem lógica de negócio)                                                   |                                                        |
| Persistência | Dexie (IndexedDB) atrás da interface `Repository`                                               | trocar por Supabase depois sem tocar na UI             |
| Validação    | Zod (conteúdo, import de progresso, settings)                                                   |                                                        |
| Estilo       | Tailwind CSS v4 com tokens em CSS variables                                                     | modo escuro via classe `dark` + `prefers-color-scheme` |
| Animação     | Framer Motion (`motion`) com `useReducedMotion`                                                 |                                                        |
| Voz          | Web Speech API (`speechSynthesis`, `SpeechRecognition`/`webkitSpeechRecognition`)               | fallbacks em §9                                        |
| Gráfico      | SVG próprio (barras de 7 dias)                                                                  | evita lib de gráficos pesada                           |
| Testes       | Vitest + Testing Library + `fake-indexeddb`; Playwright (projetos `mobile` 390×844 e `desktop`) |                                                        |
| Qualidade    | ESLint (flat config, `typescript-eslint`, `react-hooks`, `jsx-a11y`) + Prettier                 |                                                        |

Dependências extras além das pedidas: `vite-plugin-pwa`, `react-router`, `@fontsource/*`, `fake-indexeddb` (dev), `eslint-plugin-jsx-a11y` (dev). Nenhuma lib de datas: as poucas operações de dia ficam em `src/domain/time.ts`.

## 3. Estrutura de pastas

```
.
├─ .claude/agents/ · .claude/skills/   # agentes e skills do projeto
├─ docs/
│  ├─ ARQUITETURA.md  DECISOES.md
│  └─ fases/FASE-N.md                  # plano e aceite de cada fase
├─ e2e/                                # Playwright (specs, fixtures, screenshots/)
├─ public/                             # ícones PWA, manifest assets
├─ scripts/validate-content.ts         # `npm run validate:content`
└─ src/
   ├─ app/            # App.tsx, router, layout (barra inferior), providers
   ├─ content/
   │  ├─ schema.ts    # Zod — fonte da verdade do formato
   │  ├─ loader.ts    # importa, valida, expande respostas aceitas, indexa
   │  └─ units/u01-*.json …
   ├─ domain/         # FUNÇÕES PURAS + testes (sem React, sem Dexie)
   │  ├─ grading/     # normalize, expandPatterns, gradeExercise
   │  ├─ srs/         # algoritmo SM-2 adaptado
   │  ├─ gamification/# xp, streak, hearts, dailyGoal, achievements
   │  ├─ progression/ # desbloqueio da trilha, nivelamento
   │  ├─ practice/    # geração de exercícios a partir de itens vencidos
   │  ├─ lesson/      # máquina de estados da lição (fila, repetição de erros)
   │  └─ time.ts      # dayKey, diffDays (fuso local)
   ├─ data/
   │  ├─ repository.ts       # interface Repository
   │  ├─ dexieRepository.ts  # implementação IndexedDB
   │  ├─ db.ts               # schema Dexie + migrações
   │  └─ exportImport.ts     # JSON versionado + validação Zod
   ├─ stores/         # Zustand: useProfile, useSettings, useLessonSession…
   ├─ services/       # clock, speech (tts/stt), sound, haptics, notifications
   ├─ features/
   │  ├─ onboarding/  placement/  path/  lesson/  lesson/exercises/
   │  ├─ practice/    profile/    settings/  achievements/  tips/
   ├─ ui/             # componentes base (Button, ProgressBar, Ring, Sheet…), Mascot/
   ├─ i18n/pt-BR.ts   # todos os textos da interface
   ├─ styles/         # tokens.css, index.css
   └─ test/           # setup do Vitest, helpers, fixtures
```

Regra de dependência: `features → stores/services → domain`; `data` só é usado por stores. `domain` não importa nada de fora de `domain` (nem `content` em runtime — recebe dados por parâmetro).

## 4. Modelo de conteúdo (`src/content/schema.ts`)

Tipos inferidos do Zod; abaixo, a forma.

```ts
type Unit = {
  id: string;
  order: number;
  title: string;
  description: string;
  color: 'manga' | 'anil' | 'folha' | 'acerola'; // token
  skills: Skill[]; // exatamente 4 no MVP
  reviewLesson: Lesson; // revisão da unidade
};

type Skill = {
  id: string;
  title: string;
  icon: string; // emoji
  tip: Tip;
  vocab: VocabItem[];
  sentences: Sentence[];
  lessons: Lesson[]; // exatamente 3
};

type Tip = { title: string; blocks: TipBlock[] }; // 3–6 blocos
type TipBlock =
  | { kind: 'text'; md: string } // markdown mínimo (negrito/itálico)
  | { kind: 'examples'; items: { en: string; pt: string }[] }
  | { kind: 'pitfall'; wrong: string; right: string; why: string };

type VocabItem = {
  id: string;
  en: string;
  pt: string[]; // pt[0] = tradução principal
  acceptedPt?: string[];
  acceptedEn?: string[];
  example: { en: string; pt: string };
  emoji?: string;
  icon?: string;
  difficulty: 1 | 2 | 3;
  focus?: FocusTag;
  notes?: string;
};

type Sentence = {
  id: string;
  en: string;
  pt: string;
  acceptedEn?: string[];
  acceptedPt?: string[];
  difficulty: 1 | 2 | 3;
  focus?: FocusTag;
};

type Lesson = { id: string; title?: string; exercises: Exercise[] }; // 10–15

type BaseExercise = { id: string; itemIds: string[]; explanation?: string };
type Exercise = BaseExercise &
  (
    | {
        type: 'multiple-choice';
        prompt: string;
        options: { text: string; emoji?: string }[];
        answer: string;
      }
    | {
        type: 'word-bank';
        promptPt: string;
        answer: string;
        accepted?: string[];
        distractors: string[];
      }
    | { type: 'translate-typing'; promptEn: string; accepted: string[] }
    | { type: 'listen-type'; textEn: string; accepted?: string[] }
    | { type: 'speak'; textEn: string }
    | { type: 'match-pairs'; pairs: { en: string; pt: string }[] }
    | {
        type: 'fill-blank';
        sentence: string;
        options: string[];
        answer: string;
        translationPt: string;
      }
  );
```

**Validações extras (`superRefine`)**: ids únicos globais; `itemIds` existem; `answer` ∈ `options`; `word-bank` montável com `answer` tokenizado ⊆ banco; padrões expandem para ≤ 64 frases; 10–15 exercícios por lição; 4 skills × 3 lições por unidade.

**Carregamento**: `loader.ts` importa os JSON (via `import.meta.glob`, entram no bundle e no precache), valida com Zod e **lança erro em build/teste** se algo falhar; em runtime, uma unidade inválida é omitida e é mostrado um aviso (nunca carrega conteúdo inválido). Na carga, os padrões `(x)`/`[a|b]` são expandidos e normalizados uma única vez e guardados num índice `Map<id, ...>`.

## 5. Corretor de respostas (`src/domain/grading/`)

```ts
type Verdict = 'correct' | 'almost' | 'wrong';
type GradeResult = { verdict: Verdict; correctAnswer: string; note?: string };
```

`normalize(text, lang)`:

1. NFC → minúsculas → troca aspas tipográficas (`’` → `'`).
2. Remove acentos/diacríticos (PT e EN).
3. Remove pontuação (exceto apóstrofo interno), colapsa espaços, trim.
4. **EN**: expande contrações para forma canônica (`i'm→i am`, `you're→you are`, `don't→do not`, `can't→cannot`, `won't→will not`, `it's→it is`, `let's→let us`, `what's→what is`…). Ambíguos (`he's`, `'d`) geram as duas leituras.
5. Números: `0–100` por extenso ↔ dígitos nos dois idiomas (`thirty`↔`30`, `trinta`↔`30`).

`matchesAccepted(input, acceptedSet)` → igualdade após normalizar.

**"Quase certo"** (conta como acerto, mostra a forma correta e `note` "Atenção à digitação"): distância de Levenshtein ≤ 1 por palavra em no máximo 1 palavra com ≥ 5 letras, **desde que** a palavra digitada não seja outra palavra válida conhecida do conteúdo (evita aceitar `then`/`than`, `quite`/`quiet`). Nunca vale em `fill-blank`, `multiple-choice` e `word-bank`.

**Fala** (`speak`): compara transcrição normalizada com o alvo por palavras; acerto se ≥ 80% das palavras do alvo aparecem na ordem (LCS). Usa as N alternativas do reconhecedor.

## 6. Motor de lição (`src/domain/lesson/`)

Máquina de estados pura: `start → presenting → answered(correct|wrong) → … → finished | outOfHearts`.

- Fila inicial = exercícios da lição (ordem do autor). Exercício errado é **reinserido no fim** (uma vez por exercício); a lição só termina quando a fila esvazia.
- Barra de progresso = exercícios distintos acertados / total.
- Combo: contador de acertos seguidos (zera no erro).
- Corações: −1 por erro em lições normais; prática e revisão SRS **não** gastam corações.
- Exercícios `speak`/`listen-type` sem suporte do navegador são trocados por fallback (§9) ao montar a fila.
- Estado da sessão em andamento salvo no `sessionStorage` (recarregar a página não perde a lição atual).

Fluxo de UI: instrução → exercício → botão **Verificar** (desabilitado sem resposta; Enter funciona) → faixa de feedback verde/vermelha (`aria-live="assertive"`) com resposta correta + `explanation` → **Continuar**. Botão fechar pede confirmação.

## 7. Repetição espaçada (`src/domain/srs/`) — SM-2 adaptado

Um `SrsCard` por item (vocab ou frase) que o aluno já viu.

```ts
type SrsCard = {
  itemId: string;
  ease: number;
  intervalDays: number;
  reps: number;
  lapses: number;
  dueDay: string /* YYYY-MM-DD */;
  lastReviewDay: string;
};
```

Nota `q` a partir do resultado agregado do item na sessão:
`5` acertou de primeira sem "quase" · `4` acertou com "quase" · `2` errou e acertou na repetição · `1` errou e não acertou.

```
se q < 3:  reps = 0; lapses++; interval = 1
senão:     reps++; interval = reps==1 ? 1 : reps==2 ? 3 : round(interval * ease)
ease = max(1.3, ease + 0.1 − (5−q)·(0.08 + (5−q)·0.02))   // inicial 2.5
interval = min(interval, 180);  dueDay = hoje + interval
```

Um item conta como **"palavra aprendida"** quando `reps ≥ 1` e `intervalDays ≥ 3` (usado no perfil e nas conquistas). **Praticar** monta uma lição de 12 exercícios a partir dos cards com `dueDay ≤ hoje` (mais atrasados e com mais lapsos primeiro); se houver menos de 4 vencidos, completa com os de menor `ease`. Exercícios gerados por `src/domain/practice/generate.ts` (múltipla escolha, pares, word-bank, digitação, ouvir).

## 8. Gamificação (`src/domain/gamification/`)

| Regra                              | Valor                                                                                                                                                                                        |
| ---------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| XP lição normal                    | 10                                                                                                                                                                                           |
| Bônus lição perfeita (nenhum erro) | +5                                                                                                                                                                                           |
| Bônus combo                        | +1 a cada 5 acertos seguidos, máx. +5 por lição                                                                                                                                              |
| XP prática (Praticar)              | 8 (+5 se perfeita)                                                                                                                                                                           |
| XP revisão da unidade              | 15 (+5 se perfeita)                                                                                                                                                                          |
| Nivelamento                        | 0 XP                                                                                                                                                                                         |
| Corações                           | máx. 5; −1 por erro em lição normal; +1 a cada **4 h** (calculado de forma preguiçosa a partir de `heartsUpdatedAt`); concluir uma prática dá **+1**                                         |
| Sem corações                       | lição para na tela "Sem corações" com Tuca triste: opções **Praticar para ganhar coração** ou **Esperar** (mostra tempo até o próximo)                                                       |
| Ofensiva                           | +1 no primeiro dia (fuso local) em que conclui ≥ 1 lição/prática                                                                                                                             |
| Congelar ofensiva                  | ganha 1 a cada 100 XP acumulados; máx. 2 guardados; se o último dia ativo foi anteontem (1 dia perdido) e há congelamento, consome 1 e a ofensiva continua; 2+ dias perdidos → ofensiva zera |
| Meta diária                        | 10 / 20 / 30 / 50 XP (padrão 20); anel de progresso na trilha; atingir mostra celebração 1×/dia                                                                                              |

**Ofensiva — regras exatas** (`streak.ts`, Fase 5): `gap = diffDays(hoje, lastActiveDay)` em `dayKey` local. Sem dia anterior → 1 · `gap 0` → igual · `gap 1` → +1 · `gap 2` com congelamento → gasta 1 e +1 · `gap 2` sem congelamento ou `gap ≥ 3` → 1 (congelamentos não são gastos) · `gap < 0` (relógio/fuso voltou) → nada muda. Congelamento é gasto antes de somar o XP da lição; com 2 guardados `xpTowardFreeze` fica 0. Só `lesson`/`review`/`practice` contam (nivelamento não). Consumo é preguiçoso: abrir o app não grava; a trilha mostra `displayStreak` (0 se a ofensiva já se perdeu). Meta: celebra quando `xpHoje ≥ meta` e `lastGoalCelebratedDay ≠ hoje`.

**Conquistas** (lista inicial, declarativa — cada uma é `{ id, title, description, icon, check(stats) }`):
primeira lição · lição perfeita · 3 / 7 / 30 dias de ofensiva · 50 / 100 / 250 palavras aprendidas · 1ª unidade concluída · meta diária batida 7 vezes · 500 / 1000 XP · madrugador (lição antes das 8h) · persistente (voltou após perder todos os corações).

## 9. Voz, som, vibração e fallbacks (`src/services/`)

- **TTS**: escolhe voz `en-US` (preferência por vozes locais/"natural"); velocidades 1.0 e 0.6 (botão tartaruga). Sem `speechSynthesis` ou sem voz inglesa → `listen-type` vira `translate-typing` da mesma frase e o botão de ouvir some.
- **STT**: `SpeechRecognition`/`webkitSpeechRecognition`, `lang='en-US'`, `maxAlternatives=5`. Sem suporte, permissão negada ou botão **"Não posso falar agora"** → exercícios `speak` são pulados por 1 hora (contam como neutros, sem XP nem perda de coração).
- **Som**: Web Audio API (acerto, erro, conclusão, combo) — desativável; respeita o mudo.
- **Vibração**: `navigator.vibrate` quando existir — desativável.
- **Notificações**: lembrete diário no horário escolhido via `Notification` + agendamento no service worker quando o app é aberto (limitação: navegadores sem Notification Triggers só notificam se o app/SW estiver ativo — documentar no README). Pedido de permissão só por ação do usuário em Configurações.

## 10. Tempo (`src/services/clock.ts`)

Toda regra usa `clock.now()`. Em produção = `Date.now()`. Em testes/E2E (build com `VITE_E2E=1` ou modo dev), `window.__falae.setNow(iso)` e `advanceDays(n)` permitem simular datas. `dayKey(date)` usa o fuso local (`YYYY-MM-DD`). Isso viabiliza testar ofensiva, congelamento e recarga de corações.

## 11. Persistência

### Interface

```ts
interface Repository {
  getProfile(): Promise<Profile>;
  saveProfile(p: Profile): Promise<void>;
  getSettings(): Promise<Settings>;
  saveSettings(s: Settings): Promise<void>;
  getLessonProgress(): Promise<LessonProgress[]>;
  // Atômico: resultado + progresso + XP do dia + profile + SRS + conquistas.
  // `o.apply(ctx)` (função pura) roda DENTRO da transação sobre profile/conquistas/daily/progresso
  // relidos do banco, para que duas abas ou uma store desatualizada nunca sobrescrevam dados.
  // Conquista já liberada nunca é regravada. Run repetido (mesmo result.id) → { applied: false }.
  recordLessonResult<M>(o: LessonOutcome<M>): Promise<CommitResult<M>>;
  getRecentResults(limit: number): Promise<LessonResult[]>;
  getSrsCards(): Promise<SrsCard[]>;
  upsertSrsCards(c: SrsCard[]): Promise<void>;
  getDailyStats(fromDay: string, toDay: string): Promise<DailyStats[]>;
  getAchievements(): Promise<UnlockedAchievement[]>;
  unlockAchievements(a: UnlockedAchievement[]): Promise<void>;
  exportAll(): Promise<ExportFile>;
  importAll(f: ExportFile): Promise<void>; // substitui tudo, em transação
  resetAll(): Promise<void>;
}
```

### Modelos persistidos

```ts
type Profile = {
  id: 'me';
  createdAt: string;
  onboardingDone: boolean;
  placement?: { score: number; skippedUnit1: boolean };
  totalXp: number;
  hearts: number;
  heartsUpdatedAt: string;
  streak: {
    current: number;
    longest: number;
    lastActiveDay?: string;
    freezes: number;
    xpTowardFreeze: number;
  };
  lastGoalCelebratedDay?: string;
};
type Settings = {
  id: 'me';
  dailyGoalXp: 10 | 20 | 30 | 50;
  sound: boolean;
  haptics: boolean;
  theme: 'system' | 'light' | 'dark';
  reminder: { enabled: boolean; time: 'HH:MM' };
  speakDisabledUntil?: string;
};
type LessonProgress = {
  lessonId: string;
  completedCount: number;
  bestAccuracy: number;
  firstCompletedAt: string;
};
type LessonResult = {
  id: string;
  lessonId: string;
  kind: 'lesson' | 'review' | 'practice' | 'placement';
  day: string;
  finishedAt: string;
  xp: number;
  accuracy: number;
  durationMs: number;
  mistakes: number;
  perfect: boolean;
  itemOutcomes: { itemId: string; q: number }[];
};
type DailyStats = { day: string; xp: number; lessons: number; goalMet: boolean };
type UnlockedAchievement = { id: string; unlockedAt: string };
```

### Dexie (`db.ts`, versão 1)

`profile: 'id'` · `settings: 'id'` · `lessonProgress: 'lessonId'` · `results: 'id, day, lessonId, finishedAt'` · `srs: 'itemId, dueDay'` · `daily: 'day'` · `achievements: 'id'` · `quarantine: '++id'`.

`LessonOutcome = { result, profile, srsCards, newAchievements, dailyGoalXp }`. Toda escrita é validada com Zod antes da transação. Linhas corrompidas de `profile`/`settings` são movidas para `quarantine` (com as issues) e o app segue com os padrões — progresso nunca é apagado em silêncio.
Migrações futuras com `db.version(n).upgrade(...)` e teste de migração obrigatório.

### Exportar/Importar

Arquivo `falae-progresso-AAAA-MM-DD.json` = `{ app: 'falae', schemaVersion: 1, exportedAt, data: {...todas as tabelas} }`. Import valida com Zod, mostra resumo (XP, ofensiva, data) e pede confirmação antes de substituir. Arquivo inválido → mensagem clara, nada é alterado.

## 12. Progressão e trilha (`src/domain/progression/`)

- Desbloqueio linear: lição N+1 da habilidade abre após concluir a N; habilidade seguinte abre quando a anterior ganha a **coroa** (3 lições concluídas); **revisão da unidade** abre com as 4 coroas; a próxima unidade abre ao concluir a revisão.
- Lições concluídas podem ser refeitas (dão XP e alimentam SRS).
- **Nivelamento** (opcional, no onboarding): 15 exercícios do conteúdo da unidade 1 (sem corações, sem feedback de certo/errado até o fim). ≥ 80% → unidade 1 marcada como "testada" (todas as lições contam como concluídas, sem coroas de ouro) e unidade 2 desbloqueada; os itens da unidade 1 entram no SRS com intervalo inicial de 3 dias.
- Estado da trilha é **derivado** (`computePathState(course, lessonProgress, placement)`) — nunca persistido. Como `domain` não importa `content`, recebe um tipo estrutural mínimo (`PathCourseInput`: unidades → habilidades → ids de lições + revisão). Lição concluída nunca volta a ficar bloqueada (progresso importado fora de ordem vence). Lição bloqueada aberta por URL → redireciona para `/` com aviso.

## 13. Telas e rotas

| Rota               | Tela                                                                                                                               |
| ------------------ | ---------------------------------------------------------------------------------------------------------------------------------- |
| `/boas-vindas`     | Onboarding: Tuca se apresenta → escolhe meta diária → "Sou iniciante" ou "Fazer teste de nível"                                    |
| `/nivelamento`     | Teste de nível                                                                                                                     |
| `/`                | **Trilha**: cabeçalho (ofensiva 🔥, XP, corações, anel da meta), unidades com nós em caminho sinuoso, botão da dica por habilidade |
| `/dica/:skillId`   | Dica de gramática                                                                                                                  |
| `/licao/:lessonId` | Lição (tela cheia, sem barra inferior) → tela de fim (XP, precisão, tempo, ofensiva, Tuca comemorando)                             |
| `/praticar`        | Praticar (itens vencidos; contador; botão iniciar)                                                                                 |
| `/perfil`          | XP total, palavras aprendidas, ofensiva atual/recorde, gráfico 7 dias, conquistas                                                  |
| `/config`          | Som, vibração, meta, tema, lembrete, exportar/importar, redefinir progresso (confirmação dupla)                                    |

Barra inferior (celular) / lateral (desktop ≥ 1024px): Trilha · Praticar · Perfil · Configurações. Primeiro acesso redireciona para `/boas-vindas`.

## 14. Acessibilidade e desempenho

- Navegação completa por teclado (banco de palavras e pares incluídos; atalhos 1–4 para opções; Enter verifica/continua).
- Contraste AA nos dois temas; foco visível com anel Anil/Manga; alvos ≥ 44px; cor nunca é o único sinal (ícone ✓/✗ + texto).
- `aria-live` para feedback; `lang="en"` nos trechos em inglês (leitores de tela pronunciam certo).
- `prefers-reduced-motion`: animações viram fades curtos; confete desligado.
- Meta Lighthouse ≥ 90 (PWA, acessibilidade, desempenho): code-splitting por rota, fontes subset latin, conteúdo JSON pequeno, sem imagens pesadas (emoji + SVG).

## 15. Estratégia de testes

- **Unitários (Vitest)**: tudo em `src/domain/` (corretor com casos extensos: acentos, maiúsculas, pontuação, contrações, números, "quase certo", padrões `(x)`/`[a|b]`), SRS, XP, ofensiva com congelamento e fuso, corações com recarga, desbloqueio, nivelamento, export/import, `DexieRepository` com `fake-indexeddb`.
- **Componentes (Testing Library)**: cada tipo de exercício (mouse + teclado), LessonPlayer, feedback `aria-live`.
- **Conteúdo**: teste que carrega todas as unidades reais e falha se o schema reprovar.
- **E2E (Playwright, mobile + desktop)**: jornada completa da Fase 7 (novo usuário → nivelamento → 3 lições → perder corações → praticar → avançar 1 dia com clock simulado → ofensiva), offline após 1º carregamento, persistência após recarregar, export/import.
- **Screenshots** (`npm run screenshots`): telas-chave em 390×844 e 1280×800, claro/escuro, para o `revisor-ux`.

## 16. Fluxo de trabalho com agentes e portões

| Fase                   | Produz            | Verifica (em paralelo quando possível)                              | Portão                                    |
| ---------------------- | ----------------- | ------------------------------------------------------------------- | ----------------------------------------- |
| 1 Planejamento         | arquiteto         | **usuário**                                                         | aprovação do usuário                      |
| 2 Base                 | desenvolvedor     | revisor-de-codigo + qa-tester; revisor-ux (tokens, mascote)         | 0 bloqueantes; lint/typecheck/test verdes |
| 3 Motor de lição       | desenvolvedor     | revisor-de-codigo + qa-tester; revisor-ux                           | idem + testes do corretor                 |
| 4 Conteúdo             | autor-de-conteudo | revisor-linguistico (ciclo até APROVADO)                            | schema ok + APROVADO                      |
| 5 Trilha e gamificação | desenvolvedor     | revisor-de-codigo + qa-tester; revisor-ux                           | idem                                      |
| 6 SRS, perfil, config  | desenvolvedor     | revisor-de-codigo + qa-tester; revisor-ux                           | idem                                      |
| 7 Polimento e QA final | todos             | qa-tester (E2E completo), revisor-ux, revisor-de-codigo, Lighthouse | critérios de pronto                       |

Cada fase começa com `docs/fases/FASE-N.md` (arquiteto) e termina com commit(s) e resumo ao usuário. Antes das telas (Fase 2), consultar as skills de design disponíveis (`audit-suite:emil-design-engineering`, `make-interfaces-feel-better`, `web-design-guidelines`, `web-animation-design`) para fixar a direção visual.
