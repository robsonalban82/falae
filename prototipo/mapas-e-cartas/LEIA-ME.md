# Protótipo: mapas mentais e cartas (Falaê)

Página separada do app Falaê para avaliar a qualidade dos **mapas mentais** e das **cartas (flashcards)** de inglês, na tela e no papel. Nada aqui é carregado pelo app; nada em `src/` foi alterado. Funciona sem internet e sem servidor.

## Como abrir

- **Duplo clique em `index.html`** (abre via `file://` em Chrome, Edge, Safari ou Firefox).
- Ou sirva a pasta e abra no celular pela rede local:

  ```
  npx serve prototipo/mapas-e-cartas      # ou: python3 -m http.server -d prototipo/mapas-e-cartas
  ```

- PDFs prontos para imprimir: `pdf/mapas.pdf` e `pdf/cartas.pdf` (também há links na capa da página).

O que dá para testar:

- **Capa** com as 5 coleções em forma de caderno, cada uma com selos de nível (A1…C2).
- **Mapa** (árvore vertical, na ordem do conteúdo; no computador, uma coluna de ~760 px com os cartões lado a lado dentro de cada ramo): abrir/fechar ramos, "Abrir tudo / Fechar tudo", **"Esconder o inglês"** (um post-it de papel kraft cobre cada trecho em inglês; o título e o português continuam visíveis; toque no post-it para revelar), toque numa frase em inglês para **ouvir** (voz en-US do sistema; se não houver, o áudio some).
- **Cartas**: na frente só há "Virar carta" (ou toque na carta, Espaço, Enter, ou deslize); depois de virar aparecem Errei / Difícil / Bom / Fácil, que só avançam e contam no fim. Com a carta virada, deslize para a direita = lembrei, esquerda = não lembrei (setas → / ← ou teclas 1 a 4 no teclado). **EN → PT** e **PT → EN**; botão **Ouvir** dentro da carta. No computador a carta fica deitada, na proporção da impressa.
- Modo escuro segue o sistema; com "reduzir movimento" ligado, a carta troca de lado com um fade, sem giro 3D.

## Como regenerar (depois de mudar o conteúdo)

Na raiz do repositório:

```
node prototipo/mapas-e-cartas/build.mjs && node prototipo/mapas-e-cartas/pdf.mjs
```

- `build.mjs` (Node puro) lê `conteudo/mapas/*.json` e `conteudo/cartas/*.json`, valida e gera `data.js`. Se uma das pastas estiver vazia, usa `dev-fixtures/` (o terminal diz de onde veio cada parte). `--fixtures` força os fixtures. Com erro, **não gera nada** e lista cada problema com arquivo, ramo, cartão e linha (tag/cor/ícone inválido, campo desconhecido ou faltando, mais de 6 ramos, mais de 25 cartões, id repetido). Avisos (não bloqueiam): mais de 5 cartões num ramo, mais de 4 linhas num cartão, `**` sem par, cor de ramo repetida.
- `pdf.mjs` usa o Chromium do Playwright já instalado no projeto para gerar os dois PDFs a partir de `print.html?mapas` e `print.html?cartas`. Ele mostra o tamanho de fonte usado em cada mapa, confere o alinhamento frente/verso das cartas (falha se passar de 0,1 mm) e **lista as cartas cujo verso não cabe** a 10,5 pt, com quantos milímetros passam. Essas cartas saem com contorno vermelho no PDF até o texto ser encurtado (a fonte do verso nunca diminui). `node .../pdf.mjs mapas` ou `cartas` gera só um.
- Figuras e teste (opcionais): `emoji` na linha (1 emoji), `figure` no cartão (1 a 3), `centerFigure` no mapa (1 a 3) e `exercise: { instruction, items: [{ prompt com "___", answer com alternativas "a|b", hintPt? }] }` com 3 a 6 itens. O build confere tudo isso. As figuras são emojis desenhados por uma única função, `figure()` em `common.js`; para trocar por ilustrações próprias, basta mudar essa função. No app, o "Teste rápido" confere cada resposta (ignora maiúsculas, pontuação e espaços extras) e tem "Ver respostas"; no PDF, vira lacunas para escrever, com as respostas de cabeça para baixo no pé da página. Para ficar em 10 pt ou mais, um mapa pode usar 2 páginas (mapa na 1ª; teste e continuação na 2ª).
- Mapas aceitam um campo opcional `icon` (mesma lista de ícones dos ramos), usado na lista da coleção, no cabeçalho do mapa e no sumário do PDF; sem ele, vale o ícone do primeiro ramo.
- Opcional: `node prototipo/mapas-e-cartas/capturas.mjs` refaz as capturas da página (390×844 e 1280×800, claro e escuro) em `capturas/`. No macOS, `osascript -l JavaScript prototipo/mapas-e-cartas/pdf-para-png.js <arquivo.pdf> <pasta> [largura] [páginas]` converte páginas de PDF em PNG.

