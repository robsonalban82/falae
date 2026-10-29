# Fase 7 — Polimento e QA final

**Objetivo:** deixar o Falaê pronto para publicar: bundle inicial pequeno (code-splitting de rotas e do conteúdo), Lighthouse mobile ≥ 90 em desempenho, acessibilidade, boas práticas e instalabilidade, medido por script reproduzível; E2E da jornada completa da §15 (incluindo offline, recarga, backup e instalação); pendências de voz, corretor e corações fechadas; auditoria axe em todas as telas nos dois temas; README, ROADMAP e checklist de pronto.

**Sem mudança no modelo persistido.** Dexie continua na versão 1, `EXPORT_SCHEMA_VERSION` continua 1 e o formato de `src/content/units/*.json` não muda. Muda só **como** o conteúdo é carregado (assíncrono, por unidade) — interface do `loader`, não dados.

## Decisões desta fase

- **Conteúdo carregado sob demanda** (ADR-012, proposta): `loader.ts` troca `import.meta.glob(..., { eager: true })` por glob **lazy**; um índice leve (`src/content/manifest.ts`, gerado ou escrito à mão e validado em teste) traz ids, títulos, ordem de unidades/habilidades/lições e contagem de itens — o suficiente para desenhar a trilha. O JSON completo da unidade só é importado (e validado com Zod) ao abrir lição, dica, prática ou nivelamento. O precache do service worker continua incluindo todos os chunks de unidade (offline completo depois da primeira visita).
- **Rotas**: Trilha (`PathScreen`) continua no chunk principal (é a primeira tela); `PracticeScreen` passa a `lazy` como as demais. Zod, Dexie e Motion: avaliar `manualChunks` (vendor separado, cache longo) em vez de cortar funcionalidade.
- **Medição reproduzível**: `npm run lighthouse` = `vite build` + `vite preview --port 4174` (4173 é do Playwright, que reaproveita servidor aberto) + Lighthouse (`lighthouse@13.6.0`) via `npx` (versão fixada no script), preset mobile, 3 execuções, **mediana** por categoria. Sem dependência nova no `package.json` (padrão). Ver "Decisões que precisam do usuário" 1.
- **PWA no Lighthouse**: a categoria "PWA" foi removida do Lighthouse 12+. Instalabilidade é verificada por E2E (manifest, ícones, SW ativo, `start_url` offline) e pelo audit `installable-manifest` quando disponível; não é nota numérica.
- **axe**: `@axe-core/playwright` (devDependency, ~1 MB, sem binário nativo) — leve o bastante; ver decisão 2 por ser dependência nova.

## Tarefas

### 1. Code-splitting e orçamento de bundle

Arquivos: `src/content/loader.ts`, `src/content/manifest.ts` (novo) + `manifest.test.ts`, `src/stores/*` que hoje leem o conteúdo síncrono (`useLessonContent`, `usePractice`, `useProgress` etc.), `src/app/router.tsx`, `vite.config.ts`, `scripts/check-prod-bundle.ts`.

```ts
// loader.ts (nova interface)
export function getCourseManifest(): CourseManifest; // síncrono, leve
export function loadUnit(unitId: string): Promise<Unit>; // import dinâmico + Zod; cache em memória
export function loadItemIndex(unitIds: readonly string[]): Promise<ItemIndex>; // para Praticar/distratores
```

- `manifest.test.ts`: o manifesto bate com o conteúdo real (ids, ordem, contagens). Divergência = teste vermelho (evita manifesto desatualizado ao adicionar lição). Se for gerado por script, `validate:content` também regenera/confere.
- Conteúdo inválido continua não carregando: `loadUnit` rejeita com erro tipado; a tela mostra estado de erro (texto i18n) em vez de travar.
- Telas que aguardam `loadUnit` mostram esqueleto (sem piscar), já usado no perfil.
- `PracticeScreen` vira `lazy`.
- `check-prod-bundle.ts` ganha **orçamento**: chunk de entrada ≤ **250 kB** minificado (≈ 80 kB gzip) e nenhum chunk > 300 kB, e **JS inicial (entrada + modulepreload) ≤ 260 kB gzip** (ADR-013); falha o `build` se estourar. Imprime tabela de tamanhos (minificado e gzip).
- `domain` continua sem importar `content` (a mudança é só no `loader`/stores).

