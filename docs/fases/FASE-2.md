# Fase 2 — Base

**Objetivo:** projeto rodando com toda a fundação: build, PWA, estilo, qualidade, testes, schema de conteúdo, persistência, tempo simulável, design tokens e mascote.

## Tarefas

1. Projeto Vite + React + TS strict; `vite-plugin-pwa` (manifest PT-BR, ícones, precache, `navigateFallback`); `react-router` com rotas vazias da §13.
2. Tailwind v4 com tokens em CSS variables (`src/styles/tokens.css`), temas claro/escuro (`system | light | dark`), fontes via `@fontsource`.
3. ESLint (typescript-eslint, react-hooks, jsx-a11y) + Prettier; scripts `lint`, `typecheck`, `test`, `e2e`, `validate:content`, `screenshots`.
4. Vitest + Testing Library + `fake-indexeddb`; Playwright com projetos `mobile` (390×844) e `desktop`.
5. `src/content/schema.ts` completo (§4) + `src/domain/grading/patterns.ts` (expansão `(x)`/`[a|b]`) + `loader.ts` + `scripts/validate-content.ts`; uma unidade de **fixture** só para testes (`src/test/fixtures/`), sem conteúdo real (é da Fase 4).
6. `src/services/clock.ts` + `src/domain/time.ts` (`dayKey`, `addDays`, `diffDays`).
7. `src/data/`: interface `Repository`, `db.ts` (Dexie v1), `DexieRepository`, `exportImport.ts` com Zod.
8. Mascote `Tuca` (SVG + estados com Framer Motion, `useReducedMotion`) e componentes base: `Button`, `ProgressBar`.
9. Página temporária `/` mostrando tokens, botões e os 5 estados do Tuca (vitrine para o revisor-ux; substituída na Fase 5).

## Critérios de aceite

- `npm run lint`, `typecheck`, `test`, `e2e`, `build` verdes.
- Schema rejeita fixtures inválidas com mensagem útil; padrões expandem corretamente e respeitam o limite.
- Repository: salvar/ler/exportar/importar/resetar testados com `fake-indexeddb`; import inválido não altera nada.
- Tokens com contraste AA nos dois temas.
- Revisores: `revisor-de-codigo` + `qa-tester` (paralelo) e `revisor-ux` (tokens + mascote) sem bloqueantes.
