---
name: novo-tipo-de-exercicio
description: Passo a passo para adicionar um novo tipo de exercício ao Falaê — tipo no schema Zod, componente React, corretor de resposta, gerador para a prática, textos, acessibilidade e testes. Use quando for criar ou alterar um tipo de exercício.
---

# Adicionar um tipo de exercício

Exemplo usado abaixo: `order-sentence` (ordenar frase embaralhada). Troque pelo nome real, sempre em `kebab-case`.

## 1. Schema — `src/content/schema.ts`
1. Crie o schema Zod do exercício estendendo `baseExercise` (`id`, `itemIds`, `explanation?`):
   ```ts
   export const orderSentenceExercise = baseExercise.extend({
     type: z.literal('order-sentence'),
     sentenceEn: z.string().min(1),
   });
   ```
2. Adicione-o à união discriminada `exerciseSchema` (`z.discriminatedUnion('type', [...])`).
3. Se houver regra entre campos (ex.: resposta precisa estar nas opções), use `.superRefine` com mensagem em PT.
4. Tipos TS são **inferidos** (`z.infer`) — não escreva tipos à mão.

## 2. Corretor — `src/domain/grading/`
1. Adicione um `case` em `gradeExercise(exercise, response)` retornando `GradeResult` (`{ verdict: 'correct' | 'almost' | 'wrong', correctAnswer, note? }`).
2. Reaproveite `normalize()` e `matchesAccepted()`; não reimplemente normalização.
3. O `switch` deve ser exaustivo (`assertNever`) — o TypeScript acusa tipo esquecido.

## 3. Componente — `src/features/lesson/exercises/OrderSentence.tsx`
1. Props padrão: `ExerciseProps<OrderSentenceExercise>` (`exercise`, `disabled`, `onResponseChange(response | null)`). O componente **não** corrige nem mostra feedback — isso é do `LessonPlayer`.
2. Registre em `exerciseRegistry.ts` (mapa `type → componente` e título da instrução em `pt-BR.ts`).
3. Acessibilidade: operável só com teclado, rótulos (`aria-label`) nos botões, alvos ≥ 44px, sem depender só de cor, animação respeitando `useReducedMotion()`.
4. Textos de UI em `src/i18n/pt-BR.ts`, nunca literais no componente.

## 4. Gerador de prática — `src/domain/practice/generate.ts`
Se o tipo puder ser gerado a partir de `VocabItem`/`Sentence` (para a tela Praticar e revisões), adicione a função geradora e inclua-a no sorteio com peso. Se não puder, documente o motivo.

## 5. Fallbacks
Se depender de API do navegador (voz, vibração), defina o que acontece quando não houver suporte (pular ou trocar por outro tipo) em `src/features/lesson/fallbacks.ts`.

## 6. Testes (obrigatórios)
- `src/domain/grading/*.test.ts`: certo, quase certo, errado, vazio, variações de normalização.
- `src/content/schema.test.ts`: exemplo válido passa, inválido falha com mensagem útil.
- `OrderSentence.test.tsx`: renderiza, interação por mouse e teclado, chama `onResponseChange`.
- E2E (`qa-tester`): lição de fixture com o novo tipo em `e2e/fixtures/`.

## 7. Documentação
- Tabela de tipos em `.claude/skills/criar-licao/SKILL.md` §4.
- `docs/ARQUITETURA.md` §4 (modelo de conteúdo).

## 8. Verificação cruzada
`desenvolvedor` implementa → `revisor-de-codigo` + `qa-tester` verificam → `revisor-ux` avalia a tela → `revisor-linguistico` confere se o tipo é pedagogicamente útil.