### 2. Lighthouse reproduzível

Arquivos: `scripts/lighthouse.ts` (novo), `package.json` (script `lighthouse`), `.gitignore` (`lighthouse-reports/`).

- Fluxo: build de produção (sem `VITE_E2E`) → `vite preview` → espera a porta → `npx --yes lighthouse@<versão fixa> http://localhost:4174/ --preset=` mobile (padrão: emulação Moto G Power, throttling simulado) `--only-categories=performance,accessibility,best-practices --output=json,html` 3× → mediana → imprime tabela e falha (exit 1) se alguma categoria < 90.
- Rodar também com perfil já semeado (trilha com progresso) via `?` não é possível sem servidor; aceitável medir a primeira visita (pior caso: redireciona a `/boas-vindas`). Medir **`/`** e **`/boas-vindas`**.
- Relatórios em `lighthouse-reports/` (fora do git). Valores medidos colados no PR da etapa.
- Exige Chrome instalado localmente (o Playwright já baixa Chromium; o script aponta `CHROME_PATH` para ele se não houver Chrome).

### 3. E2E da jornada completa (§15)

Arquivos: `e2e/journey.spec.ts` (novo), `e2e/offline.spec.ts`, `e2e/install.spec.ts`, helpers em `e2e/helpers/`.

Usar `window.__falae` (clock simulado, `advanceDays`, `importForTest`) já existente. Um único teste longo e encadeado (`test.describe.serial`), mobile 390×844 e desktop:

1. Banco vazio → `/` redireciona para `/boas-vindas` → meta 20 → "Já sei um pouco" → nivelamento **reprovado** (para seguir na unidade 1).
2. Concluir **3 lições** seguidas; conferir XP no cabeçalho, meta do dia batida e ofensiva = 1.
3. Errar até zerar os corações → tela "Sem corações" → "Praticar e ganhar coração" → concluir → "+1 coração" → trilha com 1 coração.
4. `/praticar` → praticar com itens vencidos.
5. `advanceDays(1)` → concluir 1 lição → ofensiva = 2; `/perfil` mostra a semana com 2 dias.
6. **Persistência**: `page.reload()` em três pontos (trilha, meio de lição, perfil) → estado igual; meio de lição mantém exercício atual.
7. **Export/import**: exportar (capturar download) → redefinir → importar o arquivo → XP, ofensiva, lições, conquistas e cards iguais ao exportado (comparar `exportAll()` antes/depois, ignorando `exportedAt`).

`offline.spec.ts` (build de produção com SW, `vite preview`, só Chromium):

- Primeira visita online, espera `navigator.serviceWorker.ready` e o precache → `context.setOffline(true)` → recarregar `/`, abrir lição de outra unidade desbloqueada, concluir, ir a `/perfil` e `/config` → tudo funciona; nenhuma requisição de rede falha visível.
- Rota profunda offline (`/licao/...`) recarregada → SPA fallback do SW serve o `index.html`.

`install.spec.ts`:

- `GET /manifest.webmanifest`: `name`, `short_name`, `start_url`, `scope`, `display: standalone`, `theme_color`, `background_color`, `lang: pt-BR`, ícones 192 e 512 (+ `maskable`) que respondem 200 com o tamanho declarado (ler dimensões do PNG).
- `<link rel="manifest">`, `<meta name="theme-color">`, `apple-touch-icon` presentes.
- SW registrado e `controller` não nulo após recarregar.

### 4. Pendências

Arquivos: `src/services/speech.ts` (+ teste), `src/domain/grading/*` (+ teste), `src/stores/useProfile.ts` / `src/features/lesson/sessionStore.ts`, `e2e/lesson.spec.ts`, `src/ui/tuca/*`, `src/ui/ConfirmDialog.tsx`, `src/features/practice/*`, `e2e/fixtures/*`, `src/i18n/pt-BR.ts`.

