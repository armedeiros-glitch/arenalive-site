# André OS

## Sistema Operacional de Decisão

O André OS não existe para mostrar informações. Ele existe para reduzir decisões.

O Runtime transforma eventos em estado e contexto. A interface torna a próxima decisão clara.

## Modelo mental

Um sistema administrativo tradicional começa pela página:

```text
Página
→ usuário procura
→ tabela
→ botão
→ ação
```

O André OS começa pelo estado real da operação:

```text
Evento
→ Runtime
→ Estado
→ Contexto
→ Priorização
→ Interface
```

A tela não é a fonte da verdade. Ela é uma projeção do que o sistema entende naquele momento.

## Arquitetura de destino

```text
AndreOS
├── Runtime
│   ├── Events
│   ├── State
│   ├── Context
│   ├── Navigation
│   ├── Notifications
│   ├── AI Gateway
│   ├── Knowledge
│   └── UI Runtime
├── Modules
│   ├── Marketing
│   ├── Radar
│   ├── Calendar
│   ├── Finance
│   └── Personal
└── Connectors
    ├── SULTS
    ├── Todoist
    ├── Telegram
    ├── Google Calendar
    └── Gmail
```

## Papéis

- **Connectors** trazem eventos e dados do mundo externo.
- **Modules** contêm regras de negócio de cada domínio.
- **Runtime** coordena eventos e estado global sem conhecer as regras internas dos módulos.
- **Interface** consome estado e contexto para apresentar foco, consequência e próxima ação.

## Direção

A evolução será gradual. Os módulos atuais continuam funcionando enquanto passam a adotar as interfaces públicas do Runtime.

Nenhuma migração deve recriar o sistema em paralelo ou interromper recursos já estáveis.