## Como imprimir

**Mapas (`pdf/mapas.pdf`)**: A4 **deitado**, tamanho real (100%), só frente. Capa, sumário e uma página por mapa, com espaço "Minhas anotações" quando sobra lugar. As etiquetas dos cartões têm forma e ícone próprios, então a apostila funciona também em preto e branco.

**Cartas (`pdf/cartas.pdf`)**: A4 em pé, 8 cartas por folha (9,5 × 6,7 cm).

1. Imprima **frente e verso**, virando pela **borda longa** (é o padrão "duplex" da maioria das impressoras).
2. Escala **100%** (desligue "ajustar à página"); sem isso frente e verso desalinham.
3. Páginas ímpares são as frentes (figura + inglês); as pares são os versos (tradução, exemplo, pronúncia, quando usar), já **espelhados** para cair atrás da carta certa.
4. Recorte nas linhas tracejadas. Cada carta tem uma margem branca de 3 mm por dentro do corte, que absorve pequenos desvios da impressora.
5. Papel de 120 a 180 g deixa as cartas firmes.

Sem impressora duplex: imprima só as páginas ímpares, recoloque as folhas na bandeja e imprima as pares (teste com uma folha antes para acertar o lado do papel).

## Arquivos

| Arquivo                                        | Para quê                                                                                                         |
| ---------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `index.html`, `app.js`, `styles.css`           | a página (JavaScript puro, sem framework nem CDN)                                                                |
| `common.js`                                    | textos da interface (PT-BR), ícones desenhados e o desenho dos cartões, usados pela página e pela impressão      |
| `print.html`, `print.js`, `print.css`          | layouts de impressão (mapas no formato do esboço A, cartas 2 × 4)                                                |
| `build.mjs` → `data.js`                        | validação do conteúdo e dados para a página (não edite `data.js` à mão)                                          |
| `pdf.mjs` → `pdf/`                             | geração dos PDFs                                                                                                 |
| `capturas.mjs`, `pdf-para-png.js`, `capturas/` | capturas de tela e páginas dos PDFs para revisão                                                                 |
| `conteudo/`                                    | conteúdo de verdade (do autor de conteúdo)                                                                       |
| `dev-fixtures/`                                | conteúdo mínimo usado só se `conteudo/` estiver vazio                                                            |
| `fonts/`                                       | Fredoka, Atkinson Hyperlegible e Patrick Hand (subconjunto latino), licença SIL OFL 1.1 nos arquivos `OFL-*.txt` |

## Limitações conhecidas

- **Voz**: depende das vozes do sistema. Sem voz en-US (alguns Android e Linux), os botões de ouvir não aparecem (no mapa, um aviso explica o motivo).
- **Mapas densos**: a impressão começa em 10,5 pt e reduz até 9 pt para caber numa página; abaixo de 10 pt, as traduções passam para uma tinta mais escura. Se um mapa não couber nem a 9 pt, ele é dividido em duas páginas automaticamente, com aviso no terminal.
- **Zero cortado**: a Atkinson Hyperlegible desenha o zero com um traço (para não confundir com a letra O) e não tem uma alternativa sem traço, então `font-variant-numeric` não resolve. Ficou como está; trocar exigiria outra fonte só para os números.
- **Emojis** nas cartas impressas vêm da fonte do sistema (Apple Color Emoji no macOS). Gerado em outro sistema, o desenho do emoji muda.
- As notas das cartas não agendam revisões (não há SRS no protótipo) e não ficam salvas.