1. **TTS escolhe voz inglesa**: `getVoices()` costuma vir vazio na primeira chamada (Chrome). `pickEnglishVoice(voices)` — função pura testada: prefere `en-US` local → `en-US` qualquer → `en-*` → `undefined` (aí usa só `lang = 'en-US'`). Lista atualizada no evento `voiceschanged` (listener único, removido no teardown); `speak()` antes das vozes carregarem usa `lang` e não espera. Teste com `speechSynthesis` falso disparando `voiceschanged` depois.
2. **"Quase" em números por extenso**: hoje `seven` × `7` ou `twelve` × `12` pode cair em "quase"/erro. Regra: normalizar números 0–100 (e ordinais simples se já aparecerem no conteúdo) para a mesma forma **antes** da comparação, nos dois sentidos, só quando a resposta aceita contém o número. Função pura `normalizeNumbers(text)` em `domain/grading`, com tabela de testes (`I have 7 apples` = `I have seven apples`; `twenty-one` = `21` = `twenty one`; não mexe em `seventh` se não suportado). Não altera ADR-004.
3. **Corrida de corações ao recarregar logo após erro** (`test.fixme` em `e2e/lesson.spec.ts:514`): o gasto do coração deve ser gravado **antes** de mostrar o feedback de erro (ou a gravação é aguardada antes de liberar "Continuar"), e a sessão no `sessionStorage` guarda `heartsSpentPending` para reaplicar ao restaurar. Usar `repository.updateProfile` (transação) em `spendHeart`, trocando a gravação de profile possivelmente desatualizado (pendência opcional da Fase 6). Remover o `fixme`; teste passa 20× seguidas (`--repeat-each=20`).
4. **Poses de asa do Tuca com reduced motion**: com `useReducedMotion()`, trocas de pose são instantâneas (sem tween de asa), sem perder a pose final. Teste de componente com reduced motion mockado.
5. **Sugestões abertas**:
   - `ConfirmDialog` de redefinição: contador/indicação clara de por que o botão está travado ("Digite APAGAR para liberar"), ligado por `aria-describedby`.
   - Erros de importação/backup com `role="alert"`; sucessos continuam `aria-live="polite"` (não duplicar anúncio).
   - Fim de prática com muitas conquistas: lista rolável com no máximo 3 visíveis + "e mais N" (sem empurrar o botão Continuar para fora da tela em 390×844).
   - Fixture do import nos E2E coerente (XP total = soma dos resultados, ofensiva compatível com `daily`, cards de itens existentes).
   - Texto "No arquivo" → "No backup" no resumo de importação (`pt-BR.ts`).
6. **Revisar todos os `test.skip`/`test.fixme`**: hoje `e2e/qa-phase2.spec.ts:173` e `e2e/lesson.spec.ts:753` (skip por projeto — legítimos, manter com motivo) e `lesson.spec.ts:514` (fixme — resolver no item 3). Critério: no fim da fase, nenhum `fixme`/`only`; todo `skip` tem motivo de plataforma. Regra de lint (`no-restricted-syntax` ou grep no `scripts/`) que barra `test.only` e `test.fixme`.

### 5. Auditoria de acessibilidade

Arquivos: `e2e/a11y.spec.ts` (novo), `package.json` (devDependency `@axe-core/playwright`, sujeito à decisão 2).

- Telas: trilha (vazia e com progresso), dica, lição (cada tipo de exercício, estado de feedback certo/errado/quase), sem corações, fim de lição, praticar (com e sem vencidos), sessão de prática, perfil, ajustes (com diálogos de importar e redefinir abertos), boas-vindas (3 passos), nivelamento (pergunta e resultado), 404.
- Cada tela em **claro e escuro**, mobile e desktop. Regras WCAG 2.1 A/AA (`withTags(['wcag2a','wcag2aa','wcag21a','wcag21aa'])`).
- Critério: **0 violações** `serious`/`critical`; `moderate` listadas no relatório para o revisor-ux decidir. Exceções só com `exclude` comentado e justificado no spec.
- Complementar à mão (axe não pega): navegação só por teclado na jornada, ordem de foco, `lang="en"` nos trechos em inglês, leitor de tela (VoiceOver no iPhone ou NVDA) em lição e perfil — checklist no PR.
- Se a decisão 2 for negada: injetar `axe-core` via `page.addScriptTag` a partir de CDN fixado — pior (rede no teste), por isso não é o padrão.

### 6. README

Arquivo: `README.md` (raiz — exceção: o desenvolvedor escreve; o arquiteto só especifica aqui).

Seções, em português:

