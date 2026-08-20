# AndreOS Context Engine

## Propósito

O Context Engine transforma fatos já conhecidos pelo Runtime em um retrato único e explicável do estado atual do André OS.

Ele responde, sem consultar IA:

- qual operação está ativa;
- qual view está aberta;
- se a sessão está autenticada;
- quais fontes estão disponíveis;
- qual item está em foco;
- qual é o nível de atenção;
- qual é o próximo movimento sugerido;
- por que esse foco foi escolhido.

O Context Engine não substitui o Radar. O Radar continua responsável por coletar, normalizar e ordenar os itens operacionais. O Context Engine preserva essa ordenação e adiciona contexto transversal.

## API pública

```js
AndreOS.context.get()
AndreOS.context.get('focus.item')
AndreOS.context.update('motivo.da.atualizacao')
AndreOS.context.subscribe(handler)
AndreOS.context.registerProvider(name, provider, options)
AndreOS.context.explain()
AndreOS.context.explain('focus')
```

O snapshot atual também fica disponível em:

```js
AndreOS.state.get('context.current')
```

## Providers

Providers entregam fatos. Eles não devem renderizar interface, chamar outros módulos diretamente ou decidir regras específicas de negócio.

Exemplo:

```js
const unregister = AndreOS.context.registerProvider(
  'calendarContext',
  () => ({
    value: {
      nextEventAt: '2026-08-10T14:00:00-03:00'
    },
    evidence: [
      {
        type: 'fact',
        message: 'Existe um compromisso futuro registrado.'
      }
    ]
  }),
  { priority: 20 }
);
```

Um provider que falha não derruba o Context Engine. A falha é registrada no estado dos providers e publica `context.providerFailed`.

## Eventos

```text
context.updated
context.focusChanged
context.sourceStatusChanged
context.priorityChanged
context.providerFailed
```

`context.updated` é retido pelo Event Bus. Novos consumidores podem usar replay:

```js
AndreOS.events.on(
  AndreOS.context.events.updated,
  (context) => console.log(context),
  { replayLatest: true }
);
```

O Context Engine também publica o snapshot em `assistant.contextUpdated` para consumidores ligados ao assistente.

## Foco

A ordem de escolha é:

1. item selecionado explicitamente por um evento `focus.changed`;
2. primeiro item executável na ordenação entregue pelo Radar;
3. primeiro item disponível na ordenação do Radar;
4. nenhum foco, quando não existem itens.

O Context Engine não reproduz o algoritmo visual do cockpit e não cria outra fila de prioridade.

## Explicabilidade

Cada snapshot contém:

```js
context.explanations.focus
context.explanations.priority
context.explanations.sources
```

A explicação informa resumo, razões e fontes usadas. Isso permite que interfaces e assistentes mostrem não apenas a decisão, mas também sua origem.

## Saúde das fontes

Estados possíveis:

```text
online
unknown
unavailable
degraded
```

Nesta versão são consolidados:

- Radar;
- SULTS;
- dados compartilhados do Hub.

O Engine usa o snapshot e a lista de erros publicados pelo Radar. Ele não chama endpoints diretamente.

## Primeiro consumidor

O Pensar comigo é o primeiro consumidor do Context Engine.

Um adaptador temporário:

- registra o Runtime como provider do assistente;
- transforma o snapshot no contrato esperado pelo payload atual;
- publica o item selecionado como `focus.changed`;
- publica `assistant.thinkingStarted` e `assistant.responseFinished`;
- mantém o construtor antigo como fallback durante a migração.

Nenhuma alteração visual é necessária nesta etapa.

## Responsabilidades que não pertencem ao Engine

O Context Engine não deve:

- buscar dados em APIs;
- alterar tarefas ou registros;
- classificar chamados com regras próprias;
- renderizar componentes;
- armazenar dados de negócio;
- chamar IA para decidir foco;
- substituir módulos ou conectores.

## Próximas migrações

Depois da validação do Pensar comigo:

1. cockpit da Home;
2. Notification Center;
3. Navigation Manager;
4. Context providers dos módulos Calendar, Finance e Personal.

Cada migração deve remover uma dependência direta antiga. Não devem existir dois motores permanentes calculando o mesmo contexto.
