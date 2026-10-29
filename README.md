# Falaê

## O que é

O Falaê é um app (PWA) gamificado para brasileiros aprenderem inglês americano do zero, nível **A1 → A2**, em poucos minutos por dia: trilha de lições, 7 tipos de exercício, XP, ofensiva, corações, meta diária, conquistas e revisão espaçada.

- **Funciona offline** depois da primeira visita (service worker com todo o conteúdo em cache).
- **Sem conta e sem servidor**: nada de cadastro; os dados ficam **só no seu aparelho** (IndexedDB). Para trocar de aparelho, exporte e importe o progresso em Ajustes.
- Pode ser instalado na tela inicial (Android, iPhone, desktop).

Convenções do projeto em [`CLAUDE.md`](CLAUDE.md); arquitetura em [`docs/ARQUITETURA.md`](docs/ARQUITETURA.md); decisões em [`docs/DECISOES.md`](docs/DECISOES.md).

## Como rodar

Pré-requisitos:

- **Node.js 22.12 ou mais novo** — baixe a versão LTS em [nodejs.org](https://nodejs.org/pt-br/download) (veja `.nvmrc` e `engines` no `package.json`). Confira com `node -v`.
- **Git** — [git-scm.com/downloads](https://git-scm.com/downloads) (no Mac, `xcode-select --install` também instala). Confira com `git --version`.

```sh
nvm use          # opcional, lê o .nvmrc
npm ci           # instala exatamente o package-lock.json
npm run dev      # http://localhost:5173
npm run dev:demo # igual, com a unidade de demonstração (todos os tipos de exercício)
```

Para os testes E2E e o Lighthouse, baixe uma vez o Chromium do Playwright: `npx playwright install chromium`.

## Scripts

| Script                     | O que faz                                                                                                                                                                                                                       | Quando usar                                       |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------- |
| `npm run dev`              | Servidor de desenvolvimento (Vite).                                                                                                                                                                                             | No dia a dia.                                     |
| `npm run dev:demo`         | Dev com a unidade de demonstração (`VITE_DEMO=1`).                                                                                                                                                                              | Para testar o motor de lição com os 7 tipos.      |
| `npm run build`            | `tsc` + build de produção em `dist/` + `scripts/check-prod-bundle.ts` (nenhum código de teste no bundle, **orçamento**: entrada ≤ 250 kB, nenhum chunk > 300 kB, nenhum JSON de unidade no JS inicial). Falha se algo estourar. | Antes de publicar.                                |
| `npm run preview`          | Serve o `dist/` localmente.                                                                                                                                                                                                     | Conferir o build (PWA, offline).                  |
| `npm run lint`             | ESLint (inclui acessibilidade e a regra contra `test.only`/`test.fixme`) + Prettier.                                                                                                                                            | Antes de cada commit.                             |
| `npm run format`           | Formata tudo com Prettier.                                                                                                                                                                                                      | Quando o lint reclamar de formatação.             |
| `npm run format:check`     | Só confere a formatação.                                                                                                                                                                                                        | Igual ao lint, sem ESLint.                        |
| `npm run typecheck`        | `tsc --noEmit` (TypeScript strict).                                                                                                                                                                                             | Antes de cada commit.                             |
| `npm test`                 | Vitest: regras de negócio, componentes, conteúdo e manifesto.                                                                                                                                                                   | Sempre.                                           |
| `npm run test:watch`       | Vitest em modo observação.                                                                                                                                                                                                      | Enquanto programa.                                |
| `npm run validate:content` | Valida `src/content/units/*.json` com o schema Zod e as regras pedagógicas e **regenera o manifesto** (`manifest.generated.ts`, `knownWords.generated.ts`).                                                                     | Sempre que mexer em conteúdo.                     |
| `npm run e2e`              | Playwright (celular 390×844 e desktop) contra um build de produção com service worker na porta 4173: jornada completa, offline, instalação, acessibilidade (axe) e demais fluxos.                                               | Antes de fechar uma etapa.                        |
| `npm run screenshots`      | Capturas das telas principais (claro/escuro, celular/desktop) em `e2e/screenshots/`.                                                                                                                                            | Para a revisão de UX.                             |
| `npm run lighthouse`       | Build de produção + `vite preview` (porta 4174) + Lighthouse mobile 3× em `/` e `/boas-vindas`; mediana por categoria; falha abaixo de 90. Relatórios em `lighthouse-reports/` (fora do git).                                   | Antes de publicar ou após mudanças de desempenho. |

O Lighthouse roda via `npx lighthouse@13.6.0` (sem dependência no projeto; baixa na primeira vez). Usa o Chrome instalado ou, se não houver, o Chromium do Playwright (pode forçar com `CHROME_PATH=/caminho/do/chrome`). Não rode `npm run lighthouse` e `npm run e2e` ao mesmo tempo.

## Como adicionar lições

1. O conteúdo fica em `src/content/units/*.json` (uma unidade por arquivo: 4 habilidades × 3 lições + revisão, 10–15 exercícios por lição). O formato é definido pelo schema Zod em `src/content/schema.ts` — os tipos do app são inferidos dele.
2. Siga a skill [`.claude/skills/criar-licao`](.claude/skills/criar-licao) (e `revisar-licao` para a revisão).
3. Fluxo de qualidade: `autor-de-conteudo` escreve → `revisor-linguistico` revisa → correção → reconfirmação. Ninguém aprova o próprio trabalho.
4. Rode `npm run validate:content`: valida tudo e **regenera o manifesto** (`src/content/manifest.generated.ts`), o índice leve que desenha a trilha sem carregar os JSON. Inclua os arquivos gerados no commit.
5. Rode `npm test`: `manifest.test.ts` falha se o manifesto estiver desatualizado; os testes de conteúdo conferem schema, pedagogia e que cada lição só cita itens da própria unidade (cada unidade é carregada sozinha, sob demanda).

Conteúdo inválido nunca é carregado: no app, a tela mostra um aviso com "Tentar de novo" em vez de travar.

## Deploy (GitHub Pages)

O Falaê é um site estático e já vem pronto para o **GitHub Pages**: o workflow `.github/workflows/deploy.yml` instala as dependências (`npm ci`), gera o build (`npm run build`) e publica a pasta `dist/` a cada push na branch `main` (ou quando você mandar rodar à mão). O GitHub Pages já usa HTTPS, que é obrigatório para o app funcionar offline e ser instalado.

### Passo a passo (primeira vez)

1. **Crie uma conta** em [github.com](https://github.com) (se ainda não tiver).
2. **Crie um repositório**: botão **New** (ou "+" → _New repository_). Dê um nome, por exemplo `falae`. Pode ser público ou privado (Pages em repositório privado exige plano pago). Não marque a opção de criar README.
3. **Envie o código** (no terminal, dentro da pasta do projeto; troque `<usuario>` e `<repo>`):

   ```sh
   git init            # só se a pasta ainda não for um repositório git
   git add .
   git commit -m "chore: first commit"
   git branch -M main
   git remote add origin https://github.com/<usuario>/<repo>.git
   git push -u origin main
   ```

   **Login no `git push`:** o GitHub não aceita a senha da conta no terminal. Use uma destas opções:
   - **GitHub Desktop** ([desktop.github.com](https://desktop.github.com)): entre com sua conta, use _File → Add local repository_ e clique em _Publish repository_. Dispensa os comandos acima.
   - **Token**: em GitHub → foto de perfil → _Settings → Developer settings → Personal access tokens → Fine-grained tokens_, gere um token com acesso de escrita a _Contents_ do repositório e cole-o quando o `git push` pedir a senha.
   - **GitHub CLI**: instale o [`gh`](https://cli.github.com) e rode `gh auth login` uma vez.

4. **Ative o Pages**: no repositório, abra **Settings → Pages** e, em **Build and deployment → Source**, escolha **GitHub Actions**.
5. **Rode a publicação**: na aba **Actions**, o workflow "Deploy to GitHub Pages" roda sozinho a cada push na `main`. Se o primeiro push foi antes do passo 4, abra o workflow e clique em **Run workflow**.
6. Quando ficar verde (1 a 3 minutos), o app estará em **`https://<usuario>.github.io/<repo>/`** (o endereço também aparece em Settings → Pages).

**Se o workflow falhar:** abra a aba **Actions**, clique na execução marcada com X vermelho e depois no passo vermelho para ler o erro. Os casos mais comuns: o Pages não foi ativado com _Source: GitHub Actions_ (passo 4) — ative e clique em **Re-run jobs**; ou o build falhou (lint/orçamento de bundle) — rode `npm run build` no seu computador, corrija e envie de novo.

Depois disso, basta fazer `git push` na `main` para publicar uma versão nova; quem já tem o app recebe a atualização automaticamente na próxima abertura.

### Como funciona o subcaminho

- O site fica em `/<repo>/`, não na raiz. O workflow passa `VITE_BASE=/<repo>/` para o build; o Vite usa isso como `base`, e o roteador (`basename`), o manifesto (`start_url`/`scope`), o service worker e os ícones seguem o mesmo caminho.
- Sem `VITE_BASE` (build local, `npm run dev`, E2E, Lighthouse), o caminho é `/`.
- O GitHub Pages não tem "SPA fallback": o build copia `index.html` para `404.html`, então abrir direto um link como `/<repo>/perfil` também carrega o app. Depois da primeira visita, o service worker atende todas as rotas, inclusive offline.
- Para testar o build com subcaminho localmente: `VITE_BASE=/falae/ npm run build && VITE_BASE=/falae/ npm run preview` e abra `http://localhost:4173/falae/`.

### Depois de publicar

Rode o Lighthouse (DevTools → Lighthouse, modo celular) na URL pública; abra no celular, use "Instalar app" / "Adicionar à tela de início", abra uma lição, ative o modo avião e confira que tudo continua funcionando.

### Alternativas (Netlify, Vercel)

Publique a pasta `dist/` (build `npm run build`, sem `VITE_BASE`). Configure o SPA fallback (Netlify: `public/_redirects` com `/* /index.html 200`; Vercel: `rewrites` para `/index.html`) e os cabeçalhos: `sw.js` e `index.html` com `Cache-Control: no-cache`; `/assets/*` com `max-age=31536000, immutable`; `manifest.webmanifest` com `application/manifest+json`.

## Limitações

- **Lembrete diário**: sem servidor de push, o lembrete só aparece se o app (ou o service worker) estiver ativo no aparelho. No iPhone, só funciona com o app instalado na tela inicial (iOS 16.4 ou mais novo). O sistema pode atrasar ou esconder o aviso; a permissão só é pedida ao ligar o lembrete em Ajustes.
- **Voz e fala**: a pronúncia (síntese de voz) e o reconhecimento de fala dependem do navegador. O Firefox não tem reconhecimento de fala (os exercícios de falar são trocados por outros); as vozes em inglês variam por sistema.
- **Dados só locais**: não há nuvem. Trocar de aparelho exige exportar e importar o backup. **Limpar os dados do navegador apaga o progresso.**

## Estrutura do projeto

```
src/
  app/        rotas, layout, guarda de boas-vindas
  features/   telas por funcionalidade (trilha, lição, prática, perfil, ajustes, boas-vindas, nivelamento, dica)
  domain/     regras de negócio puras e testadas (corretor, SRS, XP, ofensiva, corações, desbloqueio, motor de lição)
  data/       persistência (Dexie/IndexedDB) atrás da interface Repository; export/import
  content/    schema Zod, unidades JSON, manifesto gerado e carregador sob demanda
  services/   relógio, voz, som, vibração, notificações, tema
  stores/     estado global (Zustand)
  ui/         componentes reutilizáveis (botões, diálogos, mascote Tuca, ícones)
  i18n/       todos os textos de interface (pt-BR)
e2e/          testes Playwright (jornada, offline, instalação, axe, telas)
scripts/      validação de conteúdo, orçamento de bundle, Lighthouse, ícones
docs/         arquitetura, decisões, planos de fase
```

Detalhes em [`docs/ARQUITETURA.md`](docs/ARQUITETURA.md).

## Licença e créditos

- Fontes: [Fredoka](https://fonts.google.com/specimen/Fredoka) e [Atkinson Hyperlegible](https://brailleinstitute.org/freefont), ambas sob SIL Open Font License, auto-hospedadas via `@fontsource`.
- Ícones, mascote (Tuca, o tucano) e ilustrações: desenhos SVG originais do projeto.
- Identidade original: o Falaê não usa nome, mascote, cores, sons ou textos de outros apps de idiomas.
- Projeto privado; sem licença de código aberto definida.
