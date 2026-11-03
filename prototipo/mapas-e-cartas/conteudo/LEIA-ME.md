# Conteúdo de amostra: mapas mentais e cartas

Protótipo separado do app Falaê. Nada aqui é carregado pelo app. Serve para o usuário avaliar a qualidade antes de decidir integrar.

## Arquivos

- `mapas/*.json`: 6 mapas mentais (`to-be`, `in-on-at`, `falsos-cognatos-1`, `phrasal-get`, `numeros-e-horas`, `skill-u1-sk1`).
- `cartas/*.json`: 60 cartas em 4 baralhos (`frases-dia-a-dia` 24, `phrasal-essenciais` 12, `expressoes-e-girias` 12, `falsos-cognatos` 12).

O mapa `skill-u1-sk1` resume a habilidade "Olá e tchau" (`u1-sk1`) de `src/content/units/u01-cumprimentos.json` e reaproveita as palavras e frases de lá sem mudar nada.

## Convenção de pronúncia simplificada

A pronúncia é só uma ajuda para ler. **O áudio sempre manda.** Ela usa letras do português, lidas como em português, com estas regras:

1. **Sílaba tônica**: uma por palavra, marcada com acento, como no português. Use `á é í ó ú` para vogal aberta e `â ê ô` para vogal fechada. Sílabas fracas ficam sem acento: `têibol` (table), `rezervêichan` (reservation).
2. **Palavras fracas**: `a`, `an`, `the`, `to`, `for`, `of`, `and`, `are`, `do`/`does` (auxiliar) e `can` (na afirmativa e no começo de pergunta; forte só em "Yes, I can" e em _can't_), quando ficam fracas na frase, vão sem acento: `a`, `an`, `tha` (ou `thi` antes de vogal), `ta`, `fer`, `av`, `en`, `ar`, `da`, `kan`. Ex.: `háu ar iú dúing` (How are you doing?), `kan ái sí tha méniu` (Can I see the menu?), `da iú têik krédit kárdz` (Do you take credit cards?). Quando a carta mostra só o phrasal verb (`lúk fór`), a partícula fica com acento, porque ali ela é forte.
3. **`â`** é o "a" fechado e curto de _but, up, much_: `bât`, `âp`, `mâtch`.
4. **`é`** também representa o som de _cat, have, bad_. Não existe em português: fica entre o "á" e o "é", com a boca bem aberta. Exemplos: `hév` (have), `thénks` (thanks).
5. **`á`** representa o "o" americano de _hot, job, doctor, on, sorry_: `hát`, `djáb`, `dákter`, `án`, `sári`. **Decisão tomada:** seguimos o inglês americano (`án`, `sári`), mesmo que `ón` pareça mais familiar.
   **`ó`** é o "ó" aberto de _call, off, lost, along, for_: `kól`, `óf`, `lóst`, `alóng`, `fór`.
6. **`th`** continua escrito `th` (_think, this, the_): ponta da língua entre os dentes, soltando o ar. **Não** é "f", "t" nem "d".
7. **`h`** no começo da palavra é só ar saindo da garganta, como um "rr" carioca bem suave: `hélou`, `háu`.
8. **`r`** é sempre o r americano: língua curvada para trás, sem encostar no céu da boca e sem vibrar (parecido com o r "caipira"). Nunca é o "rr" de "carro".
9. **Consoante no fim** fica sem vogal extra: `tchék` (e não "tchéki"), `lúk` (e não "lúki").
10. **`s` + consoante no começo** (_stop, school_): comece direto no "s", sem "i" antes. Não é "istop".
11. **`ng`** no fim (_-ing, along_): som nasal no fundo da boca, sem dizer "gui": `lúking`, `alóng`.
12. **`m` no fim**: feche os lábios (`áim`, I'm), sem virar "ã". **`n` no fim**: encoste a ponta da língua atrás dos dentes de cima, sem virar "ã" (`án`, `sénd`).
13. Outras letras: `ch` = som de "chá" (inglês _sh_: `púch`); `tch` = som de "tchau" (_ch_: `tchék`); `dj` = som de _j_ inglês (`djâst`); `z` = som de "zero" (o _s_ de _is, cards_: `íz`, `kárdz`); `gu` antes de e/i = "g" duro (`guét`); `u` e `i` antes de vogal são semivogais (`uât` what, `iú` you, `uí` we).
14. **O "t" americano entre vogais (flap)**: na fala rápida, o _t_ (e o _d_) entre vogais vira um toque rápido de língua, igual ao "r" de "caro": _get up_ soa `guérâp`, _put on_ soa `púrán`, _gotta_ soa `gára`, _thirty_ soa quase `thír-di`. Depois de _r_, escrevemos `d` (`thír-di`), porque "rr" seria lido como o rr de "carro". No campo `pronunciation` vem primeiro a forma cuidadosa, que também é correta; quando o flap é marcante, a carta mostra a forma rápida depois de `· rápido:` (`guét âp · rápido: guérâp` em `pv-001`, também em `pv-009` e `ex-008`). Nos mapas, o aviso fica numa nota (`numeros-e-horas`).
15. **O que não marcamos** (use o áudio): vogal longa × curta (_sheep_ × _ship_ ficam parecidos na escrita), o "l" escuro do fim (_table, school_) e a diferença entre as várias vogais fracas.

Cada `pronunciation` tem no máximo 40 caracteres, como prevê `docs/MAPAS-E-CARTAS.md` §2.3.

## Níveis

Quase tudo é A1/A2. Só 2 cartas são B1, com selo: `ex-011` (_I'm down_) e `ex-012` (_That's a bummer_).