1. **O que é** o Falaê (público, nível A1→A2, offline, sem conta, dados só no aparelho).
2. **Como rodar**: Node (versão do `engines`/`.nvmrc`), `npm ci`, `npm run dev`, `npm run dev:demo`.
3. **Scripts**: tabela com todos os do `package.json` (incluindo `lighthouse`, `screenshots`, `validate:content`, `e2e`) e quando usar.
4. **Como adicionar lições**: formato em `src/content/units/*.json`, referência à skill `.claude/skills/criar-licao`, fluxo autor → revisor linguístico, `npm run validate:content`, manifesto (tarefa 1) e testes de conteúdo.
5. **Deploy** (PWA estática, pasta `dist/`):
   - HTTPS obrigatório (SW e instalação).
   - SPA fallback: Netlify (`_redirects` `/* /index.html 200`), Vercel (`rewrites`), GitHub Pages (copiar `index.html` para `404.html` + `base` do Vite se em subcaminho).
   - Cabeçalhos: `sw.js` e `index.html` com `Cache-Control: no-cache`; `/assets/*` com `max-age=31536000, immutable`; `manifest.webmanifest` com `application/manifest+json`.
   - Como verificar após publicar (Lighthouse, instalar no celular).
6. **Limitações**: lembrete só com app/SW ativo e, no iPhone, só instalado (iOS 16.4+); voz e reconhecimento de fala variam por navegador (Firefox sem reconhecimento; vozes diferentes por sistema); dados só locais — trocar de aparelho exige exportar/importar; limpar dados do navegador apaga o progresso.
7. **Estrutura do projeto**: árvore resumida (`src/app`, `features`, `domain`, `data`, `content`, `services`, `stores`, `ui`, `i18n`, `e2e`, `scripts`, `docs`) com uma linha cada e link para `docs/ARQUITETURA.md`.
8. Licença/créditos (fontes, ícones) e aviso de identidade original.

### 7. ROADMAP

Arquivo: `docs/ROADMAP.md` (escrito pelo arquiteto nesta fase, junto com o plano — ver etapa 1).

- **Fora de escopo da v1**: contas e sincronização na nuvem, ligas/ranking, loja/moedas, chat com IA, app nativo (lojas), push com servidor, unidades além de A2.
- **Ideias futuras**: tradução PT→EN digitada no Praticar com frases novas; refazer nivelamento e nivelamento por unidade; FSRS; exercícios de pronúncia com pontuação; modo escuro automático por horário; histórias curtas; estatísticas de erros frequentes.

### 8. Checklist de pronto do projeto

Arquivo: `docs/PRONTO.md` (escrito pelo arquiteto ao fim da fase, marcado item a item com evidência: link de PR, relatório ou teste).

- [ ] Todas as funcionalidades do escopo (§1 da arquitetura) implementadas e navegáveis.
- [ ] Jornada §15 coberta por `e2e/journey.spec.ts`, verde em mobile e desktop.
- [ ] Offline completo após primeira visita; recarga e rota profunda offline funcionam.
- [ ] Instalável: manifest completo, ícones 192/512/maskable, SW ativo.
- [ ] Lighthouse mobile (mediana de 3) ≥ 90 em desempenho, acessibilidade e boas práticas em `/` e `/boas-vindas`.
- [ ] Chunk de entrada dentro do orçamento; build falha se estourar.
- [ ] axe: 0 `serious`/`critical` em todas as telas, claro e escuro.
- [ ] Teclado e leitor de tela verificados à mão (checklist no PR).
- [ ] lint, typecheck, test, e2e, `validate:content` verdes; nenhum `test.only`/`test.fixme`.
- [ ] Nenhum texto de UI fora de `pt-BR.ts`; nenhuma cor hex em componente; identidade original (sem referências ao Duolingo).
- [ ] Conteúdo revisado pelo `revisor-linguistico` (0 bloqueantes).
- [ ] README e ROADMAP completos; ARQUITETURA e DECISOES atualizadas.
- [ ] Revisores (código, QA, UX, linguístico) sem bloqueantes.

## Ordem de implementação (um commit por etapa)

