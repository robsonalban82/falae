---
name: revisar-licao
description: Checklist do revisor-linguistico para revisar unidades e lições do Falaê em src/content/ — gramática, naturalidade, respostas aceitas, resolubilidade, progressão e erros típicos de brasileiros. Use ao revisar qualquer conteúdo de estudo.
---

# Revisar lição no Falaê

Leia antes: `.claude/skills/criar-licao/SKILL.md` (regras que o autor deve seguir) e `src/content/schema.ts`.

## Como revisar

Percorra a unidade **na ordem em que o aluno vê** (habilidade 1 → lição 1 → exercício 1…). Para cada exercício, pergunte: "um brasileiro que só viu o conteúdo até aqui consegue responder, e o app aceitaria todas as respostas corretas que ele daria?"

## Checklist

### Inglês

- [ ] Gramática e ortografia americanas corretas (color, favorite, mom).
- [ ] Soa natural na boca de um americano hoje. Sinalize frases de livro ("How do you do?", "I am fine, thank you, and you?" como única resposta).
- [ ] Contrações usadas como na fala real; ambas as formas aceitas.
- [ ] Registro adequado (nada de gíria pesada; nada formal demais).

### Português

- [ ] PT-BR natural, não tradução palavra por palavra.
- [ ] Ambiguidades cobertas: "you" = você/vocês/tu? sujeito oculto ("Sou Ana")? gênero ("tired" = cansado/cansada)?

### Respostas aceitas

- [ ] Toda resposta correta razoável está coberta por `accepted*` (pense em 3 jeitos de um aluno responder).
- [ ] Nenhuma resposta errada é aceita por um padrão largo demais.
- [ ] Nenhum distrator de `word-bank`/`multiple-choice`/`fill-blank` também é correto.
- [ ] `word-bank`: dá para montar a resposta só com as palavras do banco.

### Resolubilidade e progressão

- [ ] Palavra nova é apresentada (múltipla escolha/pares) antes de ser cobrada na escrita.
- [ ] ≤ 4 palavras novas por lição; dificuldade cresce dentro da habilidade.
- [ ] `listen-type` e `speak`: frase curta e clara para síntese de voz (evite nomes estranhos e homófonos sem contexto).
- [ ] Exercício não depende de conhecimento externo (cultura americana obscura).

### Erros típicos de brasileiros

- [ ] Os focos da unidade aparecem e têm `explanation` clara em PT.
- [ ] Explicação correta, curta (≤ 2 frases) e com exemplo.
- [ ] A dica (`tip`) da habilidade explica a regra sem jargão e mostra ❌/✅.

### Dados

- [ ] Emojis condizem com a palavra.
- [ ] Exemplos de vocabulário são frases completas e naturais.
- [ ] `itemIds` do exercício apontam para os itens realmente treinados.

## Severidade

- **bloqueante**: erro de inglês ou português; resposta certa rejeitada; resposta errada aceita; exercício impossível/ambíguo; explicação errada.
- **importante**: frase artificial; alternativa comum faltando; progressão quebrada; dica confusa; palavra cobrada antes de apresentada.
- **sugestão**: estilo, troca de exemplo, emoji melhor.

## Formato da resposta

```
[bloqueante] u2-familia.json › u2-sk3-l1-e05
Problema: "I have 30 years" aparece como resposta correta.
Correção: answer = "I'm 30 years old."; accepted = ["[I'm|I am] [thirty|30] (years old)"]
```

Termine com `APROVADO` (0 bloqueantes, 0 importantes) ou `REPROVADO (X bloqueantes, Y importantes, Z sugestões)`.
