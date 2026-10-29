# Falaê

PWA gamificado para brasileiros aprenderem inglês (A1→A2). Convenções em `CLAUDE.md`, arquitetura em `docs/ARQUITETURA.md`.

```
npm install
npm run dev
```

## Limitações conhecidas

### Lembrete diário

- Sem _Notification Triggers_ (não suportado nos navegadores atuais), o lembrete só aparece se o app (ou o service worker) estiver ativo; não há servidor de push.
- No iPhone, só funciona com o app instalado na tela inicial (iOS 16.4 ou mais novo).
- O sistema pode atrasar ou suprimir a notificação. A permissão só é pedida ao ligar o lembrete em Ajustes.