1. `docs: add phase 7 plan, roadmap and adr-012` — este plano, `docs/ROADMAP.md`, ADR-012 (arquiteto).
2. `refactor: load unit content lazily with course manifest` — tarefa 1 (loader + manifesto + stores).
3. `chore: add bundle budget and lazy practice route` — tarefa 1 (orçamento, `manualChunks`, `PracticeScreen` lazy).
4. `chore: add reproducible lighthouse script` — tarefa 2; medir e ajustar até ≥ 90.
5. `fix: persist heart spend before feedback` — pendência 4.3 (remove o `fixme`).
6. `fix: pick english tts voice after voiceschanged` — pendência 4.1.
7. `fix: treat spelled-out numbers as equal in grading` — pendência 4.2.
8. `fix: tuca poses and dialogs polish` — pendências 4.4 e 4.5.
9. `test: add axe audit for all screens` — tarefa 5 + correções.
10. `test: add full journey, offline and install e2e` — tarefa 3 + pendência 4.6.
11. `docs: write complete readme` — tarefa 6.
12. `docs: add done checklist` — tarefa 8 (arquiteto, com evidências).

Portões: 2–3, 5–7 → `revisor-de-codigo` + `qa-tester`; 7 também `revisor-linguistico` (tabela de números); 8 e 9 também `revisor-ux` com screenshots claro/escuro 390×844 e desktop; 10 → `qa-tester`; 11 → `revisor-de-codigo` (comandos conferidos rodando). Nenhuma etapa avança com bloqueante.

## Critérios de aceite

- `npm run build` mostra chunk de entrada ≤ 250 kB minificado e JS inicial ≤ 260 kB gzip, e falha acima disso; nenhum JSON de unidade no chunk de entrada.
- Trilha desenha só com o manifesto; abrir lição carrega e valida só a unidade dela (teste de unidade com glob mockado conta importações).
- `manifest.test.ts` falha se o manifesto divergir do conteúdo.
- `npm run lighthouse` termina com exit 0 e mediana ≥ 90 nas três categorias, em `/` e `/boas-vindas`, mobile.
- `journey.spec.ts`, `offline.spec.ts`, `install.spec.ts` verdes (offline/install só Chromium, documentado no spec).
- `pickEnglishVoice` e `normalizeNumbers` puros e testados; `seven` = `7` aceito como certo.
- O teste antes `fixme` de corações passa 20× seguidas.
- Com reduced motion, Tuca troca de pose sem animação.
- `a11y.spec.ts`: 0 violações serious/critical em todas as telas listadas, claro e escuro.
- Nenhum `test.fixme`/`test.only` no repositório; skips com motivo.
- README cobre as 8 seções; comandos do README rodam como descritos.
- `docs/ROADMAP.md` e `docs/PRONTO.md` existem; PRONTO com todos os itens marcados e evidência.
- Dexie v1, `EXPORT_SCHEMA_VERSION` 1, formato do conteúdo inalterado.
- lint, typecheck, test, e2e verdes; revisores sem bloqueantes.

## Fora desta fase

Tudo do `docs/ROADMAP.md`; CI hospedado (GitHub Actions) — opcional, ver decisão 4; deploy efetivo em um provedor (o README ensina; publicar é do usuário); novas unidades de conteúdo; monitoramento/analytics (exigiria aviso de privacidade).

## Decisões que precisam do usuário

1. **Lighthouse**: padrão é `npx lighthouse@<versão>` no script (sem dependência no `package.json`, baixa ~50 MB na primeira vez e precisa de Chrome/Chromium). Alternativa: `@lhci/cli` como devDependency (mais pesada, traz asserções e histórico). Aceita o `npx`?
2. **`@axe-core/playwright`** como devDependency nova (leve, só testes). Aprova? (Sem ela, axe via CDN no teste, pior.)
3. **Conteúdo lazy + manifesto** (ADR-012): muda a interface do `loader` de síncrona para assíncrona e adiciona `src/content/manifest.ts` (não muda o formato dos JSON). Ok? Prefere manifesto **gerado** por script no `validate:content` (padrão proposto) ou escrito à mão com teste?
4. **CI**: quer um workflow GitHub Actions rodando lint/typecheck/test/e2e/lighthouse? (Fora do escopo por padrão.)
5. **Provedor de deploy**: algum preferido (Netlify, Vercel, GitHub Pages)? O README cobre os três; se escolher um, incluímos o arquivo de config (`netlify.toml`/`vercel.json`) no repositório.
6. **Números por extenso**: limitar a 0–100 (padrão, cobre A1–A2) está bom?
