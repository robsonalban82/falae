# Gramática visual dos mapas mentais — proposta

> Status: **proposta para escolha do usuário** (agente `designer-de-mapas`). Nada disto altera o app ainda.
> Veja os três esboços em `index.html` (mesmo mapa: verbo _to be_, A1).

## 1. Princípios

1. **Caderno de estudos, não pôster**: papel pautado/pontilhado sutil, título com marca-texto amarelo, ramos de traço levemente irregular, cartões tipo post-it. A textura é decoração: nunca carrega informação.
2. **Informação nunca depende só da cor**: cada ramo tem **nome + ícone**; cada cartão tem **tag com ícone + forma + rótulo**; certo/errado usam ✓/✗ desenhados e riscado.
3. **Inglês em destaque**: todo trecho em inglês tem `lang="en"`; a tradução em PT fica em cinza (`--ink-muted`), menor ênfase.
4. **Identidade original**: paleta do Falaê, ícones rabiscados próprios, sem coruja, sem layout de pôster com caixas numeradas.
5. **O mapa é gerado dos dados** (JSON da unidade); o desenho é uma camada de apresentação.

## 2. Cor por tipo de ramo

Fundo de papel = `--bg` Areia `#FFF8EF`; cartão = `#FFFDF8` (levemente quente, em vez do branco puro). Razões WCAG 2.x calculadas com a fórmula oficial de luminância relativa.

| Ramo           | Preenchimento do título | Texto sobre o preenchimento | Traço/contorno sobre papel | Texto-chave sobre cartão | Fundo "post-it" (tint) | Texto-chave sobre tint |
| -------------- | ----------------------- | --------------------------- | -------------------------- | ------------------------ | ---------------------- | ---------------------- |
| **Afirmativa** | Folha `#0F7A37`         | branco **5,4**              | `#0F7A37` **5,2**          | `#0A5C29` **8,0**        | `#DDF5E3`              | **7,1**                |
| **Negativa**   | Jabuticaba `#6F2A91` \* | branco **8,7**              | `#6F2A91` **8,2**          | `#5A2077` **10,8**       | `#F1E3F8`              | **9,0**                |
| **Perguntas**  | Anil `#3B3FB6`          | branco **8,2**              | `#3B3FB6` **7,7**          | `#262987` **11,8**       | `#E3E4FB`              | **9,6**                |
| **Contrações** | Manga `#FF8A1F`         | tinta `#1B1C33` **7,1**     | `#A84E00` **5,3** †        | `#8F4300` **7,0**        | `#FFF0D6`              | **6,3**                |
| **Erro comum** | Acerola `#B42318`       | branco **6,6**              | `#B42318` **6,2**          | `#8A1A12` **9,2**        | `#FDE4E2`              | **7,8**                |
| **Dica**       | Maracujá `#F5C518`      | tinta `#1B1C33` **10,2**    | `#8A6A00` **4,8** †        | `#6E5200` **7,2**        | `#FFF3B8`              | **6,5**                |

\* **Jabuticaba é a única cor nova** (roxo). Foi necessária porque a paleta tem só 6 matizes e "Negativa" não pode dividir o vermelho com "Erro comum". Precisa de aprovação para entrar em `tokens.css` (`--map-neg`).
† Manga e Maracujá são claros demais para texto/traço sobre papel (2,2 e 1,6 contra o fundo); por isso o título é preenchido e o **contorno** usa a variante escura (mesma ideia de `--primary-shade`).

Texto base (todas as razões acima de AA 4,5:1; gráficos/contornos acima de 3:1):

| Par                                          | Razão                                   |
| -------------------------------------------- | --------------------------------------- |
| Tinta `#1B1C33` sobre papel / cartão         | **15,8** / **16,4**                     |
| Tinta sobre qualquer tint de ramo            | **13,3 a 14,9**                         |
| Cinza `#5B5A6E` (traduções) sobre papel      | **6,4**                                 |
| Cinza sobre cartão / sobre tints             | **6,6** / **5,3 a 6,0**                 |
| ✗ errado `#8A1A12` sobre cartão              | **9,2**                                 |
| ✓ certo `#0A5C29` sobre cartão               | **8,0**                                 |
| Chip "erro comum": branco sobre `#B42318`    | **6,6**                                 |
| Central: papel `#FFF8EF` sobre tinta (Noite) | **15,8**; Maracujá sobre tinta **10,2** |

**Não usar** como informação: pautas (`#E8DCCA`, 1,3:1) e pontos (`#D6C6AA`, 1,6:1). São textura, abaixo de 3:1 de propósito.

Regra de uso: **cor cheia** só no título do ramo, no traço e no contorno; **texto-chave** (palavra em destaque dentro do cartão, ex.: _am / are / is_) em negrito na variante escura; **tint** só como fundo de cartão no estilo post-it (esboço C) ou, no app, opcional.

## 3. Tags dos nós (independentes da cor do ramo)

