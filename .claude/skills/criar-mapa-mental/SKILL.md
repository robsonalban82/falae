---
name: criar-mapa-mental
description: Como escrever mapas mentais do Falaê em src/content/mindmaps/mm-*.json (estrutura centro → ramos → cartões → linhas, limites, ligação com o SRS por ref, teste rápido e cenas SVG). Use sempre que for criar ou editar um mapa mental.
---

# Criar mapa mental no Falaê

Fonte da verdade: `src/content/schemas/mindmap.ts` (Zod) e `src/content/mindmapIssues.ts`. Especificação: `docs/MAPAS-E-CARTAS.md` §2.5 e §12.1. Se este guia e o schema divergirem, **o schema vence**.

## 1. Arquivo e ids

- Um arquivo por mapa: `src/content/mindmaps/mm-<slug>.json`, com `id` igual ao nome do arquivo.
- Mapa de habilidade tem `unitId` (ex.: `u1-unit`) e `skillId`; no máximo 1 mapa por `skillId`.
- Ids publicados nunca mudam.

## 2. Estrutura

```
centro (en, pt, centerArt?)
 └─ ramos (2 a 6, cada um com label, icon e uma cor diferente:
    folha · jabuticaba · anil · manga · acerola · maracuja)
     └─ cartões (tag: regra | exemplo | excecao | erro-comum | vocabulario; title?, art?)
         └─ linhas, em uma de 4 formas:
            { ref, hint? }        ← item de unidade ou banco (entra no SRS)
            { en, pt }            ← frase solta do mapa
            { wrong, right, note? } ← erro comum
            { note }
```

- No máximo 25 cartões no mapa inteiro; `hint` com até 60 caracteres.
- **Leitura confortável**: até 5 cartões por ramo e 4 linhas por cartão (passar disso gera aviso).
- **Negrito** com `**palavra**`, em pares, sem espaço nem `*` nas pontas.
- **Ligação com o SRS**: pelo menos 4 `ref` distintos por mapa. Se uma linha `en` repete um item que já existe, use `ref` (o validador acusa "use ref").
- `ref` acima do nível do mapa ou de unidade posterior gera aviso — justifique ou troque.

## 3. Teste rápido (`quiz`)

- 3 a 6 itens, cada `prompt` com **uma** lacuna `___` e `answer` no formato de respostas aceitas (`[a|b]`, `(opcional)`), mais `hintPt`.
- Não copie frase do mapa: o teste mede se o aluno transfere a regra.
- Sem ambiguidade: se duas respostas são corretas em inglês, as duas entram em `answer`.

## 4. Cenas

- `centerArt` e `art` apontam para `src/content/art/<nome>.svg`, que precisa existir. Cena nova é pedida ao `designer-de-mapas` (estilo em `docs/ESTILO-CENAS.md`).
- Uma cena por cartão no máximo, só quando ajuda a lembrar; cena sem uso gera aviso.

## 5. Antes de entregar

`npm run validate:content` sem erros e sem avisos não justificados. Depois: `revisor-linguistico` + `pedagogo` em paralelo, e `designer-de-mapas` nas cenas.
