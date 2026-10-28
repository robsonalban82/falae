# Decisões de arquitetura

Formato: contexto → decisão → consequências. Status: proposta · aceita · substituída.

## ADR-001 — Exercícios escritos à mão nas lições; gerados na prática (proposta)
**Contexto:** 48 lições × ~12 exercícios. Gerar tudo automaticamente reduz trabalho, mas piora a qualidade pedagógica e dificulta a revisão linguística.
**Decisão:** lições da trilha têm exercícios explícitos no JSON (revisáveis um a um). A tela Praticar e a revisão espaçada geram exercícios a partir de `vocab`/`sentences`.
**Consequências:** JSON maior; o revisor-linguistico revisa exatamente o que o aluno vê; o gerador precisa de testes próprios.

## ADR-002 — SM-2 adaptado em vez de FSRS (proposta)
**Contexto:** FSRS é mais preciso, mas precisa de parâmetros treinados e é mais difícil de testar e explicar.
**Decisão:** SM-2 com notas derivadas do desempenho na sessão (§7 da arquitetura), isolado em `src/domain/srs/` atrás de uma função `review(card, q, today)`.
**Consequências:** simples e testável; trocar por FSRS depois não afeta o resto do app.

## ADR-003 — Sons sintetizados com Web Audio (proposta)
**Contexto:** sons precisam ser originais e livres de direitos, e funcionar offline.
**Decisão:** gerar sons curtos por osciladores em tempo real.
**Consequências:** zero arquivos de áudio; sem risco de direitos; timbre mais "sintético" (aceitável para feedback curto).

## ADR-004 — Padrões compactos para respostas aceitas (proposta)
**Contexto:** listar todas as variações de uma tradução explode o JSON e gera esquecimentos.
**Decisão:** sintaxe `(opcional)` e `[a|b]`, expandida na carga (limite 64 por padrão); contrações, acentos, maiúsculas, pontuação e números são tratados pelo normalizador.
**Consequências:** conteúdo mais enxuto e completo; o validador precisa checar a expansão.