Neutras (tinta sobre branco) para não brigar com a cor do ramo, exceto **erro comum**, sempre vermelho cheio. Cada tag tem **forma própria + ícone próprio + rótulo escrito** (tripla redundância → funciona em P&B e para daltônicos).

| Tag             | Forma do chip                                         | Ícone         | Quando usar                                                       |
| --------------- | ----------------------------------------------------- | ------------- | ----------------------------------------------------------------- |
| **regra**       | retângulo de cantos retos                             | régua         | como se forma/usa; tabelas de conjugação                          |
| **exemplo**     | pílula (cantos totalmente redondos)                   | balão de fala | frases-modelo; sempre em inglês, com tradução opcional            |
| **exceção**     | retângulo com cantos cortados                         | triângulo "!" | o que foge da regra (_amn't_ não existe; _Yes, I am_)             |
| **erro comum**  | retângulo inclinado, **cheio vermelho**, texto branco | círculo ✗     | erro típico de brasileiro; mostra ✗ errado → ✓ certo + dica em PT |
| **vocabulário** | etiqueta com ponta (bandeira)                         | livro aberto  | palavras novas, `inglês = português`                              |

Ícones dos **ramos** (no título, ao lado do nome): ✓ Afirmativa · ⊘ Negativa · ? Perguntas · ’ Contrações · ✗ Erro comum · lâmpada Dica.

Certo/errado dentro do cartão: **✗** em círculo + texto vermelho-escuro **riscado**; **✓** + texto verde-escuro em negrito. Sempre acompanhados de uma linha em PT explicando o porquê.

## 4. Hierarquia tipográfica

| Nível                                                      | Fonte                                      | Observação                                                                         |
| ---------------------------------------------------------- | ------------------------------------------ | ---------------------------------------------------------------------------------- |
| Título do mapa, nó central, título do ramo                 | **Fredoka** 600                            | já no app (`@fontsource/fredoka`)                                                  |
| Texto dos cartões, tags, legendas                          | **Atkinson Hyperlegible** 400/700          | já no app; **400** para PT e inglês, **700** para a palavra-chave e rótulos de tag |
| Anotações à mão ("cuidado!", "comece por aqui", subtítulo) | **Caveat** 600 (`@fontsource/caveat`, OFL) | **só acento decorativo**, nunca conteúdo de estudo                                 |

- Caveat foi usada nos esboços. Alternativa mais legível: **Patrick Hand** (`@fontsource/patrick-hand`, OFL, 24 kB). Se a legibilidade pesar mais que o charme, trocar é só mudar a família.
- Peso: Caveat variável pesa ~50 kB por arquivo latin; Patrick Hand ~24 kB. Carregar só nas telas de mapa (import dinâmico) e, no app, usar `font-display: swap` com fallback `cursive` já testado.
- Anotações manuscritas: **mínimo 22 px na tela / 12 pt na impressão**, cor `--ink-muted`, sempre redundantes (a informação também existe em texto normal).
- Nada de itálico; ênfase = negrito. Sem texto em caixa-alta contínua (ruim para leitura).

## 5. Densidade máxima

- **≤ 6 ramos principais** (o esboço usa exatamente 6).
- **~25 nós no total** (esboços: 1 central + 6 títulos + 18 cartões = 25), **≤ 5 cartões por ramo**, **≤ 4 linhas por cartão**, **≤ 28 caracteres por linha** no celular (≈ 36 com fonte de 16 px na largura útil).
- Mais que isso: **dividir em dois mapas** (ex.: "to be — afirmativa e negativa" e "to be — perguntas e respostas"). Um mapa = um objetivo da unidade.
- Cada cartão = uma ideia. Se uma tabela passa de 4 linhas, vira dois cartões.

## 6. Tamanhos mínimos

| Contexto                                             | Corpo                   | Tags (rótulo)      | Anotação manual | Alvo de toque                          |
| ---------------------------------------------------- | ----------------------- | ------------------ | --------------- | -------------------------------------- |
| **Celular** (390 px de largura)                      | **16 px** (nunca menos) | **12 px** negrito  | 22 px           | **≥ 44 px** (título do ramo: 48–50 px) |
| **Desktop** (app)                                    | 17–18 px                | 13 px              | 24 px           | 44 px                                  |
| **Impressão A4 deitado** (1 px ≈ 0,5 pt no esboço A) | **≥ 10 pt** (20 px)     | **≥ 8 pt** (16 px) | ≥ 12 pt (24 px) | —                                      |
| **Impressão A4 retrato** (versão B em 2 colunas)     | ≥ 10 pt                 | ≥ 8 pt             | ≥ 12 pt         | —                                      |

Margens: 16 px nas laterais no celular; 10 mm na impressão. Espaço entre cartões ≥ 10 px (celular) / ≥ 22 px (A4).
Dica de impressão: `@page { size: A4 landscape }`, `print-color-adjust: exact` só para o preenchimento dos títulos (opcional); **sem** a textura de ruído na impressão.

## 7. Versão preto e branco

Em escala de cinza os preenchimentos dos títulos caem em níveis muito próximos (cinza escuro): Afirmativa ≈ 59 %, Erro comum ≈ 63 %, Perguntas ≈ 69 %, Negativa ≈ 70 %; só Contrações (≈ 34 %) e Dica (≈ 21 %) se separam. Por isso:

1. **Identidade do ramo = nome escrito + ícone** no título (não existe ramo sem texto).
2. **Tags** distinguíveis por **forma + ícone + rótulo**; **erro comum** é o único chip **cheio escuro** (destaca-se naturalmente).
3. **Certo/errado** por símbolo (✓ / ✗) e **riscado** vs. negrito, não por verde/vermelho.
4. Opcional na impressão: traço dos conectores por ramo com padrão (sólido, tracejado, pontilhado…) para quem precisa seguir a linha sem cor.
5. Teste: o `index.html` tem o botão **"Ver em preto e branco"** (filtro `grayscale`). Conferido visualmente no esboço A (títulos e tags legíveis); no C os fundos pastel somem, então ele depende mais de ícone e rótulo.

## 8. Modo escuro do papel

Seguir os tokens `.dark` do app: papel **Noite** `#14152B`, cartão `#1E2040`, tinta `#F4F1EA`, cinza `#B6B4C8`. Pautas `#2A2C52`, pontos `#3A3D68`, só como textura.

| Ramo       | Cor (título, traço, texto-chave) | Sobre papel | Sobre cartão | Texto escuro `#14152B` sobre a cor | Texto-chave sobre tint (14 %) |
| ---------- | -------------------------------- | ----------- | ------------ | ---------------------------------- | ----------------------------- |
| Afirmativa | `#5BE08C`                        | **10,7**    | **9,3**      | **10,7**                           | **6,9**                       |
| Negativa   | `#C58CF0` \*                     | **7,2**     | **6,3**      | **7,2**                            | **4,9**                       |
| Perguntas  | `#9A9DFF`                        | **7,4**     | **6,5**      | **7,4**                            | **5,0**                       |
| Contrações | `#FF9A3D`                        | **8,5**     | **7,4**      | **8,5**                            | **5,8**                       |
| Erro comum | `#FF8F8A`                        | **8,1**     | **7,1**      | **8,1**                            | **5,5**                       |
| Dica       | `#F5C518`                        | **11,0**    | **9,6**      | **11,0**                           | **7,2**                       |

\* variante clara da Jabuticaba, nova como a original.

Tinta sobre papel escuro **15,9**, sobre cartão **13,9**; cinza das traduções **8,8** / **7,7**. Nos títulos, a cor vira preenchimento claro com **texto escuro** (como `--on-primary` no app). Sem sombra "dura"; usar contorno `--line-strong`. Tuca, quando entrar, com o halo `--tuca-glow`. Textura de ruído desligada no escuro.

## 9. Acessibilidade e movimento

- No app, **renderizar em HTML/React** (não como imagem): `<ul>`/`<details>` ou `button aria-expanded` para recolher ramos, `lang="en"` nos trechos em inglês, foco visível `--focus`, ordem de leitura = ordem do JSON.
- SVG/PNG só para **exportar/imprimir**; nesse caso `<title>` e `<desc>` (os esboços já têm).
- Qualquer "rabisco" que anime (traço sendo desenhado) respeita `useReducedMotion()` e é opcional.
- Ícones são decorativos (`aria-hidden`) quando há texto ao lado; a tag e o ramo têm rótulo textual.

## 10. Recomendação

**Seguir o esboço B (árvore vertical) como formato do app**, com a "pele" do C, e **gerar o A** como versão para imprimir.

Por quê:

- Os alunos estão no **celular** (PWA, 390 px). Só o B tem texto de 16 px reais sem zoom e permite recolher ramos.
- É o único **fácil de gerar dos dados**: lista aninhada → componente React nativo, com texto selecionável, leitor de tela, modo escuro, áudio por cartão e busca. O A e o C exigem layout espacial (e o C, giros "à mão" que dão trabalho para automatizar sem sobreposição).
- O A é imbatível para **estudar no papel**: um script pode gerar o SVG/PDF A4 deitado a partir do mesmo JSON (colunas de cartões como no esboço).
- O C dá a **personalidade**: usar dele fitas nos títulos de ramo, fundo tint nos cartões, marca-texto no título e 1 a 2 rabiscos de apoio por mapa (lâmpada na Dica, estrelinha ao concluir), sem as rotações.

Decisões que preciso de você:

1. Aprovar a cor **Jabuticaba** (roxo) para "Negativa" (ou escolher outra).
2. **Caveat** (mais charme) ou **Patrick Hand** (mais legível) para as anotações.
3. Confirmar que o formato do mapa no JSON é só **ramos → cartões (`tag`, linhas)**, o que mexe no schema do conteúdo e, portanto, precisa do seu OK antes de qualquer código.
