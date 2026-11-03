# Falaê — convenções do projeto

PWA gamificado para brasileiros aprenderem inglês (A1→A2). Arquitetura completa em `docs/ARQUITETURA.md` — leia antes de mudar qualquer coisa estrutural.

## Idioma

- Converse com o usuário em **português do Brasil**.
- Código (nomes de variáveis, funções, arquivos, commits) em **inglês**. Comentários curtos, em inglês.
- Textos de interface **só** em `src/i18n/pt-BR.ts`, nunca literais em componentes. Tom: amigável, direto, "você".
- Conteúdo de estudo em inglês americano, em `src/content/units/*.json`.

## Stack (não trocar sem aprovação do usuário)

React 19 + TypeScript strict + Vite · vite-plugin-pwa · react-router · Tailwind v4 · Framer Motion · Zustand · Dexie · Zod · Web Speech API · Vitest + Testing Library · Playwright · ESLint + Prettier.

## Comandos

```
npm run dev               # servidor local
npm run lint              # ESLint
npm run typecheck         # tsc --noEmit
npm test                  # Vitest (unidade + componentes + conteúdo)
npm run e2e               # Playwright (mobile 390x844 + desktop)
npm run validate:content  # valida src/content com o schema Zod
npm run screenshots       # capturas para o revisor-ux
```

## Regras de código

- Regras de negócio (corretor, SRS, XP, ofensiva, corações, desbloqueio, motor de lição) são **funções puras em `src/domain/`**, com teste ao lado (`foo.ts` + `foo.test.ts`). `domain` não importa React, Dexie nem `content`.
- Tempo: nunca `Date.now()`/`new Date()` em regra de negócio — use `clock` (`src/services/clock.ts`) e `dayKey()` (fuso local).
- Persistência só via `Repository` (`src/data/repository.ts`); componentes não importam Dexie. Mudou tabela Dexie → nova versão + migração + teste.
- Tipos de conteúdo são **inferidos do Zod** (`z.infer`), não escritos à mão. Nenhum conteúdo inválido é carregado.
- Sem `any`; `as`/`!` só com comentário justificando.
- Componentes: função + hooks, um componente por arquivo, `PascalCase.tsx`; hooks `useAlgo.ts`; demais arquivos `camelCase.ts`.
- Estilo: classes Tailwind usando os tokens (`bg-surface`, `text-ink`, `bg-manga`…); nada de cor hex solta em componente.
- Acessibilidade obrigatória: teclado, rótulos, foco visível, `aria-live` no feedback, `lang="en"` em trechos em inglês, `useReducedMotion()`.
- Identidade original: nada de nome, mascote (coruja), cores, sons ou textos do Duolingo.

## Agentes e portões de qualidade

Agentes em `.claude/agents/`, skills em `.claude/skills/`. **Ninguém aprova o próprio trabalho.**

- Conteúdo: `autor-de-conteudo` → `revisor-linguistico` → correção → reconfirmação. Mapas, bancos, coleções e plano: `revisor-linguistico` + `pedagogo` em paralelo; cenas SVG e visual de mapas/cartas/PDF: `designer-de-mapas`.
- Mapas e cartas: conteúdo novo só em `src/content/` (mapas em `mindmaps/`, bancos em `banks/`, cenas em `art/`). `prototipo/` está congelado; guia das cenas em `docs/ESTILO-CENAS.md`.
- Código: `desenvolvedor` → `revisor-de-codigo` + `qa-tester` (em paralelo) → correção → nova verificação.
- Interface: `revisor-ux` com screenshots (390×844 e desktop) ao fim de cada fase visual.
- **Modelo por agente** (economia de tokens): cada agente define `model:` no frontmatter — `opus` para `arquiteto` e `revisor-de-codigo` (decisões estruturais e portão de qualidade), `sonnet` para os demais (incluindo `designer-de-mapas` e `pedagogo`). **Sempre passe `model` explicitamente ao delegar** — o frontmatter sozinho não foi respeitado. O agente principal pode sobrescrever com o parâmetro `model` ao delegar: `haiku` para tarefas mecânicas (buscas, renomear, rodar comandos e resumir saída, conferir checklist simples); `opus` quando a tarefa for difícil (bug sutil, refatoração grande, revisão de dados persistidos). Portões de revisão (`revisor-de-codigo`, `revisor-linguistico`, `revisor-ux`) nunca descem para `haiku`. Na dúvida, fique no padrão do agente.
- Severidades: **bloqueante / importante / sugestão**. Fase só avança com 0 bloqueantes e lint/typecheck/test/e2e verdes.
- Cada fase tem plano em `docs/fases/FASE-N.md`; decisões em `docs/DECISOES.md`.

## Git

Commits pequenos, em inglês, no imperativo (`feat: add answer normalizer`), ao fim de cada etapa aprovada. Prefixos: `feat`, `fix`, `content`, `test`, `docs`, `chore`, `refactor`.

## Perguntar antes

Mudar stack, mudar modelo de dados persistido ou formato do conteúdo, remover funcionalidade do escopo, adicionar dependência pesada.
