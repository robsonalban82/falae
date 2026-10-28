# Fase 4 — Conteúdo

**Objetivo:** 4 unidades A1 completas em `src/content/units/`, validadas pelo schema e aprovadas pelo `revisor-linguistico`.

**Fluxo:** `autor-de-conteudo` (um por unidade, em paralelo) escreve seguindo `.claude/skills/criar-licao/SKILL.md` → `revisor-linguistico` revisa com `.claude/skills/revisar-licao/SKILL.md` → autor corrige → revisor confirma (até `APROVADO`).

**Formato:** um arquivo por unidade; 4 habilidades × 3 lições (10–15 exercícios cada) + 1 revisão de 15 exercícios. Ids com prefixo da unidade: `u1-…`, lições `u1-sk1-l1`, revisão `u1-review`. Cada exercício `u1-sk1-l1-e01`.

## Roteiro

### u01-cumprimentos.json — Cumprimentos e apresentações (`manga`)

1. **Olá e tchau** — hi, hello, good morning/afternoon/evening, good night (despedida!), bye, see you (later/tomorrow).
2. **Meu nome é…** — I'm…, my name is…, what's your name?, nice to meet you (too), this is… (apresentar alguém).
3. **De onde você é?** — I'm from…, where are you from?, Brazil/Brazilian, the US/American, Portugal, Mexico; verbo _be_ (am/is/are). Foco: `verbo-be`, `pronome`.
4. **Como vai?** — how are you?, I'm fine/good/great/tired, thanks/thank you, please, sorry, excuse me. Falso cognato: **actually** (= na verdade, não "atualmente").

### u02-familia.json — Família, números e idade (`anil`)

1. **Família** — mother/mom, father/dad, brother, sister, son, daughter, wife, husband. Falso cognato: **parents** (= pais, não "parentes" → _relatives_).
2. **Números 0–20** — contar, telefone, "How many…?". Plural regular (`plural`).
3. **Números até 100 e idade** — twenty…one hundred; How old are you? **I'm 30 (years old)**. Foco: `idade-com-be` (❌ I have 30 years), `numeros`, `th` (thirteen/thirty/three).
4. **Descrevendo pessoas** — tall, short, young, old, nice, funny; his/her; **ordem dos adjetivos** antes do substantivo (my little sister, a big black dog). Foco: `ordem-adjetivo`.

### u03-comida.json — Comida, bebida e restaurante (`folha`)

1. **Comida** — bread, cheese, egg, rice, beans, apple, banana, chicken; a/an (`artigo`), plural.
2. **Bebidas** — water, coffee, tea, juice, milk; I'd like…, Can I have…? Vogal longa/curta: **eat × it**, **tea**/**tip** (`vogal-longa-curta`).
3. **No restaurante** — table for two, the menu, the check, to go/for here, a reservation; **make × do** (make a reservation). Falso cognato: **push** (= empurrar, não "puxar"), em placa de porta.
4. **Gostos** — I like / I don't like, Do you like…? Yes, I do / No, I don't; she likes. Foco: `presente-simples`, `pergunta-do`.

### u04-rotina.json — Rotina diária e horas (`acerola`)

1. **Que horas são?** — What time is it? It's seven (o'clock), seven thirty, half past seven, at noon, at midnight. Foco: `horas`, `in-on-at` (at 7).
2. **Minha rotina** — wake up, get up, take a shower, have breakfast, go to work/school, go to bed. Presente simples com rotina (I/he).
3. **Dias e períodos** — Monday…Sunday; **on** Monday, **in** the morning, **at** night; th em **Thursday**. Foco: `in-on-at`, `th`.
4. **Ontem** (ponte para A2) — passado regular: worked, watched, played, studied, cooked; **make × do** (do homework, make dinner); pronúncia do **-ed** (worked /t/, played /d/, wanted /ɪd/). Foco: `ed-final`, `make-do`. Falso cognato: **pretend** (= fingir, não "pretender").

## Critérios de aceite

- `npm run validate:content` passa: 4 unidades, 0 erros.
- Cada lição tem ≥ 4 tipos de exercício, ≤ 4 palavras novas, ≤ 2 `listen-type`, ≤ 1 `speak` a cada 5.
- Cada foco listado aparece com `explanation`; cada habilidade tem `tip` com ❌/✅.
- `revisor-linguistico`: `APROVADO` em todas as unidades.
- Teste automático que carrega o conteúdo real sem erros (`npm test`).
