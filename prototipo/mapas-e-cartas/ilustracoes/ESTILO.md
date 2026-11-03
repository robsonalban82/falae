# Estilo das ilustrações: "cena de caderno"

Substitui o guia do piloto "adesivo plano". As 8 cenas do mapa "to be" estão em `ilustracoes/cenas/`. Os 16 SVGs 64×64 do piloto ficam como estão, para ícones pequenos (linhas de cartão, 24 px).

## Receita da cena

- **Arquivo:** `ilustracoes/cenas/<nome>.svg`, `viewBox="0 0 160 160"`, `<title>` em PT-BR, sem texto dentro do desenho, sem `<defs>`, sem filtros e sem ids (pode ser embutido inline várias vezes na mesma página). Exibição: 96–128 px no app (80 px no celular) e 18–24 mm no PDF.
- **Composição:** 1 objeto ou pessoa principal + 1 ou 2 elementos de apoio que explicam a regra (velinhas, ondas do toque, flocos de gelo, bandeira, check verde) + sombra elíptica no chão (`#1B1C33` a 18%).
- **Fundo da cena:** uma mancha orgânica `#FFF1D6` atrás de tudo. Ela faz o papel do halo branco do piloto: o desenho continua legível no tema escuro sem filtro (que o Chrome rasteriza no PDF).
- **Contorno:** `#1B1C33`, 3,5 de espessura nos contornos, 2 a 2,5 nos detalhes (nunca menos). Pontas e junções arredondadas. Os caminhos têm pequenas assimetrias de mão (cantos de ~0,5 a 1 fora do esquadro, curvas levemente irregulares).
- **Cor e sombra (2 tons):** cada forma tem cor base da paleta e uma sombra chapada do mesmo matiz, mais escura, na face oposta à luz (direita/baixo), sem degradê:
  - base / sombra: Manga `#FF8A1F` / `#D96A00`; Anil `#3B3FB6` / `#2B2F8A`; Folha `#0F7A37` / `#0A5A28`; Acerola `#B42318` / `#8A1A12`; Maracujá `#F5C518` / `#D9A800`; bege `#FFE3B3` / `#F2C27A`; papel `#FFFDF8` / `#E8DFCB`; Jabuticaba `#6F2A91` / `#4E1B69`; pele clara `#D9965F` / `#B87440`; pele escura `#8D5A3B` / `#6E4229`.
  - A sombra é um path sem contorno (`stroke="none"`) desenhado antes do contorno, para o traço ficar por cima.
  - Complementos: Anil claro `#9A9DFF`, vidro `#CFD1FF`, verde claro `#5BE08C`, marrom `#7A4A2A`, cabelo `#3A2A2A`.
- **Hachura de caderno:** 3 a 6 traços diagonais curtos (largura 1,6, opacidade .45 a .5, cor do contorno) dentro de cada área de sombra grande. Poucos, para não virar ruído a 96 px.
- **Realce:** 1 a 2 traços brancos (`#fff`, opacidade .55 a .7, largura 3 a 3,5) paralelos ao contorno no canto superior esquerdo da maior área colorida.
- **P&B:** conferir em escala de cinza. Cor base e sombra têm de se separar, e nenhuma parte útil pode depender só de matiz (ex.: rosa vs. verde). Em escala de cinza o desenho ainda precisa ser reconhecível só pela silhueta.

## Pessoas

Proporção cartum (cabeça grande, ~1/3 da altura do busto), rosto próprio (olhos, sobrancelha, boca, bochecha), nunca "capacete" liso. Variar pele, cabelo e roupa entre as cenas. Sem estereótipo: profissão e idade sem rótulos visuais (a professora usa óculos e coque, não há cena de gênero fixo). Mão: forma única com contorno 3; braço = faixa de pele com manga em cor da paleta.

## Como usar no mapa

No JSON do mapa, o cartão recebe `"art": "nome-do-arquivo"` (sem `.svg`). O `build.mjs` valida a existência do arquivo e embute o SVG em `data.js` (funciona via `file://`). Se o cartão também tem `figure`, o `art` vence e o `figure` não aparece. A cena é decorativa (`aria-hidden`), à direita do cartão, alinhada à base; o texto fica à esquerda.

## Custo por cena

Cena com pessoa: ~8 a 10 min de trabalho de agente com 1 a 2 iterações de revisão visual; cena de objeto: ~5 min. Entregar por mapa (8 a 10 cenas) e revisar em folha de contato nos tamanhos 96/160 px, claro, escuro e escala de cinza.
