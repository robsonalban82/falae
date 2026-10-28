---
name: criar-licao
description: Como escrever unidades, habilidades, lições, vocabulário e dicas do Falaê em JSON (schema, tipos de exercício, sintaxe de respostas aceitas, pedagogia para brasileiros e checklist de qualidade). Use sempre que for criar ou editar arquivos em src/content/.
---

# Criar lição no Falaê

Fonte da verdade do formato: `src/content/schema.ts` (Zod). Visão geral do modelo: `docs/ARQUITETURA.md` §4. Se este guia e o schema divergirem, **o schema vence** — avise o desenvolvedor.

## 1. Estrutura de arquivo

Um arquivo por unidade: `src/content/units/u01-cumprimentos.json`, `u02-familia.json`…

```
Unit
 ├─ id, order, title, description, color (token), reviewLesson
 └─ skills[4]
     ├─ id, title, icon (emoji), tip (dica de gramática)
     ├─ vocab[]      ← itens rastreados pela repetição espaçada
     ├─ sentences[]  ← frases rastreadas pela repetição espaçada
     └─ lessons[3]
         └─ exercises[10..15]
```

IDs: `kebab-case`, estáveis e únicos no app inteiro, com prefixo da unidade: `u1-hello`, `u1-s-nice-to-meet-you`, `u1-sk1-l2-e07`. **Nunca renomeie um id já publicado** (o progresso do usuário depende dele); se precisar, crie um novo.

## 2. Itens de vocabulário e frases

```json
{
  "id": "u2-brother",
  "en": "brother",
  "pt": ["irmão"],
  "acceptedPt": ["mano"],
  "example": { "en": "My brother lives in Recife.", "pt": "Meu irmão mora em Recife." },
  "emoji": "👦",
  "difficulty": 1,
  "notes": "Opcional: dica curta mostrada ao errar."
}
```

```json
{
  "id": "u2-s-im-thirty",
  "en": "I'm thirty years old.",
  "pt": "Eu tenho trinta anos.",
  "acceptedEn": ["[I'm|I am] [thirty|30] (years old)"],
  "acceptedPt": ["(Eu) tenho [trinta|30] anos (de idade)"],
  "difficulty": 2,
  "focus": "idade-com-be"
}
```

- `difficulty`: 1 = palavra/frase curtíssima, 2 = frase simples, 3 = frase com estrutura nova ou armadilha.
- `focus` (opcional): tag do erro típico tratado (`falso-cognato`, `idade-com-be`, `make-do`, `in-on-at`, `th`, `ed-final`, `vogal-longa-curta`, `ordem-adjetivo`…).

## 3. Sintaxe de respostas aceitas

Usada em `acceptedEn`, `acceptedPt` e em `accepted` dos exercícios. O app expande para todas as combinações.

| Sintaxe  | Significa   | Exemplo             | Aceita                    |
| -------- | ----------- | ------------------- | ------------------------- |
| `(x)`    | opcional    | `(Eu) sou Ana`      | "Eu sou Ana", "Sou Ana"   |
| `[a\|b]` | alternativa | `[I'm\|I am] tired` | "I'm tired", "I am tired" |

Não precisa listar variações de: maiúsculas, acentos, pontuação final, espaços extras, nem contrações padrão (`I'm`↔`I am`, `don't`↔`do not`, `it's`↔`it is`… o corretor já normaliza). **Precisa** listar sinônimos reais e ordens alternativas válidas ("Bom dia" × "Bom dia!" não; "Olá" × "Oi" sim).

Limite: cada padrão deve expandir para no máximo 64 frases (o validador acusa).

Atenção: `|` só vale dentro de `[ ]` — para alternativas opcionais use `([a|b])`. Não existe escape para `( ) [ ] |` literais; evite esses caracteres nas respostas. Um padrão que não gera nenhuma resposta (`()`, `[|]`) é recusado.

## 4. Tipos de exercício

Todo exercício tem `id`, `type`, e `itemIds` (ids de vocab/frases que ele treina — alimenta a repetição espaçada).

| `type`             | Campos principais                                               | Quando usar                                                     |
| ------------------ | --------------------------------------------------------------- | --------------------------------------------------------------- |
| `multiple-choice`  | `prompt` (PT), `options[3-4]` com `emoji`, `answer`             | Apresentar palavra nova (sempre antes de pedir para escrevê-la) |
| `word-bank`        | `promptPt`, `answer` (EN), `accepted`, `distractors[2-4]`       | PT→EN montando frase                                            |
| `translate-typing` | `promptEn`, `accepted` (PT)                                     | EN→PT digitando                                                 |
| `listen-type`      | `textEn`, `accepted`                                            | Ouvir e escrever (o app oferece velocidade lenta)               |
| `speak`            | `textEn`                                                        | Falar a frase; escolha frases de 2–8 palavras                   |
| `match-pairs`      | `pairs[4-5]` `{en, pt}`                                         | Revisar vocabulário                                             |
| `fill-blank`       | `sentence` com `___`, `options[3-4]`, `answer`, `translationPt` | Gramática pontual (preposições, make/do, be)                    |

Todo exercício pode ter `explanation` (PT, ≤ 2 frases) mostrada quando o aluno erra. **Obrigatório** em exercícios com `focus` em erro típico.

## 5. Pedagogia (regras de ouro)

1. **Apresente antes de cobrar**: palavra nova aparece primeiro em `multiple-choice` ou `match-pairs`, só depois em `word-bank`/digitação.
2. **Lição tem 10–15 exercícios**, pelo menos 4 tipos diferentes, no máximo 1 `speak` a cada 5 exercícios e no máximo 2 `listen-type` por lição.
3. **No máximo 4 palavras novas por lição.** Lição 3 da habilidade é quase só revisão/combinação.
4. **Distratores plausíveis**, mas nunca corretos também (cuidado com sinônimos!).
5. **Frases reais**: o que um americano diria de verdade. Contrações são o padrão na fala ("I'm", "don't").
6. **Contexto brasileiro** ajuda: nomes (Ana, João, Thiago), cidades, comidas (pão de queijo, açaí) — mas o inglês tem que soar natural.
7. **Erros de brasileiros** da unidade devem aparecer de propósito, com `explanation`.
8. **Dica da habilidade** (`tip`): 3–6 blocos curtos, em PT, com exemplos EN→PT, uma armadilha comum ("❌ I have 30 years → ✅ I'm 30"). Nada de jargão gramatical sem explicação.
9. Revisão da unidade (`reviewLesson`): 15 exercícios misturando as 4 habilidades, sem palavra nova.

## 6. Checklist antes de entregar

- [ ] `npm run validate:content` passa.
- [ ] Todos os ids novos são únicos e seguem o prefixo.
- [ ] Cada exercício é resolvível só com o que foi ensinado até ali.
- [ ] Toda tradução tem as alternativas realistas (sinônimos, sujeito oculto em PT, "você"/"vocês" quando ambíguo).
- [ ] Nenhum distrator é também resposta correta.
- [ ] Toda armadilha de brasileiro tem `explanation`.
- [ ] Inglês natural (leia em voz alta: soa como alguém falando?).
- [ ] Entregue ao `revisor-linguistico` — você não aprova o próprio trabalho.
